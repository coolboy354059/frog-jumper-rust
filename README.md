# Frog Jumper Rust 🐸🦀

This is the separate Rust + WebAssembly experiment for the existing Frog Jumper 2D game.

**Play:** https://coolboy354059.github.io/frog-jumper-rust/

## What is included

- The full Frog Jumper browser game and its artwork.
- The original JavaScript game systems: rendering, controls, menus, levels, coins, enemies, bosses, and multiplayer client.
- A small Rust crate in `rust/` that calculates the player's numeric movement step.
- A safe JavaScript fallback when the WebAssembly package is unavailable.
- Desktop browser regression tests and manual Rust build workflows.

## Rust experiment

Rust currently handles only the numeric player movement step: horizontal movement, gravity, and vertical integration. JavaScript continues to own collision detection, platform rules, jump buffering, coyote time, rendering, input, sound, and gameplay.

The purpose is to learn Rust/WebAssembly and compare behavior, not to assume WebAssembly is automatically faster. Keep the Rust path only if the tests and measurements show that it is useful.

## Build and test locally (Windows PowerShell)

Install the stable Rust toolchain and Node.js, then run:

```powershell
rustup target add wasm32-unknown-unknown
cargo install wasm-pack --locked
cargo test --manifest-path rust/Cargo.toml
wasm-pack build rust --target web --release
npm install
npm test
```

Serve the repository over HTTP (ES modules and WebAssembly need a web server):

```powershell
py -m http.server 8000
```

Open http://localhost:8000/ in a desktop browser.

## GitHub Pages deployment

The `Deploy Rust Frog Jumper to GitHub Pages` workflow runs on pushes to `main` and can also be started manually. It:

1. Installs stable Rust and the `wasm32-unknown-unknown` target.
2. Runs the Rust unit tests.
3. Builds the browser package with `wasm-pack`.
4. Uploads the complete site, including the generated `rust/pkg/` files.
5. Deploys the site to GitHub Pages.

The separate browser regression workflow is manual-only. From GitHub, open **Actions**, select **Strict browser tests**, and choose **Run workflow** when you want to run Playwright.

## Repository structure

- `index.html` — Entry point.
- `index-game.html` — Main game implementation.
- `assets/` — Game artwork.
- `rust/` — Rust/WebAssembly movement module.
- `tests/` — Playwright browser regression tests.
- `worker/` and `wrangler.toml` — Multiplayer Worker source and configuration.

The original `frog-jumper-2d` repository and its published website are separate and are not changed by this project.
