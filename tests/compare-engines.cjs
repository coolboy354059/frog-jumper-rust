'use strict';

const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const {
  step_player_motion: rustStepAllocating,
  create_motion_buffer,
  step_player_motion_into_buffer: rustStepIntoBuffer
} = require('../rust/pkg-node/frog_jumper_rust_node.js');

// Warm the legacy allocating export before creating a view into WASM memory.
 // A WebAssembly memory.grow detaches existing typed-array views.
rustStepAllocating(0, 0, 0, 0, 1 / 60, 300, 1580, 900);
let rustBuffer = create_motion_buffer();

function ensureRustBuffer() {
  if (!rustBuffer || rustBuffer.length !== 4) {
    rustBuffer = create_motion_buffer();
  }
  assert.equal(rustBuffer.length, 4, 'reusable WASM motion buffer must contain four values');
  return rustBuffer;
}

function jsStep(x, y, vy, axis, dt, speed, gravity, maxFall) {
  const vx = axis * speed;
  const nextX = x + vx * dt;
  const nextVy = Math.min(maxFall, vy + gravity * dt);
  const nextY = y + nextVy * dt;
  return [nextX, nextY, vx, nextVy];
}

function assertClose(actual, expected, label) {
  const tolerance = 1e-9;
  assert.ok(Number.isFinite(actual), label + ' must be finite');
  assert.ok(Math.abs(actual - expected) <= tolerance,
    label + ': expected ' + expected + ', got ' + actual);
}

const scenarios = [
  { name: 'idle', axis: () => 0, dt: () => 1 / 60, speed: 300, gravity: 1580, maxFall: 900 },
  { name: 'right', axis: () => 1, dt: () => 1 / 60, speed: 300, gravity: 1580, maxFall: 900 },
  { name: 'left', axis: () => -1, dt: () => 1 / 60, speed: 300, gravity: 1580, maxFall: 900 },
  { name: 'alternating', axis: i => (i % 120 < 60 ? 1 : -1), dt: () => 1 / 60, speed: 300, gravity: 1580, maxFall: 900 },
  { name: 'variable-frame-time', axis: i => [-1, 0, 1][i % 3], dt: i => [1 / 30, 1 / 60, 1 / 120][i % 3], speed: 300, gravity: 1580, maxFall: 900 },
  { name: 'rising-and-falling', axis: i => (i % 80 < 40 ? 1 : 0), dt: () => 1 / 60, speed: 300, gravity: 1580, maxFall: 900, startVy: -655 }
];

function readRustBuffer() {
  const buffer = ensureRustBuffer();
  return [buffer[0], buffer[1], buffer[2], buffer[3]];
}

function verifyParity() {
  const stepsPerScenario = 12000;
  let compared = 0;
  for (const scenario of scenarios) {
    let js = [120, 80, scenario.startVy || 0];
    let rust = [120, 80, scenario.startVy || 0];
    for (let i = 0; i < stepsPerScenario; i++) {
      const axis = scenario.axis(i);
      const dt = scenario.dt(i);
      const args = [axis, dt, scenario.speed, scenario.gravity, scenario.maxFall];
      const expected = jsStep(js[0], js[1], js[2], ...args);

      const legacy = Array.from(rustStepAllocating(rust[0], rust[1], rust[2], ...args));
      rustStepIntoBuffer(rust[0], rust[1], rust[2], ...args);
      const optimized = readRustBuffer();

      for (let k = 0; k < 4; k++) {
        assertClose(legacy[k], expected[k], scenario.name + ' legacy step ' + i + ' field ' + k);
        assertClose(optimized[k], expected[k], scenario.name + ' buffered step ' + i + ' field ' + k);
      }

      js = [expected[0], expected[1], expected[3]];
      rust = [optimized[0], optimized[1], optimized[3]];
      compared++;
    }
  }
  console.log('PARITY PASS: ' + compared + ' movement steps matched across JavaScript, legacy Rust/WASM, and reusable-buffer Rust/WASM.');
}

