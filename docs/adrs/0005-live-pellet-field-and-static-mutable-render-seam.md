# ADR 0005 — Live pellet field derived from the shared grid, and the static/mutable render seam

- Status: Accepted
- Date: 2026-06-05
- Issue: `planitem-gh12` Batch 2 (core gameplay — pellets, scoring, round logic, HUD) — PR #16
- Builds on: [[0004-maze-typed-tile-grid-shared-source-of-truth]] (the shared
  maze grid this pellet field is projected from) and
  [[0003-canvas-pixelart-render-pipeline-and-fixed-timestep-loop]] (the
  `update`/`render` split the scoring system lives inside)

## Context

This batch layers the core gameplay loop — pellet eating, scoring (10 / 50),
lives, level/round advance, and an on-canvas HUD — onto the Batch 1 canvas shell.
Two facts shaped the design:

1. **Pellets are mutable; the maze is static.** The board (walls, ghost house,
   tunnels) never changes during a round, and `drawMaze` already paints the dots
   as part of the static frame ([[0004-maze-typed-tile-grid-shared-source-of-truth]]).
   But during play, dots must *disappear* as they are eaten. A static
   frame-renderer cannot express that; a live, mutable pellet layer must own the
   dots while they are being consumed.

2. **This slice was built in parallel with the maze slice, off the Batch 1
   branch, before the maze grid was guaranteed on a common base.** Per
   [[multi-batch-plan-execution]] the build based on the Batch 1 foundation, but
   could not assume `src/maze.js` (the shared grid, PR #15) was already present.
   The pellet/scoring logic had to be authorable and unit-testable in isolation,
   yet must not become a *second* source of truth for the board geometry
   (the drift hazard [[0004-maze-typed-tile-grid-shared-source-of-truth]] exists
   to prevent).

## Decision

1. **Keep scoring/round logic DOM-free in its own modules.** `src/grid.js`
   (tile grid + mutable pellet field) and `src/pellets.js` (scoring, lives,
   level/round, frightened trigger+timer) hold no canvas/browser references, so
   round rules stay deterministic and Node-importable for assertions.

2. **The running app derives the pellet field from the shared grid, not from a
   private layout.** `main.js` projects the canonical `mazeGrid`
   (`src/maze.js`) into a character layout via a `TILE → char` map and feeds that
   to `createPelletField(layout)`. So the live dots and the walls `drawMaze`
   paints come from one map. The placeholder `MAZE` exported by `grid.js` is a
   **standalone-test default only** (`createPelletField(layout = MAZE)`) — it
   keeps the module runnable in isolation but is never the source the app uses.

3. **Reconcile the static renderer and the live layer with a `withPellets`
   flag — the static/mutable render seam.** `drawMaze(ctx, elapsed, withPellets =
   true)` paints dots in non-gameplay states (the ATTRACT backdrop) but is called
   with `withPellets = false` during PLAYING, where the mutable pellet field
   draws the dots on top instead. Exactly one layer owns the dots in any given
   state, so eaten pellets vanish and nothing is double-drawn.

4. **Reserve seams for later batches without implementing their behaviour.** The
   power pellet opens a `frightened` trigger + timer (exposed as
   `isFrightened`/`frightenedTimer`) and `loseLife()`/`resetAll()` hooks exist,
   but there is no ghost behaviour here — the ghost batch consumes these.

## Consequences

- The live pellet layer and the wall render provably agree on the board: both
  trace back to the single `src/maze.js` grid. No second map to drift.
- All score/lives/level mutation lives in `update(dt)`/`eat`/`advanceLevel`;
  `render()` stays read-only (the power-pellet blink is derived read-only from
  `elapsed`), preserving the determinism contract from ADR 0003.
- The static/mutable seam generalizes: whenever a static frame-renderer and a
  live stateful layer would paint the same element, gate the static one with a
  flag and let the live layer own it in the active state, rather than deleting
  the element from the static renderer (which breaks the attract/backdrop view)
  or letting both draw (double-paint, and eaten state reappears).
- **Reconciliation debt:** `grid.js` still ships a placeholder `MAZE` that
  conceptually duplicates the board. It is unused by the app (default arg only),
  but a future standalone caller of `createPelletField()` with no argument would
  get a *frozen copy* of the geometry that will not track edits to `src/maze.js`.
  When a later batch can guarantee the shared grid is always present, the
  placeholder should be removed (or made to import `maze.js`) so there is truly
  one layout in the tree. Tracked as a follow-up, not silently left as a latent
  second source. See [[multi-batch-plan-execution]].
- The minimal arrow-key grid-stepper in `main.js` is a stand-in for the
  player-movement sibling so eating is playable now; wall collision and real
  movement remain that sibling's responsibility.
