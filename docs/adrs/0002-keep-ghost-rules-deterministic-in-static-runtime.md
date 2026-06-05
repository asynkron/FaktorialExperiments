# ADR 0002: Keep ghost rules deterministic in the static runtime

## Status

Accepted

## Context

Issue `planitem-gh5-batch-1-static-web-app-scaffold-batch-3-ghosts-game-states-and-rules-6c6f788f22` added ghosts, lives, collision handling, restart behavior, and win or loss states to the dependency-free Pacman experiment.

The app still has no package manager, test framework, game engine, seeded random helper, or build pipeline. The delivery needed behavior that could be verified with `node --check`, `make quality`, and a browser smoke run against a local static server.

## Decision

Keep ghost movement and game-state rules deterministic inside `src/main.js` while the app remains a single static runtime:

- Ghosts start from fixed spawn positions and reset to those positions after a lost life or full restart.
- Movement uses the maze grid, current direction, reverse-direction avoidance, player distance, score, remaining pellets, and ghost index instead of randomness.
- Terminal states (`won` and `lost`) stop movement, clear pending direction, and surface the restart path through both keyboard and button controls.
- Browser smoke checks should exercise observable DOM state, marker transforms, restart reset, collision life loss, and repeated collision game-over behavior.

Do not introduce random ghost behavior, a game engine, or a test framework for this slice unless a later issue needs richer AI, replay support, or broader automated coverage.

## Consequences

The game remains lightweight and easy to verify from the static root. Deterministic ghost rules make collision, reset, and terminal-state behavior repeatable enough for smoke tests without adding dependencies.

The tradeoff is that ghost behavior is intentionally simple and predictable. If later work needs arcade-like personality, seeded randomness, pathfinding, levels, or reusable rule tests, the runtime should be split into testable game-state helpers before increasing the complexity of `src/main.js`.
