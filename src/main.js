const mazeTemplate = [
  "###################",
  "#P........#.......#",
  "#.###.###.#.###.#.#",
  "#.....#.......#...#",
  "###.#.#.#####.#.###",
  "#...#.....#.....#.#",
  "#.#####.#.#.#####.#",
  "#.......#.#.......#",
  "#.###.###.###.###.#",
  "#...#.........#...#",
  "###.#.##   ##.#.###",
  "#...#.........#...#",
  "#.###.###.###.###.#",
  "#.......#.#.......#",
  "#.#####.#.#.#####.#",
  "#.#.....#.....#...#",
  "###.#.#####.#.#.###",
  "#...#.......#.....#",
  "#.#.###.#.###.###.#",
  "#.......#.........#",
  "###################",
];

const directionVectors = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const keyToDirection = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
};

const initialGhosts = [
  { id: "blinky", name: "Blinky", x: 9, y: 10, direction: "left", color: "red" },
  { id: "pinky", name: "Pinky", x: 10, y: 10, direction: "right", color: "pink" },
  { id: "inky", name: "Inky", x: 9, y: 11, direction: "up", color: "cyan" },
];

const boardElement = document.querySelector("#game-board");
const gridElement = document.querySelector("#maze-grid");
const playerElement = document.querySelector("#player");
const ghostLayerElement = document.querySelector("#ghost-layer");
const scoreElement = document.querySelector("#score");
const pelletsElement = document.querySelector("#pellets");
const livesElement = document.querySelector("#lives");
const statusElement = document.querySelector("#game-status");
const messageElement = document.querySelector("#game-message");
const messageTitleElement = document.querySelector("#message-title");
const messageCopyElement = document.querySelector("#message-copy");
const restartButton = document.querySelector("#restart-button");
const directionButtons = [...document.querySelectorAll("[data-direction]")];

const rows = mazeTemplate.length;
const columns = mazeTemplate[0].length;
const state = {
  score: 0,
  totalPellets: 0,
  remainingPellets: 0,
  position: { x: 1, y: 1 },
  spawnPosition: { x: 1, y: 1 },
  direction: null,
  nextDirection: null,
  lastStepTime: 0,
  stepDuration: 125,
  ghostStepDuration: 250,
  ghostStepCounter: 0,
  ghosts: [],
  lives: 3,
  won: false,
  lost: false,
  pausedUntil: 0,
};

let grid = [];

function assertMazeShape() {
  const invalidRow = mazeTemplate.find((row) => row.length !== columns);

  if (invalidRow) {
    throw new Error(`Maze rows must all be ${columns} columns wide.`);
  }
}

function initializeGame() {
  if (
    !boardElement ||
    !gridElement ||
    !playerElement ||
    !ghostLayerElement ||
    !scoreElement ||
    !pelletsElement ||
    !livesElement ||
    !statusElement ||
    !messageElement ||
    !messageTitleElement ||
    !messageCopyElement ||
    !restartButton
  ) {
    return;
  }

  assertMazeShape();
  boardElement.style.setProperty("--columns", columns);
  boardElement.style.setProperty("--rows", rows);
  resetGame();
  restartButton.addEventListener("click", resetGame);
  directionButtons.forEach((button) => {
    button.addEventListener("click", () => queueDirection(button.dataset.direction));
  });
  document.addEventListener("keydown", handleKeyDown);
  window.addEventListener("resize", updateMarkers);
  requestAnimationFrame(gameLoop);
}

function resetGame() {
  grid = mazeTemplate.map((row) => [...row]);
  state.score = 0;
  state.totalPellets = 0;
  state.remainingPellets = 0;
  state.direction = null;
  state.nextDirection = null;
  state.lastStepTime = 0;
  state.ghostStepCounter = 0;
  state.lives = 3;
  state.won = false;
  state.lost = false;
  state.pausedUntil = 0;
  state.ghosts = initialGhosts.map((ghost) => ({ ...ghost }));
  renderMaze();
  collectPelletAt(state.position);
  updateHud();
  updateMarkers();
  hideMessage();
  boardElement.focus({ preventScroll: true });
}

