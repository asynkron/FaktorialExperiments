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

**Batch 2** builds the maze and the core gameplay loop on top of that
foundation:

- **The maze** (`src/maze.js`) defines the classic Pac-Man board as a
  deterministic **28×31 tile grid** with typed tiles (walls, paths, pellets,
  power pellets, ghost door, ghost house, tunnels). `drawMaze()` paints the
  walls into the 224×248 buffer, and a `wrapX()` helper maps off-edge columns
  back to the opposite side so the side tunnels wrap around. The grid is the
  shared source of truth for the parallel player-movement and pellet-scoring
  slices.
- **Pellets & scoring:** eating a pellet scores 10 points; a power pellet scores
  50 and opens a timed *frightened* window (a trigger/timer reserved for the
  ghost batch to consume — no ghost behaviour lives here yet).
- Clearing every pellet wins the round and advances the level: the pellet field
  repopulates while score and lives carry over.
- An always-visible on-canvas HUD shows the score, current level, and remaining
  lives, rendered into the low-res buffer so it scales as crisp pixel art.

The pellet field is derived from the shared maze grid, so the live dots and the
walls drawn by `drawMaze()` always come from one map. All pellet, score, round,
and lives state is mutated only inside the fixed-timestep `update(dt)`;
`render()` is read-only, preserving determinism.

> Player movement is still owned by a sibling slice. Until it lands, Batch 2
> carries a small placeholder grid-stepper so pellet eating is playable: press
> **Enter** to start, then steer Pac-Man with the **arrow keys**.

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
- `src/maze.js` — shared 28×31 tile grid, tunnel `wrapX()` helper, and
  `drawMaze()` wall/pellet renderer (the single source of truth for the board).
- `src/grid.js` — DOM-free pellet field built over the shared maze grid.
- `src/pellets.js` — DOM-free scoring, lives, round logic, and the frightened
  trigger.
