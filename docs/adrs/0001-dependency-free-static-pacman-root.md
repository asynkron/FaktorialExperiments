# ADR 0001: Keep the Pacman experiment as a dependency-free static root app

## Status

Accepted

## Context

Issue `planitem-gh5-batch-1-static-web-app-scaffold-batch-2-core-maze-and-player-loop-im-a6056c9a0e` added the first playable Pacman loop after investigation found the repository contained only `README.md`, `Makefile`, and `.gitignore`.

The delivery needed a stable maze layout, keyboard controls, wall collision, pellet collection, scoring, and browser-verifiable movement. There was no existing frontend framework, build pipeline, generated asset path, or `internal/web/app` surface to preserve.

## Decision

Keep the Pacman experiment as plain static HTML, CSS, and JavaScript rooted at the repository top level:

- `index.html` is the browser entry point.
- `styles.css` owns fixed tile sizing, HUD layout, and board presentation.
- `src/main.js` owns the maze template, render state, keyboard intent, movement loop, collision checks, pellet collection, scoring, and win or blocked status.

Do not introduce a package manager, bundler, framework, or generated asset refresh path until a later issue needs capabilities that the static app cannot reasonably provide.

## Consequences

The app remains easy to open directly from disk or serve with a minimal local web server, and future agents can verify core behavior with targeted JavaScript syntax checks, simple shape assertions, and browser smoke tests.

The tradeoff is that shared UI state, module boundaries, test harnesses, and asset processing remain intentionally minimal. If the game grows into multiple levels, ghosts, routing, persisted settings, or richer automated tests, the architecture should be revisited instead of layering framework-like complexity into the single static runtime.
