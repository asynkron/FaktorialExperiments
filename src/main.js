const statusElement = document.querySelector("#game-status");
const boardElement = document.querySelector("#game-board");

function initializeGameScaffold() {
  if (!statusElement || !boardElement) {
    return;
  }

  statusElement.textContent = "Ready";
  boardElement.dataset.initialized = "true";
}

initializeGameScaffold();
