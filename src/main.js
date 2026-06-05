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
// Batch 2 adds the maze: src/maze.js owns the shared 28x31 tile grid and paints
// the walls + pellet field into this buffer. The loop and state machine below
// are unchanged — render() just draws the maze before the state overlays.

import { drawMaze } from "./maze.js";

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

  const game = {
    state: State.ATTRACT,
    elapsed: 0, // seconds spent in the current state, for stub timing/animation
  };

  function setState(next) {
    game.state = next;
    game.elapsed = 0;
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
    }
  }

  window.addEventListener("keydown", onKeyDown);
  displayCanvas.addEventListener("pointerdown", start);

  // --- Update: advance simulation by a fixed dt -----------------------------
  function update(dt) {
    game.elapsed += dt;

    switch (game.state) {
      case State.ATTRACT:
        // Idle attract loop; waits for input to start. (Gameplay arrives in
        // later batches.)
        break;
      case State.PLAYING:
        // Placeholder play stub: auto-advance to game-over after a few seconds
        // so the full state path is exercisable without gameplay wired up yet.
        if (game.elapsed >= 5) {
          setState(State.GAME_OVER);
        }
        break;
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
        // The maze is the play field; gameplay actors arrive in later slices.
        drawMaze(ctx, game.elapsed);
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
