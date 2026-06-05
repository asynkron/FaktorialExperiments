// Pac-Man — tile grid and pellet field (Batch 2).
//
// This module is the small, DOM-free grid abstraction the pellet/scoring slice
// consumes. It deliberately keeps no canvas or browser references so the round
// rules built on top of it stay deterministic and unit-testable.
//
// Coordination note: the canonical maze (walls / ghost house / tunnels) is owned
// by the parallel "maze rendering" sibling slice. To reconcile cleanly whatever
// the landing order, this slice only reads pellet/power-pellet positions and
// wall-passability through the narrow interface below. When the maze slice lands
// its grid, `createPelletField` can be handed that layout instead of the
// placeholder `MAZE` exported here — the consuming code does not change.

// Native arcade geometry: 28x31 tiles of 8px = 224x248 (matches the Batch 1 buffer).
export const TILE_SIZE = 8;
export const COLS = 28;
export const ROWS = 31;

// Tile legend used by the layout strings:
//   '#'  wall (blocks the player, holds no pellet)
//   '.'  pellet
//   'o'  power pellet
//   '-'  ghost-house door (treated as a wall for the player)
//   ' '  open path with no pellet (tunnels, ghost house interior)
const WALL = "#";
const PELLET = ".";
const POWER = "o";
const DOOR = "-";

// Placeholder maze layout. Standard 28x31 Pac-Man board: pellets fill the
// corridors, power pellets sit in the four corners. Replaced transparently by
// the maze slice's grid once that lands.
export const MAZE = [
  "############################",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#o####.#####.##.#####.####o#",
  "#.####.#####.##.#####.####.#",
  "#..........................#",
  "#.####.##.########.##.####.#",
  "#.####.##.########.##.####.#",
  "#......##....##....##......#",
  "######.##### ## #####.######",
  "     #.##### ## #####.#     ",
  "     #.##          ##.#     ",
  "     #.## ###--### ##.#     ",
  "######.## #      # ##.######",
  "      .   #      #   .      ",
  "######.## #      # ##.######",
  "     #.## ######## ##.#     ",
  "     #.##          ##.#     ",
  "     #.## ######## ##.#     ",
  "######.## ######## ##.######",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#.####.#####.##.#####.####.#",
  "#o..##.......    .......##o#",
  "###.##.##.########.##.##.###",
  "###.##.##.########.##.##.###",
  "#......##....##....##......#",
  "#.##########.##.##########.#",
  "#.##########.##.##########.#",
  "#..........................#",
  "############################",
];

// A tile the player can stand on (everything that is not a wall or door).
function isWalkableChar(ch) {
  return ch !== WALL && ch !== DOOR;
}

/**
 * Build a mutable pellet field from a layout (array of equal-length strings).
 *
 * Walls and the original pellet positions come from the layout and never change;
 * only which pellets have been eaten is mutable, so `reset()` restores a fresh
 * board for the next level.
 */
export function createPelletField(layout = MAZE) {
  // Static wall map (immutable for the life of the field).
  const walls = layout.map((row) =>
    Array.from(row, (ch) => ch === WALL || ch === DOOR),
  );

  // Original pellet kinds, used to repopulate the board on reset.
  const original = layout.map((row) =>
    Array.from(row, (ch) =>
      ch === PELLET ? "pellet" : ch === POWER ? "power" : null,
    ),
  );

  // Current (mutable) pellet state and remaining count.
  let pellets;
  let remaining;

  function reset() {
    pellets = original.map((row) => row.slice());
    remaining = 0;
    for (const row of pellets) {
      for (const cell of row) {
        if (cell) remaining += 1;
      }
    }
  }

  reset();

  function inBounds(col, row) {
    return row >= 0 && row < ROWS && col >= 0 && col < COLS;
  }

  return {
    cols: COLS,
    rows: ROWS,

    // True if the tile blocks player movement.
    isWall(col, row) {
      if (!inBounds(col, row)) return true;
      return walls[row][col];
    },

    // True if a tile can be walked onto (open path).
    isWalkable(col, row) {
      if (!inBounds(col, row)) return false;
      return !walls[row][col];
    },

    // 'pellet' | 'power' | null for the tile's current pellet state.
    kindAt(col, row) {
      if (!inBounds(col, row)) return null;
      return pellets[row][col];
    },

    // Remove and return the pellet on a tile ('pellet' | 'power'), or null if
    // there was none. Decrements the remaining count.
    consumeAt(col, row) {
      if (!inBounds(col, row)) return null;
      const kind = pellets[row][col];
      if (kind) {
        pellets[row][col] = null;
        remaining -= 1;
      }
      return kind;
    },

    // Pellets still on the board. The round is won when this reaches 0.
    remaining() {
      return remaining;
    },

    // Restore every pellet (used when advancing to the next level).
    reset,

    // Visit each remaining pellet for rendering: cb(col, row, kind).
    forEachPellet(cb) {
      for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
          const kind = pellets[row][col];
          if (kind) cb(col, row, kind);
        }
      }
    },
  };
}

export { isWalkableChar };
