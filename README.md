# Pac-Man

A dependency-free, static web Pac-Man built on an HTML5 `<canvas>`.

This is **Batch 1** — the game shell and render pipeline that later gameplay
batches build on:

- A single display `<canvas>` upscaled with nearest-neighbor sampling
  (`image-rendering: pixelated`) from a low-resolution (224×248) offscreen back
  buffer, so all graphics read as crisp pixel art.
- A fixed-timestep game loop (accumulator + `requestAnimationFrame`) with a
  clear `update(dt)` / `render()` split, so simulation advances deterministically
  regardless of the display refresh rate.
- A minimal game-state machine stub: `attract → playing → game-over`.

## Run locally

No build step, package manager, or framework. Either open `index.html`
directly, or serve the repo root:

```sh
python3 -m http.server
# then open http://localhost:8000
```

Press **Enter** or click the canvas to start.

## Layout

- `index.html` — entry point with the single display canvas.
- `styles.css` — arcade cabinet framing and crisp pixel upscaling.
- `src/main.js` — offscreen buffer, fixed-timestep loop, and state machine.
