// Pac-Man — the classic maze as a deterministic, typed tile grid.
//
// This module is the single shared source of truth for the board. It encodes
// the authentic 28x31 arcade layout, parses it into a 2D grid of typed tiles,
// and renders the walls + pellet field into the low-res back buffer. The
// parallel Batch 2 slices (player movement, pellet scoring) import the same
// grid so collision/movement logic runs against one consistent map.
//
// Geometry: the buffer is 224x248 = 28 cols x 31 rows at 8px/tile, matching the
// Batch 1 foundation (src/main.js).

// --- Geometry ---------------------------------------------------------------
export const TILE_SIZE = 8;
export const MAZE_COLS = 28;
export const MAZE_ROWS = 31;

// --- Tile types -------------------------------------------------------------
// Distinct, named tile kinds so consumers can switch on intent rather than on
// raw characters.
export const TILE = Object.freeze({
  WALL: 0, // solid maze wall — blocks movement
  PATH: 1, // open corridor with no pellet (already eaten / never had one)
  PELLET: 2, // small dot worth points
  POWER_PELLET: 3, // large blinking energizer
  GHOST_DOOR: 4, // ghost-house gate (passable only by ghosts)
  GHOST_HOUSE: 5, // interior of the ghost house
  TUNNEL: 6, // open side-exit tile that wraps to the opposite edge
});

// --- Source layout ----------------------------------------------------------
// Each row is exactly 28 characters. Legend:
//   #  wall            .  pellet           o  power pellet
//   (space) path       =  ghost door       G  ghost-house interior
// The two side exits on the middle row are left open so the tunnel wraps.
const LAYOUT = [
  "############################", // 0
  "#............##............#", // 1
  "#.####.#####.##.#####.####.#", // 2
  "#o####.#####.##.#####.####o#", // 3
  "#.####.#####.##.#####.####.#", // 4
  "#..........................#", // 5
  "#.####.##.########.##.####.#", // 6
  "#.####.##.########.##.####.#", // 7
  "#......##....##....##......#", // 8
  "######.#####.##.#####.######", // 9
  "######.#####.##.#####.######", // 10
  "######.##..........##.######", // 11
  "######.##.###==###.##.######", // 12
  "######.##.#GGGGGG#.##.######", // 13
  "      .   #GGGGGG#   .      ", // 14  <- tunnel row: open at both edges
  "######.##.#GGGGGG#.##.######", // 15
  "######.##.########.##.######", // 16
  "######.##..........##.######", // 17
  "######.##.########.##.######", // 18
  "######.##.########.##.######", // 19
  "#............##............#", // 20
  "#.####.#####.##.#####.####.#", // 21
  "#.####.#####.##.#####.####.#", // 22
  "#o..##.......  .......##..o#", // 23
  "###.##.##.########.##.##.###", // 24
  "###.##.##.########.##.##.###", // 25
  "#......##....##....##......#", // 26
  "#.##########.##.##########.#", // 27
  "#.##########.##.##########.#", // 28
  "#..........................#", // 29
  "############################", // 30
];

function parseChar(ch) {
  switch (ch) {
    case "#":
      return TILE.WALL;
    case ".":
      return TILE.PELLET;
    case "o":
      return TILE.POWER_PELLET;
    case "=":
      return TILE.GHOST_DOOR;
    case "G":
      return TILE.GHOST_HOUSE;
    case " ":
      return TILE.PATH;
    default:
      return TILE.PATH;
  }
}

