# Pac-Man

A dependency-free, static web Pac-Man built on an HTML5 `<canvas>`.

The foundation (**Batch 1**) — the game shell and render pipeline that later
gameplay batches build on:

- A single display `<canvas>` upscaled with nearest-neighbor sampling
  (`image-rendering: pixelated`) from a low-resolution (224×248) offscreen back
  buffer, so all graphics read as crisp pixel art.
- A fixed-timestep game loop (accumulator + `requestAnimationFrame`) with a
  clear `update(dt)` / `render()` split, so simulation advances deterministically
  regardless of the display refresh rate.
- A minimal game-state machine stub: `attract → playing → game-over`.

**Batch 2 — maze rendering:** `src/maze.js` defines the classic Pac-Man board
as a deterministic **28×31 tile grid** with typed tiles (walls, paths, pellets,
power pellets, ghost door, ghost house, tunnels). `drawMaze()` paints the walls
and the pellet/power-pellet field into the 224×248 buffer, and a `wrapX()`
helper maps off-edge columns back to the opposite side so the side tunnels wrap
around. The grid is exported as a shared source of truth for the parallel
player-movement and pellet-scoring slices.

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
- `src/maze.js` — shared 28×31 tile grid, tunnel `wrapX()` helper, and
  `drawMaze()` wall/pellet renderer.
