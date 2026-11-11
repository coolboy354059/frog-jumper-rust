# Frog Jumper Rust movement experiment

This crate provides the optional Rust/WebAssembly player-motion calculation used by the separate Frog Jumper Rust Edition website.

## Responsibilities

Rust calculates one fixed-timestep movement step: horizontal velocity, horizontal position integration, gravity, maximum falling speed, and vertical position integration.

JavaScript remains responsible for input, collision detection, platform clamping, jump buffering, coyote time, rendering, menus, coins, enemies, sound, and multiplayer. If the generated package is missing or fails to load, the game automatically uses the JavaScript movement calculation.

## Build on Windows

Install the stable Rust toolchain, then run from the repository root:

```powershell
rustup target add wasm32-unknown-unknown
cargo install wasm-pack --locked
cargo test --manifest-path rust/Cargo.toml
wasm-pack build rust --target web --release
```

The last command creates `rust/pkg/`. The website loads `rust/pkg/frog_jumper_rust.js` and its matching WebAssembly module.

## Run locally

Serve the repository over HTTP; opening the HTML file directly does not support browser ES-module loading:

```powershell
py -m http.server 8000
```

Open http://localhost:8000/. Before building the Rust package, the game uses the JavaScript fallback.

## Performance note

WebAssembly is not automatically faster for a tiny calculation. Crossing the JavaScript/WebAssembly boundary and returning a typed array also has a cost. Keep the Rust path only if it stays behavior-compatible and testing shows a benefit.