// This mirrors the actual game's JavaScript fallback: inline math and no
// per-frame result array or helper-object allocation.
function runJsBenchmark(iterations) {
  let x = 120, y = 80, vy = 0, checksum = 0;
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const axis = (i % 180 < 90) ? 1 : -1;
    const vx = axis * 300;
    x += vx * (1 / 60);
    vy = Math.min(900, vy + 1580 * (1 / 60));
    y += vy * (1 / 60);
    checksum += vx;
  }
  return { ms: performance.now() - start, checksum, x, y, vy };
}

function runRustAllocatingBenchmark(iterations) {
  let x = 120, y = 80, vy = 0, checksum = 0;
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const axis = (i % 180 < 90) ? 1 : -1;
    const result = rustStepAllocating(x, y, vy, axis, 1 / 60, 300, 1580, 900);
    x = result[0]; y = result[1]; vy = result[3];
    checksum += result[2];
  }
  return { ms: performance.now() - start, checksum, x, y, vy };
}

function runRustBufferBenchmark(iterations) {
  ensureRustBuffer();
  let x = 120, y = 80, vy = 0, checksum = 0;
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const axis = (i % 180 < 90) ? 1 : -1;
    rustStepIntoBuffer(x, y, vy, axis, 1 / 60, 300, 1580, 900);
    x = rustBuffer[0]; y = rustBuffer[1]; vy = rustBuffer[3];
    checksum += rustBuffer[2];
  }
  return { ms: performance.now() - start, checksum, x, y, vy };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function benchmark() {
  const iterations = 150000;
  const warmup = 20000;
  runJsBenchmark(warmup);
  runRustAllocatingBenchmark(warmup);
  runRustBufferBenchmark(warmup);

  const jsTimes = [];
  const allocatingTimes = [];
  const bufferTimes = [];
  let jsLast, allocatingLast, bufferLast;

  for (let round = 0; round < 5; round++) {
    if (round % 2 === 0) {
      jsLast = runJsBenchmark(iterations);
      allocatingLast = runRustAllocatingBenchmark(iterations);
      bufferLast = runRustBufferBenchmark(iterations);
    } else {
      bufferLast = runRustBufferBenchmark(iterations);
      jsLast = runJsBenchmark(iterations);
      allocatingLast = runRustAllocatingBenchmark(iterations);
    }
    jsTimes.push(jsLast.ms);
    allocatingTimes.push(allocatingLast.ms);
    bufferTimes.push(bufferLast.ms);
  }

  for (const [label, result] of [['allocating Rust', allocatingLast], ['buffered Rust', bufferLast]]) {
    assertClose(result.x, jsLast.x, label + ' final x');
    assertClose(result.y, jsLast.y, label + ' final y');
    assertClose(result.vy, jsLast.vy, label + ' final vertical velocity');
  }

  const jsMedian = median(jsTimes);
  const allocatingMedian = median(allocatingTimes);
  const bufferMedian = median(bufferTimes);
  console.log('BENCHMARK (Node.js runner; movement math only, not FPS or full-game performance)');
  console.log('Iterations per round: ' + iterations + '; rounds: 5; warmup: ' + warmup);
  console.log('JavaScript inline median: ' + jsMedian.toFixed(3) + ' ms');
  console.log('Rust/WASM allocating-result median: ' + allocatingMedian.toFixed(3) + ' ms');
  console.log('Rust/WASM reusable-buffer median: ' + bufferMedian.toFixed(3) + ' ms');
  console.log('Reusable buffer vs allocating Rust: ' + (allocatingMedian / bufferMedian).toFixed(2) + 'x speedup');
  console.log('Reusable-buffer Rust/WASM vs inline JS: ' + (bufferMedian / jsMedian * 100).toFixed(1) + '% of JS time (' + (bufferMedian <= jsMedian ? 'faster' : 'slower') + ')');
}

verifyParity();
benchmark();
