'use strict';

const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { step_player_motion: rustStep } = require('../rust/pkg-node/frog_jumper_rust_node.js');

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
      const actual = Array.from(rustStep(rust[0], rust[1], rust[2], ...args));
      for (let k = 0; k < 4; k++) assertClose(actual[k], expected[k], scenario.name + ' step ' + i + ' field ' + k);
      js = [expected[0], expected[1], expected[3]];
      rust = [actual[0], actual[1], actual[3]];
      compared++;
    }
  }
  console.log('PARITY PASS: ' + compared + ' movement steps matched across JS and compiled Rust/WASM.');
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function runJsBenchmark(iterations) {
  let x = 120, y = 80, vy = 0, checksum = 0;
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const axis = (i % 180 < 90) ? 1 : -1;
    const dt = 1 / 60;
    const result = jsStep(x, y, vy, axis, dt, 300, 1580, 900);
    x = result[0]; y = result[1]; vy = result[3];
    checksum += result[2];
  }
  return { ms: performance.now() - start, checksum, x, y, vy };
}

function runRustBenchmark(iterations) {
  let x = 120, y = 80, vy = 0, checksum = 0;
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const axis = (i % 180 < 90) ? 1 : -1;
    const result = rustStep(x, y, vy, axis, 1 / 60, 300, 1580, 900);
    x = result[0]; y = result[1]; vy = result[3];
    checksum += result[2];
  }
  return { ms: performance.now() - start, checksum, x, y, vy };
}

function benchmark() {
  const iterations = 150000;
  const warmup = 20000;
  runJsBenchmark(warmup);
  runRustBenchmark(warmup);
  const jsTimes = [];
  const rustTimes = [];
  let jsLast, rustLast;
  for (let round = 0; round < 5; round++) {
    jsLast = runJsBenchmark(iterations);
    rustLast = runRustBenchmark(iterations);
    jsTimes.push(jsLast.ms);
    rustTimes.push(rustLast.ms);
  }
  assertClose(rustLast.x, jsLast.x, 'benchmark final x');
  assertClose(rustLast.y, jsLast.y, 'benchmark final y');
  assertClose(rustLast.vy, jsLast.vy, 'benchmark final vertical velocity');
  const jsMedian = median(jsTimes);
  const rustMedian = median(rustTimes);
  const ratio = rustMedian / jsMedian;
  console.log('BENCHMARK (Node.js runner; movement math only, not FPS or full-game performance)');
  console.log('Iterations per round: ' + iterations + '; rounds: 5; warmup: ' + warmup);
  console.log('JavaScript median: ' + jsMedian.toFixed(3) + ' ms');
  console.log('Rust/WASM median: ' + rustMedian.toFixed(3) + ' ms');
  console.log('Rust/WASM vs JS: ' + (ratio * 100).toFixed(1) + '% of JS time (' + (ratio <= 1 ? 'faster' : 'slower') + ')');
}

verifyParity();
benchmark();
