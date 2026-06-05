# Canvas / game-loop rules

Conventions for the canvas-based Pac-Man render pipeline established in Batch 1
(`planitem-gh12`, PR #13). See [[0003-canvas-pixelart-render-pipeline-and-fixed-timestep-loop]].

## 1. Pixel-art upscaling needs BOTH context smoothing OFF and CSS `image-rendering`

When upscaling a low-res back buffer to the display canvas, you must set **both**:

- `ctx.imageSmoothingEnabled = false` on the *destination* 2D context, and
- CSS `image-rendering: pixelated;` (plus `-moz-crisp-edges` / `crisp-edges`
  fallbacks) on the display canvas element.

**WHY:** They control two different scaling steps. `imageSmoothingEnabled`
governs the interpolation `drawImage` performs when it scales the buffer *into*
the canvas's backing store; `image-rendering` governs how the browser scales the
canvas *element's* backing store to its CSS box. If either is omitted the image
is bilinearly interpolated and the pixel art goes blurry. The CSS rule alone is a
common mistake because the canvas still looks scaled — but `drawImage` already
smoothed it before CSS ran.

**Incident:** Batch 1 render pipeline (PR #13). The comment in `src/main.js`
(`render()`) explicitly documents this dual requirement so it is not "cleaned up"
into a single setting later.

## 2. Game loop must be a fixed-timestep accumulator with a delta clamp

Simulation must advance in fixed `STEP` (1/60s) ticks via an accumulator, driven
by `requestAnimationFrame`, with a strict `update(dt)` / `render()` split. Clamp
any single frame's elapsed time to `MAX_FRAME_TIME` (0.25s) before feeding the
accumulator.

**WHY (determinism):** The plan requires deterministic ghost behaviour (issues
#9/#10). Variable delta-time stepping makes actor movement depend on the
display's refresh rate, so two machines diverge and ghost logic cannot be
reproducible. Fixed steps guarantee gameplay only ever sees identical `dt`
values.

**WHY (the clamp):** Without clamping, a backgrounded tab returns a multi-second
delta; the `while (accumulator >= STEP)` catch-up loop then runs hundreds of
ticks in one frame — a "spiral of death" that locks the page. Clamping caps the
catch-up work.

**Do not** reintroduce variable/delta-time movement (`pos += speed * dt`) in
later batches for gameplay actors; keep gameplay on the fixed tick.

## 3. Keep display scaling an integer multiple of the buffer

The back buffer is 224×248 (native arcade res); the display canvas is 448×496
(exactly 2×). **WHY:** integer scaling keeps every source pixel mapped to an
equal block of destination pixels, so nearest-neighbor upscaling has no uneven
"fat pixel" artifacts. Pick integer multiples for any future resolution change.

## 4. The maze grid is the single source of truth — import it, don't re-derive it

The board lives once, in `src/maze.js`: a character `LAYOUT` parsed into a frozen
`grid` of typed `TILE` codes, exported alongside `tileAt` / `isWall` / `wrapX`.
Any slice that needs to know where walls, pellets, or tunnels are (rendering,
player movement, ghost AI, pellet scoring) **imports this module** — it never
hard-codes coordinates or keeps a private copy of the layout.

**WHY:** the `gh12` plan builds gameplay as parallel slices that must agree on the
same map. A second copy of the layout drifts from the first, so a wall the
renderer draws stops matching a wall the collision code blocks against. One parsed
grid keeps render and simulation provably consistent. **Incident:** Batch 2 maze
rendering (PR #15) — `src/maze.js` was deliberately exported as the shared board
so the parallel movement/scoring slices consume it. See
[[0004-maze-typed-tile-grid-shared-source-of-truth]].

Corollaries when editing the board:

- **Author by character, consume by `TILE` enum.** Switch on `TILE.WALL`, not on
  the raw `"#"` — the character layout is an authoring convenience, not the API.
- **Keep grid queries total.** `tileAt` treats out-of-vertical-range as `WALL` and
  wraps horizontally via `wrapX`; off-edge reads must stay defined so actor logic
  at the tunnel mouths and board border needs no special-casing. Don't index
  `grid[row][col]` raw in movement code — go through `tileAt`/`isWall`.
- **Tunnels are data + a pure wrap.** A horizontal wrap is `wrapX(col)`
  (`((col % COLS) + COLS) % COLS`), correct for any integer, not an `if (col < 0)`
  special case. Tunnel tiles are tagged at parse time so movement can detect a
  wrap is in play.
- **Walls render edge-only.** Fill a wall cell only when an orthogonal neighbour
  is non-wall (`isWallEdge`); interiors of thick blocks stay black. This is what
  produces the thin-blue-outline look from the grid — don't "simplify" it into
  filling every wall tile (you get solid blue slabs) or maintain separate outline
  geometry (it drifts from the grid).
- **Guard board invariants with deterministic checks, not types.** The layout's
  symmetry/counts (every row 28 wide, left/right wall symmetry, exactly 4 power
  pellets, tunnel row open at both edges) are hand-maintained; verify them with a
  quick script at build time rather than trusting visual inspection.
- **A live, mutable layer derives from the grid; it does not become a second
  copy.** The pellet/scoring slice (Batch 2, PR #16) needs a *mutable* dot field
  (dots disappear as they are eaten), but it builds that field by projecting the
  shared `src/maze.js` grid into a layout (`TILE → char`) and handing it to
  `createPelletField(layout)` — it does not hard-code its own board. Any
  placeholder layout a gameplay module exports for standalone testing is a
  **test default only** (e.g. `createPelletField(layout = MAZE)`); the running app
  must pass the canonical grid. Note the drift hazard: a frozen placeholder will
  not track edits to `src/maze.js`, so remove or re-point it at the shared grid
  once a later batch can guarantee the grid is present.
  See [[0005-live-pellet-field-and-static-mutable-render-seam]].

## 5. Static-vs-mutable render seam: gate the static renderer, let the live layer own it

When a static frame-renderer and a live, mutable layer would both paint the **same
visual element** (here: the maze dots — `drawMaze` paints them in the static frame,
the pellet field paints them during play), do **not** delete the element from the
static renderer and do **not** let both draw it. Instead give the static renderer a
flag (`drawMaze(ctx, elapsed, withPellets = true)`) and call it with the element
**off** in the state where the live layer owns it:

- `withPellets = true` for the ATTRACT/backdrop view → the static renderer shows a
  complete board.
- `withPellets = false` during PLAYING → the mutable pellet field draws the dots on
  top, so eaten ones vanish.

**WHY:** exactly one layer owns the element per state. Deleting it from the static
renderer breaks the attract/backdrop frame (no dots to show); letting both draw it
double-paints and makes eaten dots reappear under the static copy. The flag keeps a
single static renderer reusable across states without forking it.

**Incident:** Batch 2 pellets/scoring (PR #16) — `render()` calls
`drawMaze(ctx, elapsed)` in ATTRACT and `drawMaze(ctx, elapsed, false)` in PLAYING.
See [[0005-live-pellet-field-and-static-mutable-render-seam]].
