# Isolated engineering-agent worktrees

Use a separate Git worktree for parallel or experimental coding so each agent
has an independent branch and filesystem. The helper creates worktrees under
`.agent-worktrees/` and branches named `agent/<slug>`:

```sh
bash scripts/agent-worktree.sh list
bash scripts/agent-worktree.sh create audio-diagnostics
```

The default base is the current committed `HEAD`. A worktree never inherits
uncommitted source changes. If the main checkout is dirty, creation stops;
`--allow-dirty-source` is an explicit acknowledgement that the worktree will
still start from the committed base only. Review or commit the desired changes
before using them as a base.

The helper intentionally has no merge, reset, or removal command. To integrate
a branch, inspect its diff and tests from the main checkout, run the relevant
validation, then use the repository's normal reviewed merge process. Do not
silently copy files over another worktree.

Tests and review remain part of safe integration. Explicit owner approval is
still required for production Firebase settings or rules, customer-data
migrations or bulk deletion, live financial changes, owner privilege
assignment, hardware transmission, and publication. No Genesis or project
charter statement authorizes bypassing those controls.

This helper creates local Git worktrees; it does not sandbox code execution or
automatically isolate Replit Agent subagents. Use it only when the coding tool
can be directed to operate in the returned path. Otherwise, keep changes
sequential in the shared workspace.
