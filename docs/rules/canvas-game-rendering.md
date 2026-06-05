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
