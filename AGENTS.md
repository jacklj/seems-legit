# Repository Guidelines

## Project Structure & Module Organization
- `index.html` is the single entry point for the game UI and layout.
- `style.css` contains all styling (CSS variables, layout, and component styles).
- `game.js` holds the entire game loop, state, and rendering logic.
- `Screenshot 2026-01-18 at 14.31.16.png` is a static asset used for reference.

## Technical Plan (One-Page Static HTML/JS) — “The Ladder: Follow the Money”
### Target Constraints
- Single static page: `index.html` + optional `style.css` + `game.js`.
- Frontend-only, no server or storage; runs on modern desktop + mobile browsers.
- Rendering uses HTML5 `<canvas>` with simple shapes or optional sprites.

### Gameplay Summary
- Top-down maze; collect clues to fill a meter and accuse shops when full.
- Expose 3 bad shops to win; wrong accusations permanently speed up enemies.
- Each round adds enemies/shops and increases speed with randomized placements.

### Core Systems
- Fixed-timestep loop with state machine: `BOOT` → `ROUND_INTRO` → `PLAYING` → `ROUND_WIN` → `NEXT_ROUND`.
- Tile grid (21x27 typical) with `WALL`, `PATH`, `CLUE`, `SHOP`, `SPAWN_PLAYER`, `SPAWN_ENEMY`.
- Player grid-snaps at tile centers; enemies choose directions via simple greedy/random mix.
- Accusation: require full meter and proximity; success exposes a bad shop, failure adds speed penalty.

### Round Scaling & Defaults
- `numEnemies = clamp(1 + floor(roundIndex/2), 1, 5)`; `numShops = clamp(5 + roundIndex, 5, 12)`.
- `badShopCount = 3`; `clueTarget = 20 + roundIndex*5`; `enemySpeedBase = 1.2 + roundIndex*0.1`.
- Suggested defaults: tile 16px (scaled 3x), player speed 2.0, enemy base 1.6, penalty +0.2.

### UI, Controls, Rendering
- HUD: clue meter, exposed count, heat; round intro overlay.
- Controls: arrows/WASD + on-screen D-pad; `Space`/button to accuse.
- Draw order: walls → clues → shops → player → enemies → HUD; `imageSmoothingEnabled = false`.

### Implementation Checklist
1. Canvas setup + resize scaling
2. Tilemap render + wall collisions
3. Player movement (grid-snapped)
4. Clues: placement, pickup, meter
5. Shops: placement, expose state rendering
6. Enemy movement + intersection logic
7. Accuse input + proximity + penalty stacking
8. Round transitions + randomized placements
9. HUD + overlays
10. Mobile controls (if needed)
11. Polish (sounds, small effects)

## Build, Test, and Development Commands
- `python3 -m http.server 8000` serves the project locally so the canvas game loads with correct asset paths. Open `http://localhost:8000` in a browser.
- No build step or bundler is used; edit files directly and refresh.

## Coding Style & Naming Conventions
- Indentation: 2 spaces in HTML, CSS, and JS.
- JavaScript uses `const`/`let`, semicolons, and `camelCase` for variables and functions.
- Constants are uppercase (e.g., `TILE_PX`, `STATE`).
- CSS class names are short and lowercase (e.g., `.hero`, `.game-wrap`).
- Keep styles in `style.css`; avoid inline styles in `index.html`.

## Testing Guidelines
- No automated tests are present yet.
- Manual checks: load the page, verify movement, clue collection, shop accusations, and HUD updates.

## Commit & Pull Request Guidelines
- Commit messages in history are short, lowercase phrases (e.g., `working better`, `player can move`). Follow that tone.
- PRs should include a concise description, steps to verify, and screenshots or a short clip for UI changes.
- Link any related issues when applicable.

## Agent Notes
- Keep the game playable via a static server; avoid adding build dependencies unless necessary.