function renderMaze() {
  const fragment = document.createDocumentFragment();

  grid.forEach((row, y) => {
    row.forEach((cell, x) => {
      const tile = document.createElement("div");
      tile.className = "cell";
      tile.dataset.x = String(x);
      tile.dataset.y = String(y);

      if (cell === "#") {
        tile.classList.add("wall");
      } else {
        if (cell === "P") {
          state.position = { x, y };
          state.spawnPosition = { x, y };
          grid[y][x] = " ";
        }

        if (grid[y][x] === ".") {
          tile.classList.add("pellet");
          state.totalPellets += 1;
        }
      }

      fragment.append(tile);
    });
  });

  state.remainingPellets = state.totalPellets;
  gridElement.replaceChildren(fragment);
  renderGhosts();
}

function renderGhosts() {
  const fragment = document.createDocumentFragment();

  state.ghosts.forEach((ghost) => {
    const marker = document.createElement("div");
    marker.className = `ghost-marker ${ghost.color}`;
    marker.dataset.ghostId = ghost.id;
    marker.title = ghost.name;
    fragment.append(marker);
  });

  ghostLayerElement.replaceChildren(fragment);
}

function gameLoop(timestamp) {
  if (!state.lastStepTime) {
    state.lastStepTime = timestamp;
  }

  if (isPlaying() && timestamp >= state.pausedUntil && timestamp - state.lastStepTime >= state.stepDuration) {
    stepPlayer();
    state.ghostStepCounter += state.stepDuration;

    if (state.ghostStepCounter >= state.ghostStepDuration) {
      stepGhosts();
      state.ghostStepCounter = 0;
    }

    checkGhostCollision();
    state.lastStepTime = timestamp;
  }

  requestAnimationFrame(gameLoop);
}

function stepPlayer() {
  if (!state.nextDirection && !state.direction) {
    return;
  }

  if (canMove(state.nextDirection, state.position)) {
    state.direction = state.nextDirection;
  }

  if (!canMove(state.direction, state.position)) {
    statusElement.textContent = "Blocked";
    return;
  }

  const vector = directionVectors[state.direction];
  state.position = {
    x: state.position.x + vector.x,
    y: state.position.y + vector.y,
  };

  collectPelletAt(state.position);
  updateHud();
  updateMarkers();
}

function stepGhosts() {
  state.ghosts.forEach((ghost, index) => {
    const options = getGhostDirections(ghost);

    if (options.length === 0) {
      return;
    }

    const current = options.find((direction) => direction === ghost.direction);
    const reverse = getOppositeDirection(ghost.direction);
    const orderedOptions = current ? [current, ...options.filter((direction) => direction !== current)] : options;
    const forwardOptions = orderedOptions.filter((direction) => direction !== reverse);
    const directionPool = forwardOptions.length > 0 ? forwardOptions : options;
    const nextDirection = chooseGhostDirection(ghost, directionPool, index);
    const vector = directionVectors[nextDirection];

    ghost.direction = nextDirection;
    ghost.x += vector.x;
    ghost.y += vector.y;
  });

  updateMarkers();
}

function getGhostDirections(ghost) {
  return Object.keys(directionVectors).filter((direction) => canMove(direction, ghost));
}

function chooseGhostDirection(ghost, directions, index) {
  const ranked = directions
    .map((direction) => {
      const vector = directionVectors[direction];
      const nextX = ghost.x + vector.x;
      const nextY = ghost.y + vector.y;
      const distance = Math.abs(state.position.x - nextX) + Math.abs(state.position.y - nextY);

      return { direction, distance };
    })
    .sort((left, right) => left.distance - right.distance);

  if (index === 0) {
    return ranked[0].direction;
  }

  const deterministicOffset = (state.score / 10 + state.remainingPellets + index) % ranked.length;
  return ranked[deterministicOffset].direction;
}

function getOppositeDirection(direction) {
  if (direction === "up") return "down";
  if (direction === "down") return "up";
  if (direction === "left") return "right";
  if (direction === "right") return "left";
  return null;
}

