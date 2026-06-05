# Rules index

Preventive, generalizable lessons for future agents working in this repo. Each
rule states **WHY** and the issue/incident that motivated it. Read the relevant
domain file on demand; do not auto-load this whole directory.

| Rule file | Domain | One-line |
|-----------|--------|----------|
| [canvas-game-rendering.md](canvas-game-rendering.md) | Canvas / game loop | Pixel-art upscaling, deterministic fixed-timestep loop, shared maze tile-grid conventions, and the static-vs-mutable render seam for the canvas Pac-Man. |
| [multi-batch-plan-execution.md](multi-batch-plan-execution.md) | Plan / batch execution | Base a batch on its dependency's branch (not bare `main`) until merged; treat placeholders for unmerged siblings as reconciliation debt to flag. |
