const initialState = {
  score: 0,
  lives: 3,
  status: "Ready",
  direction: "None",
  running: false,
};

const state = { ...initialState };

const scoreEl = document.querySelector("#score");
const livesEl = document.querySelector("#lives");
const statusEl = document.querySelector("#game-status");
const directionEl = document.querySelector("#direction-display");
const startButton = document.querySelector("#start-button");
const restartButton = document.querySelector("#restart-button");

const directionKeys = new Map([
  ["ArrowUp", "Up"],
  ["w", "Up"],
  ["W", "Up"],
  ["ArrowRight", "Right"],
  ["d", "Right"],
  ["D", "Right"],
  ["ArrowDown", "Down"],
  ["s", "Down"],
  ["S", "Down"],
  ["ArrowLeft", "Left"],
  ["a", "Left"],
  ["A", "Left"],
]);

function formatScore(score) {
  return String(score).padStart(4, "0");
}

function render() {
  scoreEl.textContent = formatScore(state.score);
  livesEl.textContent = String(state.lives);
  statusEl.textContent = state.status;
  directionEl.textContent = state.direction;
}

function startGame() {
  state.running = true;
  state.status = "Running";
  render();
}

function restartGame() {
  Object.assign(state, initialState, {
    status: "Restarted",
  });
  render();
}

function handleKeydown(event) {
  const direction = directionKeys.get(event.key);

  if (!direction) {
    return;
  }

  event.preventDefault();
  state.direction = direction;
  state.status = state.running ? `Moving ${direction}` : `Queued ${direction}`;
  render();
}

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", restartGame);
window.addEventListener("keydown", handleKeydown);

render();
