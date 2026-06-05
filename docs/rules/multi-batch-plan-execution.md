# Multi-batch plan execution rules

Conventions for delivering a plan that is split into several dependent batches
(e.g. `planitem-gh12`, the canvas Pac-Man, split into Batch 1 foundation →
Batch 2 maze → later actor/ghost/scoring batches).

## 1. Base a batch on its dependency's branch, not bare `main`, until the dependency is merged

When a batch builds on a sibling batch whose PR is **closed/approved but not yet
merged to `main`**, base your build branch on that sibling's task branch (or
otherwise import its files), not on `main`. Confirm the foundation actually
exists on your branch before implementing.

**WHY:** Faktorial batches can be approved and finished as separate PRs that land
on `main` out of order. `main` may still be a near-empty slate (only
`.gitignore`) while the foundation your batch needs lives solely on the sibling's
`agent-go/task-…` branch. A build that bases on bare `main` will find no canvas,
no render pipeline, no maze — and either fail or silently re-implement the
foundation, producing a conflicting duplicate.

**Incident:** `planitem-gh12` Batch 2 (maze rendering, PR #15). Investigation
flagged that Batch 1's foundation (`index.html`, `styles.css`, `src/main.js`) was
closed but not on `main` — it existed only on the Batch 1 task branch. Build
correctly based on that foundation, so the canvas/maze integration worked; had it
based on `main` the 224×248 buffer would not have existed. This recurs for every
later batch (player movement, ghosts, scoring) that depends on earlier, possibly
unmerged, batches.

**How to apply:**

- In the investigate stage, check whether each declared dependency is on `main`
  yet (`git log origin/main` for the expected files), and record the correct base
  branch in the handoff if it is not.
- In the build stage, verify the dependency's artifacts are present on your
  worktree before writing code; if they are missing, fix the base rather than
  re-creating them.
- Prefer extending the dependency's exported API over duplicating its data/logic,
  so the batches stay one source of truth (see
  [[0004-maze-typed-tile-grid-shared-source-of-truth]]).
