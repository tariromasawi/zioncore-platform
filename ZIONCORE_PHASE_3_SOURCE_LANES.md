# ZionCore Phase 3 — Source Lane Isolation

## Result

The main-source candidate and research-lab task source remain on separate Git histories. No merge, reset, branch switch, or source-ref movement was performed. No integration branch exists; it should be considered only after a reviewed compatibility plan.

## Verified Git state

- Main-source candidate: `zioncore-main-source-candidate` at `d4be0c767ae0cbe075ac0bce5e40191e32bc2a1d`
- Research-lab task source: `zioncore-2nd-task-source` at `7be5bc14971d67445dc68282aee140b75833b476`
- Shared merge base: `ef668aeef91103df5d6ceaa10aa463cc379a96e5`
- Candidate-only commits: 34
- Task-source-only commits: 5
- Current workspace `HEAD`: `28feec5e7e2d8de76842abd2fddb9379446e21db`, whose parent is the research-lab task-source commit.
- Current branch is named `main`, but its history is task-source-derived. Do not assume this checked-out branch is the main-source candidate.
- No existing integration or merge branch was found.

The two preserved refs differ by **481 tracked files** (5,036 insertions and 64,080 deletions in the direction from the main-source candidate to the task source). This is a major compatibility boundary, not a safe wholesale-merge candidate.

## Handling rule

Keep the source refs isolated. Do not merge the task source into the main-source candidate or create an unreviewed integration branch. The current uncommitted plan and metadata changes remain untouched. The current deployment's exact source commit also remains unverified, as recorded in the Phase 2 report.

## Phase 3 acceptance

The preservation refs are still distinct and unchanged, no merge was made, and the source-lane hazard is documented. Integration remains gated on a later route/data/dependency review.