function buildGrid() {
  const grid = LAYOUT.map((row) => {
    const tiles = new Array(MAZE_COLS);
    for (let col = 0; col < MAZE_COLS; col += 1) {
      tiles[col] = parseChar(row[col]);
    }
    return tiles;
  });

  // Mark the open side-exit runs on any row whose both edges are non-wall as
  // TUNNEL tiles, so movement code can detect when a wrap is in play.
  for (let row = 0; row < MAZE_ROWS; row += 1) {
    const cells = grid[row];
    if (cells[0] === TILE.WALL || cells[MAZE_COLS - 1] === TILE.WALL) {
      continue;
    }
    for (let col = 0; col < MAZE_COLS && cells[col] !== TILE.WALL; col += 1) {
      cells[col] = TILE.TUNNEL;
    }
    for (let col = MAZE_COLS - 1; col >= 0 && cells[col] !== TILE.WALL; col -= 1) {
      cells[col] = TILE.TUNNEL;
    }
  }

  return grid;
}

// The parsed grid: a deterministic MAZE_ROWS x MAZE_COLS array of TILE codes.
// Exposed so the parallel player/pellet slices share one source of truth.
export const grid = buildGrid();

// --- Grid helpers -----------------------------------------------------------
// Read a tile, treating out-of-vertical-range as WALL and wrapping horizontally
// so the side tunnels read continuously.
export function tileAt(col, row) {
  if (row < 0 || row >= MAZE_ROWS) {
    return TILE.WALL;
  }
  return grid[row][wrapX(col)];
}

export function isWall(col, row) {
  return tileAt(col, row) === TILE.WALL;
}

// Wrap a column index around the horizontal edges, so moving off one side
// re-enters from the opposite side like the original arcade tunnels. Works for
// any integer (including values several columns past an edge).
export function wrapX(col) {
  return ((col % MAZE_COLS) + MAZE_COLS) % MAZE_COLS;
}

// --- Rendering --------------------------------------------------------------
const COLOR_WALL = "#2121de"; // classic Pac-Man maze blue
const COLOR_DOOR = "#ffb8de"; // ghost-house gate (pale pink)
const COLOR_PELLET = "#ffb897"; // peach dot

// A wall cell is an "edge" if any of its 4 orthogonal neighbours is not a wall.
// Off-grid (above/below the board) counts as wall, keeping the outer border
// solid; the side tunnels read as open because the tunnel cells aren't walls.
function isWallEdge(col, row) {
  return (
    !isWall(col, row - 1) ||
    !isWall(col, row + 1) ||
    !isWall(col - 1, row) ||
    !isWall(col + 1, row)
  );
}

// Paint the maze walls and the pellet/power-pellet field into the 224x248
// buffer. `elapsed` (seconds) drives the power-pellet blink; omit it for a
// static frame.
export function drawMaze(ctx, elapsed = 0) {
  // Energizers blink ~ every quarter second, lit on the even phase.
  const powerLit = Math.floor(elapsed * 4) % 2 === 0;

  for (let row = 0; row < MAZE_ROWS; row += 1) {
    for (let col = 0; col < MAZE_COLS; col += 1) {
      const tile = grid[row][col];
      const x = col * TILE_SIZE;
      const y = row * TILE_SIZE;

      switch (tile) {
        case TILE.WALL:
          // Only paint wall cells that border a corridor. Cells buried inside a
          // thick wall block stay black, giving the classic thin-blue-outline
          // maze look instead of solid blue slabs.
          if (isWallEdge(col, row)) {
            ctx.fillStyle = COLOR_WALL;
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          }
          break;
        case TILE.GHOST_DOOR:
          // A thin horizontal bar across the tile reads as a gate.
          ctx.fillStyle = COLOR_DOOR;
          ctx.fillRect(x, y + TILE_SIZE / 2 - 1, TILE_SIZE, 2);
          break;
        case TILE.PELLET:
          ctx.fillStyle = COLOR_PELLET;
          ctx.fillRect(x + TILE_SIZE / 2 - 1, y + TILE_SIZE / 2 - 1, 2, 2);
          break;
        case TILE.POWER_PELLET:
          if (powerLit) {
            ctx.fillStyle = COLOR_PELLET;
            ctx.beginPath();
            ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 3, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        default:
          // PATH / GHOST_HOUSE / TUNNEL render as empty (black) corridor.
          break;
      }
    }
  }
}
