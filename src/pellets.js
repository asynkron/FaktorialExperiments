// Pac-Man — pellet scoring, lives, round logic, and the frightened trigger (Batch 2).
//
// DOM-free on purpose: every value here is driven from the fixed-timestep
// `update(dt)` so gameplay stays deterministic and unit-testable. `render()`
// only reads this state; it never mutates it.

// Arcade scoring values.
export const PELLET_SCORE = 10;
export const POWER_PELLET_SCORE = 50;

// How long, in seconds, eating a power pellet keeps ghosts "frightened". The
// timer lives here, but ghost behaviour is owned by Batch 3 — this slice only
// exposes the trigger/timer for that slice to consume.
export const FRIGHT_DURATION = 6;

// Players start with three lives, the arcade default.
export const START_LIVES = 3;

/**
 * Create the pellet/score/round system over a pellet field.
 *
 * @param {object} field   a pellet field from grid.js (kindAt/consumeAt/remaining/reset)
 * @param {object} [opts]
 * @param {number} [opts.lives]            starting lives
 * @param {() => void} [opts.onFrightened] hook fired when a power pellet starts the
 *                                         frightened window (Batch 3 ghosts consume this)
 * @param {() => void} [opts.onLevelUp]    hook fired when a round is cleared
 */
export function createPelletSystem(field, opts = {}) {
  const onFrightened = opts.onFrightened || null;
  const onLevelUp = opts.onLevelUp || null;

  const state = {
    score: 0,
    lives: opts.lives ?? START_LIVES,
    level: 1,
    // Seconds remaining on the frightened window; 0 means ghosts are not frightened.
    frightenedTimer: 0,
  };

  // Advance time-based state. Called once per fixed tick from update(dt).
  function update(dt) {
    if (state.frightenedTimer > 0) {
      state.frightenedTimer = Math.max(0, state.frightenedTimer - dt);
    }
  }

  // Eat whatever pellet sits on a tile. Returns the kind eaten ('pellet' |
  // 'power') or null. Updates score, and for a power pellet opens the
  // frightened window and fires the Batch-3 hook.
  function eat(col, row) {
    const kind = field.consumeAt(col, row);
    if (kind === "pellet") {
      state.score += PELLET_SCORE;
    } else if (kind === "power") {
      state.score += POWER_PELLET_SCORE;
      state.frightenedTimer = FRIGHT_DURATION;
      if (onFrightened) onFrightened();
    }
    return kind;
  }

  // True while the post-power-pellet frightened window is open. Batch 3 reads this.
  function isFrightened() {
    return state.frightenedTimer > 0;
  }

  // The board is cleared when no pellets remain.
  function isRoundComplete() {
    return field.remaining() === 0;
  }

  // Advance to the next level: repopulate pellets, bump the level counter, and
  // clear any frightened window. Score and lives intentionally persist.
  function advanceLevel() {
    field.reset();
    state.level += 1;
    state.frightenedTimer = 0;
    if (onLevelUp) onLevelUp();
  }

  // Hook for Batch 3 ghost collisions. Returns the lives remaining.
  function loseLife() {
    if (state.lives > 0) state.lives -= 1;
    state.frightenedTimer = 0;
    return state.lives;
  }

  // Restore the system to a fresh game: full board, starting lives, level 1,
  // zero score. Used when a new run begins.
  function resetAll() {
    field.reset();
    state.score = 0;
    state.lives = opts.lives ?? START_LIVES;
    state.level = 1;
    state.frightenedTimer = 0;
  }

  return {
    state,
    update,
    eat,
    isFrightened,
    isRoundComplete,
    advanceLevel,
    loseLife,
    resetAll,
    // Convenience read-only accessors.
    get score() {
      return state.score;
    },
    get lives() {
      return state.lives;
    },
    get level() {
      return state.level;
    },
    get frightenedTimer() {
      return state.frightenedTimer;
    },
  };
}
