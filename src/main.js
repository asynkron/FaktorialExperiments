// Pac-Man — game shell and render pipeline (Batch 1 foundation).
//
// This module establishes the rendering and timing foundation every later
// batch builds on:
//   * a low-resolution offscreen back buffer upscaled with nearest-neighbor
//     sampling so all graphics read as crisp pixel art;
//   * a fixed-timestep accumulator loop driven by requestAnimationFrame with a
//     clear update(dt) / render() split, so game logic advances deterministically
//     regardless of the display's refresh rate;
//   * a minimal game-state machine stub: attract -> playing -> game-over.
//
// Batch 2 brings the maze and the core gameplay loop together. src/maze.js owns
// the shared 28x31 tile grid and paints the walls into this buffer; the pellet
// field is derived from that same grid so the live dots stay consistent with the
// walls. Eating pellets and power pellets scores points, clearing the board wins
// the round and advances the level, and an on-canvas HUD surfaces score and
// lives. All of that state lives inside update(dt) so the simulation stays
// deterministic; render() only reads.

import { grid as mazeGrid, TILE, drawMaze } from "./maze.js";
import { TILE_SIZE, createPelletField } from "./grid.js";
import { createPelletSystem } from "./pellets.js";

// Project the shared maze grid (the single source of truth) into the character
// layout the pellet field consumes, so the live pellets and the walls painted by
// drawMaze() come from one consistent map.
const TILE_TO_CHAR = {
  [TILE.WALL]: "#",
  [TILE.GHOST_DOOR]: "-",
  [TILE.PELLET]: ".",
  [TILE.POWER_PELLET]: "o",
};
const MAZE_LAYOUT = mazeGrid.map((row) =>
  row.map((tile) => TILE_TO_CHAR[tile] ?? " ").join(""),
);

// --- Resolution -------------------------------------------------------------
// Native arcade buffer is 28x31 tiles of 8px = 224x248. The display canvas is
// an integer (2x) multiple, so the upscale stays a clean nearest-neighbor blit.
const BUFFER_WIDTH = 224;
const BUFFER_HEIGHT = 248;

// --- Fixed timestep ---------------------------------------------------------
const STEP = 1 / 60; // seconds per simulation tick
const MAX_FRAME_TIME = 0.25; // clamp big deltas (e.g. backgrounded tab) to avoid a spiral of death

// --- Game states ------------------------------------------------------------
const State = Object.freeze({
  ATTRACT: "attract",
  PLAYING: "playing",
  GAME_OVER: "game-over",
});

// --- Player placeholder -----------------------------------------------------
// Smooth, tile-aligned player movement is owned by the parallel "player
// movement" sibling slice. To exercise pellet eating before that lands, this
// slice carries a deliberately minimal grid-stepping harness: Pac-Man advances
// one tile per MOVE_INTERVAL in the current arrow-key direction when the target
// tile is open. It is decoupled enough to be swapped out wholesale once the real
// movement slice merges — none of the pellet/score/round logic depends on it.
const MOVE_INTERVAL = 0.11; // seconds per tile step
const PAC_START = Object.freeze({ col: 13, row: 23 }); // open path between the lower pellet rows

const DIRECTIONS = Object.freeze({
  ArrowUp: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
});

