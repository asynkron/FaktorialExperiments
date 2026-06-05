# ADR 0003 — Canvas pixel-art render pipeline and fixed-timestep loop

- Status: Accepted
- Date: 2026-06-05
- Issue: `planitem-gh12` Batch 1 (game shell and render pipeline) — PR #13
- Supersedes: the DOM/tile-grid static Pac-Man direction (ADR for the static app
  and all prior `docs/` artifacts were removed in `1ce6b8b "Remove static
  experiment files"`; this ADR re-establishes the architecture from a clean slate)

## Context

Batch 1 is the foundation slice of the `gh12` Pac-Man plan. After `1ce6b8b` the
repo was a clean slate (only `.gitignore` tracked), so the earlier DOM-based,
tile-grid static implementation no longer exists. The plan also commits us to
**deterministic** ghost behaviour (prior issues #9/#10 documented deterministic
ghost rules), which constrains how the game loop must advance time.

We needed to choose, once, the rendering and timing substrate that every later
batch (maze, actors, ghosts, scoring) builds on, rather than letting each batch
improvise.

## Decision

1. **Canvas, not DOM.** Render through a single HTML `<canvas>` instead of
   positioned DOM elements. This is a deliberate pivot from the removed static
   tile-grid app.

2. **Two-resolution pixel-art pipeline.** Draw all gameplay into a low-res
   offscreen back buffer at the native arcade resolution (28×31 tiles × 8px =
   **224×248**), then blit it onto a display canvas that is an integer (2×)
   multiple (**448×496**). The integer scale keeps the upscale a clean
   nearest-neighbor enlargement.

3. **Nearest-neighbor upscaling enforced on both layers.** Disable smoothing on
   the destination 2D context (`imageSmoothingEnabled = false`) *and* set CSS
   `image-rendering: pixelated` (with `-moz-crisp-edges` / `crisp-edges`
   fallbacks). Neither alone is sufficient — see [[canvas-game-rendering]].

4. **Fixed-timestep accumulator loop.** Drive the loop with
   `requestAnimationFrame`, accumulate real elapsed time, and step the simulation
   in fixed `1/60s` ticks with a clear `update(dt)` / `render()` split. Clamp any
   single frame delta to `MAX_FRAME_TIME` (0.25s) to avoid a spiral of death
   after a backgrounded tab. This makes simulation advance deterministically and
   independently of the display refresh rate — a prerequisite for the
   deterministic ghost rules.

5. **Explicit game-state machine.** `attract → playing → game-over`, with input
   (Enter/Space/pointer) and stubbed auto-advance transitions so the full path is
   exercisable before gameplay exists.

## Consequences

- Later batches draw into the 224×248 buffer in native pixels and never touch
  display-scale math; the blit is centralised in `render()`.
- Determinism is structural: gameplay logic only ever sees fixed `STEP` deltas,
  so ghost/actor logic added later can rely on reproducible tick counts.
- The display canvas is dependency-free (no engine/library), consistent with the
  project's static-root, no-build convention.
- Cost: a small per-frame `drawImage` blit and an extra offscreen canvas — a
  negligible price for crisp, refresh-rate-independent rendering.
- The state-machine auto-advance timers in Batch 1 are stubs and will be replaced
  by real win/lose conditions in later batches.
