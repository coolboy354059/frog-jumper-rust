# GitHub Copilot instructions

For Frog Jumper Rust Edition:
- Keep the existing game in `index-game.html`; do not rewrite or restructure the full game without the maintainer asking.
- JavaScript owns rendering, menus, controls, audio, collisions, platform rules, and gameplay decisions.
- Rust in `rust/` is limited to pure numerical calculations covered by unit tests.
- Preserve the JavaScript fallback so the game works if WebAssembly is missing or fails to load.
- Keep this site's localStorage keys prefixed with `frogJumperRust` to protect the original Frog Jumper site's saves.
- Add regression coverage for bug fixes; never weaken or remove an assertion to make tests pass.
- Browser regression tests are manual-only. Do not trigger tests automatically on pushes.
- The Pages workflow must build Rust/WebAssembly before uploading the website artifact.
- Do not change or deploy the separate `frog-jumper-2d` repository from this project.
- AI-generated suggestions require human review.
