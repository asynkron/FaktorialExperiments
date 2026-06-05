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

const boardElement = document.querySelector("#game-board");
const gridElement = document.querySelector("#maze-grid");
const playerElement = document.querySelector("#player");
const scoreElement = document.querySelector("#score");
const pelletsElement = document.querySelector("#pellets");
const statusElement = document.querySelector("#game-status");

const rows = mazeTemplate.length;
const columns = mazeTemplate[0].length;
const grid = mazeTemplate.map((row) => [...row]);
const state = {
  score: 0,
  totalPellets: 0,
  remainingPellets: 0,
  position: { x: 1, y: 1 },
  direction: null,
  nextDirection: null,
  lastStepTime: 0,
  stepDuration: 125,
  won: false,
};

function assertMazeShape() {
  const invalidRow = mazeTemplate.find((row) => row.length !== columns);

  if (invalidRow) {
    throw new Error(`Maze rows must all be ${columns} columns wide.`);
  }
}

function initializeGame() {
  if (!boardElement || !gridElement || !playerElement || !scoreElement || !pelletsElement || !statusElement) {
    return;
  }

  assertMazeShape();
  boardElement.style.setProperty("--columns", columns);
  boardElement.style.setProperty("--rows", rows);
  renderMaze();
  collectPelletAt(state.position);
  updateHud();
  updatePlayer();
  boardElement.focus({ preventScroll: true });
  requestAnimationFrame(gameLoop);
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
}

function gameLoop(timestamp) {
  if (!state.lastStepTime) {
    state.lastStepTime = timestamp;
  }

  if (!state.won && timestamp - state.lastStepTime >= state.stepDuration) {
    stepPlayer();
    state.lastStepTime = timestamp;
  }

  requestAnimationFrame(gameLoop);
}

function stepPlayer() {
  if (!state.nextDirection && !state.direction) {
    return;
  }

  if (canMove(state.nextDirection)) {
    state.direction = state.nextDirection;
  }

  if (!canMove(state.direction)) {
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
  updatePlayer();
}

function canMove(direction) {
  if (!direction) {
    return false;
  }

  const vector = directionVectors[direction];
  const nextX = state.position.x + vector.x;
  const nextY = state.position.y + vector.y;
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
    statusElement.textContent = "Clear";
  }
}

function updateHud() {
  scoreElement.textContent = String(state.score);
  pelletsElement.textContent = String(state.remainingPellets);

  if (!state.won) {
    statusElement.textContent = state.direction ? "Moving" : "Ready";
  }
}

function updatePlayer() {
  const tileSize = boardElement.clientWidth / columns;
  const offset = tileSize * 0.08;
  const x = state.position.x * tileSize + offset;
  const y = state.position.y * tileSize + offset;

  playerElement.className = `pacman-marker ${state.direction ?? "right"}`;
  playerElement.style.transform = `translate3d(${x}px, ${y}px, 0)`;
}

window.addEventListener("keydown", (event) => {
  const direction = keyToDirection[event.code];

  if (!direction) {
    return;
  }

  event.preventDefault();
  state.nextDirection = direction;
  boardElement.focus({ preventScroll: true });
});

window.addEventListener("resize", updatePlayer);

initializeGame();