function canMove(direction, position) {
  if (!direction) {
    return false;
  }

  const vector = directionVectors[direction];
  const nextX = position.x + vector.x;
  const nextY = position.y + vector.y;
  const nextCell = grid[nextY]?.[nextX];

  return Boolean(nextCell) && nextCell !== "#";
}

function collectPelletAt(position) {
  if (grid[position.y][position.x] !== ".") {
    return;
  }

  grid[position.y][position.x] = " ";
  state.score += 10;
  state.remainingPellets -= 1;
  const pelletElement = gridElement.querySelector(`[data-x="${position.x}"][data-y="${position.y}"]`);
  pelletElement?.classList.remove("pellet");

  if (state.remainingPellets === 0) {
    state.won = true;
    state.direction = null;
    state.nextDirection = null;
    updateHud();
    showMessage("Maze clear", "All pellets collected. Press restart or R to play again.");
  }
}

function checkGhostCollision() {
  if (!isPlaying()) {
    return;
  }

  const hitGhost = state.ghosts.find((ghost) => ghost.x === state.position.x && ghost.y === state.position.y);

  if (!hitGhost) {
    return;
  }

  state.lives -= 1;

  if (state.lives <= 0) {
    state.lost = true;
    state.direction = null;
    state.nextDirection = null;
    updateHud();
    showMessage("Game over", `${hitGhost.name} caught you. Press restart or R to try again.`);
    return;
  }

  resetRound(`Caught by ${hitGhost.name}`);
}

function resetRound(status) {
  state.position = { ...state.spawnPosition };
  state.direction = null;
  state.nextDirection = null;
  state.ghosts = initialGhosts.map((ghost) => ({ ...ghost }));
  state.pausedUntil = performance.now() + 700;
  state.lastStepTime = 0;
  updateHud(status);
  updateMarkers();
}

function isPlaying() {
  return !state.won && !state.lost;
}

function updateHud(status = "") {
  scoreElement.textContent = String(state.score);
  pelletsElement.textContent = String(state.remainingPellets);
  livesElement.textContent = String(state.lives);

  if (status) {
    statusElement.textContent = status;
  } else if (state.lost) {
    statusElement.textContent = "Game over";
  } else if (state.won) {
    statusElement.textContent = "Clear";
  } else {
    statusElement.textContent = state.direction ? "Moving" : "Ready";
  }
}

function updateMarkers() {
  const tileSize = boardElement.clientWidth / columns;
  const offset = tileSize * 0.08;

  playerElement.className = `pacman-marker ${state.direction ?? "right"}`;
  playerElement.style.transform = getMarkerTransform(state.position.x, state.position.y, tileSize, offset);

  state.ghosts.forEach((ghost) => {
    const ghostElement = ghostLayerElement.querySelector(`[data-ghost-id="${ghost.id}"]`);
    if (!ghostElement) {
      return;
    }

    ghostElement.style.transform = getMarkerTransform(ghost.x, ghost.y, tileSize, offset);
  });
}

function getMarkerTransform(x, y, tileSize, offset) {
  return `translate3d(${x * tileSize + offset}px, ${y * tileSize + offset}px, 0)`;
}

function showMessage(title, copy) {
  messageTitleElement.textContent = title;
  messageCopyElement.textContent = copy;
  messageElement.hidden = false;
}

function hideMessage() {
  messageElement.hidden = true;
  messageTitleElement.textContent = "";
  messageCopyElement.textContent = "";
}

function handleKeyDown(event) {
  if (event.code === "KeyR" || event.code === "Enter") {
    event.preventDefault();
    resetGame();
    return;
  }

  const direction = keyToDirection[event.code];

  if (!direction) {
    return;
  }

  event.preventDefault();
  queueDirection(direction);
}

function queueDirection(direction) {
  if (!isPlaying()) {
    return;
  }

  state.nextDirection = direction;
  updateHud("Queued");
  boardElement.focus({ preventScroll: true });
}

initializeGame();