function createGame(displayCanvas) {
  const display = displayCanvas.getContext("2d");

  // Offscreen low-resolution back buffer. All gameplay draws happen here at
  // native pixel scale; render() blits it onto the display canvas.
  const buffer = document.createElement("canvas");
  buffer.width = BUFFER_WIDTH;
  buffer.height = BUFFER_HEIGHT;
  const ctx = buffer.getContext("2d");

  // Disable smoothing on the destination context so the upscale is a hard,
  // nearest-neighbor enlargement (the CSS image-rendering rule alone is not
  // enough — drawImage would otherwise interpolate).
  display.imageSmoothingEnabled = false;

  // Pellet field (tile grid) and the score/lives/round system built on it. Kept
  // DOM-free in their own modules so all gameplay state stays deterministic.
  const field = createPelletField(MAZE_LAYOUT);
  const pellets = createPelletSystem(field);

  // Placeholder player. col/row is the tile it last entered; dir is the live
  // direction, queuedDir the next requested turn applied when its tile is open.
  const pac = {
    col: PAC_START.col,
    row: PAC_START.row,
    dir: null,
    queuedDir: null,
    moveTimer: 0,
    mouth: 0, // animation phase, advanced in update so it stays deterministic
  };

  function resetPlayer() {
    pac.col = PAC_START.col;
    pac.row = PAC_START.row;
    pac.dir = null;
    pac.queuedDir = null;
    pac.moveTimer = 0;
  }

  const game = {
    state: State.ATTRACT,
    elapsed: 0, // seconds spent in the current state, for stub timing/animation
    pellets,
    field,
    pac,
  };

  function setState(next) {
    game.state = next;
    game.elapsed = 0;
    if (next === State.PLAYING) {
      // Fresh run: repopulate the board and reset score/lives/level.
      pellets.resetAll();
      resetPlayer();
    }
  }

  // --- Input: drive the state-machine transitions ---------------------------
  function start() {
    if (game.state === State.ATTRACT || game.state === State.GAME_OVER) {
      setState(State.PLAYING);
    }
  }

  function onKeyDown(event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      start();
      return;
    }
    // Queue a turn for the placeholder player. The move itself is applied on the
    // fixed tick (update), never here, so input cannot desync the simulation.
    const dir = DIRECTIONS[event.key];
    if (dir) {
      event.preventDefault();
      pac.queuedDir = dir;
      if (!pac.dir) pac.dir = dir; // first input gets Pac-Man moving
    }
  }

  window.addEventListener("keydown", onKeyDown);
  displayCanvas.addEventListener("pointerdown", start);

  // --- Update: advance simulation by a fixed dt -----------------------------
  // Step the placeholder player one tile in its current direction if the target
  // tile is open, honouring a queued turn and the horizontal tunnel wrap. Eating
  // happens on entry to the new tile. Movement is purely grid-based here; the
  // real player-movement slice replaces this without touching pellet logic.
  function stepPlayer() {
    // Apply a queued turn if its target tile is walkable.
    if (pac.queuedDir) {
      const nc = pac.col + pac.queuedDir.dx;
      const nr = pac.row + pac.queuedDir.dy;
      if (field.isWalkable(nc, nr)) {
        pac.dir = pac.queuedDir;
        pac.queuedDir = null;
      }
    }
    if (!pac.dir) return;

    let nc = pac.col + pac.dir.dx;
    let nr = pac.row + pac.dir.dy;

    // Horizontal tunnel wrap (the row-14 corridor exits each side of the board).
    if (nc < 0) nc = field.cols - 1;
    else if (nc >= field.cols) nc = 0;

    if (!field.isWalkable(nc, nr)) {
      return; // blocked by a wall; hold position until a new direction opens up
    }

    pac.col = nc;
    pac.row = nr;
    pellets.eat(pac.col, pac.row);
  }

  function update(dt) {
    game.elapsed += dt;

    switch (game.state) {
      case State.ATTRACT:
        // Idle attract loop; waits for input to start.
        break;
      case State.PLAYING: {
        pellets.update(dt);
        pac.mouth = (pac.mouth + dt * 6) % 1; // deterministic chomp animation

        // Discrete tile stepping on a fixed cadence.
        pac.moveTimer += dt;
        while (pac.moveTimer >= MOVE_INTERVAL) {
          pac.moveTimer -= MOVE_INTERVAL;
          stepPlayer();
        }

        // Round cleared: advance to the next level, keeping score and lives.
        if (pellets.isRoundComplete()) {
          pellets.advanceLevel();
          resetPlayer();
        }
        break;
      }
      case State.GAME_OVER:
        // Return to the attract screen after a short delay.
        if (game.elapsed >= 3) {
          setState(State.ATTRACT);
        }
        break;
    }
  }

  // --- Render: draw the back buffer, then blit it upscaled ------------------
  function drawCenteredText(text, y, color) {
    ctx.fillStyle = color;
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, BUFFER_WIDTH / 2, y);
  }

  // Pixel centre of a tile (cols/rows are 0-based, tiles TILE_SIZE wide).
  function tileCenterX(col) {
    return col * TILE_SIZE + TILE_SIZE / 2;
  }
  function tileCenterY(row) {
    return row * TILE_SIZE + TILE_SIZE / 2;
  }

  // Draw the remaining pellets. Walls are the maze slice's responsibility; this
  // slice only paints the pellet layer it owns (plus the player and HUD).
  function drawPellets() {
    // Power pellets blink ~4 Hz; derive the phase from elapsed (read-only).
    const powerVisible = Math.floor(game.elapsed * 4) % 2 === 0;
    field.forEachPellet((col, row, kind) => {
      const x = tileCenterX(col);
      const y = tileCenterY(row);
      if (kind === "power") {
        if (!powerVisible) return;
        ctx.fillStyle = "#ffb8de";
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = "#ffb8de";
        ctx.fillRect(x - 1, y - 1, 2, 2);
      }
    });
  }

  // Draw the placeholder Pac-Man as a chomping yellow disc facing its direction.
  function drawPlayer() {
    const x = tileCenterX(pac.col);
    const y = tileCenterY(pac.row);
    const radius = TILE_SIZE / 2 + 1;
    // Mouth opening swings 0..~0.35 turns and back via a triangle wave.
    const open = Math.abs(pac.mouth - 0.5) * 2 * 0.35 * Math.PI;
    const facing = pac.dir || DIRECTIONS.ArrowRight;
    const angle = Math.atan2(facing.dy, facing.dx);

    ctx.fillStyle = "#ffe100";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, radius, angle + open, angle - open + Math.PI * 2);
    ctx.closePath();
    ctx.fill();
  }

  // On-canvas HUD: score (top-left), level (top-right), lives (bottom-left).
  // Drawn into the low-res buffer so it scales as crisp pixel art with the rest.
  function drawHud() {
    ctx.font = "7px monospace";
    ctx.textBaseline = "top";

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.fillText("SCORE " + pellets.score, 4, 1);

    ctx.fillStyle = "#ffcf00";
    ctx.textAlign = "right";
    ctx.fillText("LEVEL " + pellets.level, BUFFER_WIDTH - 4, 1);

    // Lives as small Pac icons along the bottom band (row 30 is solid wall, so
    // it never collides with pellets).
    const ly = BUFFER_HEIGHT - 6;
    for (let i = 0; i < pellets.lives; i += 1) {
      const lx = 6 + i * 10;
      ctx.fillStyle = "#ffe100";
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.arc(lx, ly, 4, 0.25 * Math.PI, 1.75 * Math.PI);
      ctx.closePath();
      ctx.fill();
    }
  }

  function render() {
    // Clear the low-res buffer.
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, BUFFER_WIDTH, BUFFER_HEIGHT);

    switch (game.state) {
      case State.ATTRACT:
        // Show the board as a backdrop, with the title/prompt overlaid.
        drawMaze(ctx, game.elapsed);
        drawCenteredText("PAC-MAN", BUFFER_HEIGHT / 2 - 16, "#ffcf00");
        // Blink the prompt roughly twice per second.
        if (Math.floor(game.elapsed * 2) % 2 === 0) {
          drawCenteredText("PRESS ENTER", BUFFER_HEIGHT / 2 + 12, "#ffffff");
        }
        break;
      case State.PLAYING:
        // Maze walls are the play field; the live pellet layer, player, and HUD
        // draw on top. drawMaze paints walls only here (withPellets=false) — the
        // mutable pellet field below owns the dots so eaten ones disappear.
        drawMaze(ctx, game.elapsed, false);
        drawPellets();
        drawPlayer();
        drawHud();
        break;
      case State.GAME_OVER:
        drawCenteredText("GAME OVER", BUFFER_HEIGHT / 2, "#ff0000");
        break;
    }

    // Blit the low-res buffer onto the display canvas, scaled to fill it.
    display.imageSmoothingEnabled = false;
    display.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
    display.drawImage(
      buffer,
      0,
      0,
      BUFFER_WIDTH,
      BUFFER_HEIGHT,
      0,
      0,
      displayCanvas.width,
      displayCanvas.height,
    );
  }

  // --- Main loop: fixed-timestep accumulator --------------------------------
  let lastTime = null;
  let accumulator = 0;

  function frame(now) {
    if (lastTime === null) {
      lastTime = now;
    }
    let frameTime = (now - lastTime) / 1000; // ms -> seconds
    lastTime = now;

    // Clamp to avoid a spiral of death after the tab was backgrounded.
    if (frameTime > MAX_FRAME_TIME) {
      frameTime = MAX_FRAME_TIME;
    }

    accumulator += frameTime;
    while (accumulator >= STEP) {
      update(STEP);
      accumulator -= STEP;
    }

    render();
    requestAnimationFrame(frame);
  }

  return {
    start: () => requestAnimationFrame(frame),
    // Exposed for inspection/testing of the state machine.
    _game: game,
  };
}

function boot() {
  const canvas = document.getElementById("game");
  if (!canvas) {
    return;
  }
  const game = createGame(canvas);
  game.start();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
