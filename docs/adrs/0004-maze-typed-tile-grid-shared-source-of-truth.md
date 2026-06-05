# ADR 0004 — Maze as a parsed, typed tile grid shared across gameplay slices

- Status: Accepted
- Date: 2026-06-05
- Issue: `planitem-gh12` Batch 2 (core gameplay — maze rendering) — PR #15
- Builds on: [[0003-canvas-pixelart-render-pipeline-and-fixed-timestep-loop]]
  (the 224×248 back buffer and fixed-timestep loop this maze draws into)

## Context

Batch 2 of the `gh12` Pac-Man plan introduces the board. The plan splits the
remaining gameplay into parallel slices — maze rendering (this batch), player
movement, and pellet scoring — that all need to agree on the *same* map:
where walls are, where pellets are, where the tunnels wrap. If each slice
encoded its own copy of the layout (one for rendering, one for collision, one
for scoring) they would drift, and a wall the renderer draws would not be a wall
the movement code blocks against.

We needed one representation of the board that is simultaneously: authentic to
the arcade (28×31 tiles at 8px = the 224×248 buffer), cheap to author/edit,
and queryable by collision/movement/scoring logic — not just paintable.

## Decision

1. **Author the board as a character layout, consume it as a typed grid.**
   `src/maze.js` holds the classic maze as a 31-row × 28-char string array
   (`#` wall, `.` pellet, `o` power pellet, `=` ghost door, `G` ghost house,
   space path). A one-time `buildGrid()` parses it into a frozen 2D array of
   **named tile codes** (`TILE.WALL/PATH/PELLET/POWER_PELLET/GHOST_DOOR/`
   `GHOST_HOUSE/TUNNEL`). Authoring stays human-editable; consumers switch on
   intent (`TILE.WALL`) rather than raw characters.

2. **The parsed `grid` is the single exported source of truth.** `maze.js`
   exports `grid`, `TILE`, geometry constants, and helpers (`tileAt`, `isWall`,
   `wrapX`). The parallel player-movement and pellet-scoring slices import this
   module instead of re-deriving the map, so rendering and simulation run against
   one consistent board.

3. **Tunnels are data, and wrap is a pure helper.** Rows whose both edges are
   non-wall are tagged `TILE.TUNNEL` during parse; `wrapX(col)` maps any integer
   column onto `[0, 28)` so off-edge movement re-enters the opposite side.
   `tileAt` wraps horizontally and treats out-of-vertical-range as `WALL`, so
   collision queries near the edges and poles are total (never undefined).

4. **Walls render edge-only for the authentic look.** `drawMaze` fills a wall
   cell only when an orthogonal neighbour is non-wall (`isWallEdge`), leaving the
   interior of thick wall blocks black. This yields the classic thin-blue-outline
   maze from the same grid, with no separate "outline geometry" to maintain.

## Consequences

- Adding/moving a wall or pellet is a one-character edit in `LAYOUT`; rendering,
  collision, and scoring all update from the same change. No multi-file drift.
- Movement/scoring slices can be built in parallel against a stable API
  (`tileAt`/`isWall`/`wrapX`) without waiting on rendering internals.
- `drawMaze(ctx, elapsed)` stays a pure function of grid + time (energizers blink
  off `elapsed`); it owns no game state, consistent with the `update`/`render`
  split from ADR 0003.
- Off-grid reads are defined (vertical → WALL, horizontal → wrap), so future
  actor logic at the tunnel mouths and board border needs no special-casing.
- Cost: the layout is duplicated *conceptually* against the arcade original and
  must be kept symmetric by hand — guarded by the build-stage grid checks
  (28-wide rows, left/right symmetry, 4 power pellets, tunnel row open at both
  edges) rather than by types.
- The `=`/`G` tiles (ghost door / house) are encoded now but not yet behaviorally
  enforced; later ghost batches will consume them.
