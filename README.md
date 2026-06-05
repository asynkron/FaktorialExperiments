# Pac-Man

A dependency-free, static web Pac-Man built on an HTML5 `<canvas>`.

**Batch 1** delivered the game shell and render pipeline that later gameplay
batches build on:

- A single display `<canvas>` upscaled with nearest-neighbor sampling
  (`image-rendering: pixelated`) from a low-resolution (224×248) offscreen back
  buffer, so all graphics read as crisp pixel art.
- A fixed-timestep game loop (accumulator + `requestAnimationFrame`) with a
  clear `update(dt)` / `render()` split, so simulation advances deterministically
  regardless of the display refresh rate.
- A minimal game-state machine stub: `attract → playing → game-over`.

**Batch 2** adds the core gameplay loop on top of that foundation:

- Eating a pellet scores 10 points; a power pellet scores 50 and opens a
  timed *frightened* window (a trigger/timer reserved for the ghost batch to
  consume — no ghost behaviour lives here yet).
- Clearing every pellet wins the round and advances the level: the pellet field
  repopulates while score and lives carry over.
- An always-visible on-canvas HUD shows the score, current level, and remaining
  lives, rendered into the low-res buffer so it scales as crisp pixel art.

All pellet, score, round, and lives state is mutated only inside the
fixed-timestep `update(dt)`; `render()` is read-only, preserving determinism.

> Player movement and the maze walls are owned by sibling slices. Until those
> land, Batch 2 carries a small placeholder grid-stepper so pellet eating is
> playable: press **Enter** to start, then steer Pac-Man with the **arrow keys**.

## Run locally

No build step, package manager, or framework. Either open `index.html`
directly, or serve the repo root:

```sh
python3 -m http.server
# then open http://localhost:8000
```

Press **Enter** or click the canvas to start, then steer with the **arrow keys**.

## Layout

- `index.html` — entry point with the single display canvas.
- `styles.css` — arcade cabinet framing and crisp pixel upscaling.
- `src/main.js` — offscreen buffer, fixed-timestep loop, state machine, and the
  gameplay/HUD wiring.
- `src/grid.js` — DOM-free tile grid + pellet field (placeholder maze layout,
  swapped for the maze slice's grid when it lands).
- `src/pellets.js` — DOM-free scoring, lives, round logic, and the frightened
  trigger.
