#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/agent-worktree.sh list
  bash scripts/agent-worktree.sh create <slug> [base-ref] [--allow-dirty-source]

Creates a new, isolated local worktree at .agent-worktrees/<slug> on branch
agent/<slug>. It never merges, deletes, or copies uncommitted changes.

If the source checkout is dirty, creation is refused unless
--allow-dirty-source is supplied. That flag confirms the worktree will start
from the committed base only; it does not transfer pending changes.
USAGE
}

fail() {
  printf 'agent-worktree: %s\n' "$*" >&2
  exit 2
}

root="$(git rev-parse --show-toplevel 2>/dev/null)" || fail "run this from inside a Git repository."
worktree_root="$root/.agent-worktrees"

case "${1:-}" in
  list)
    [[ $# -eq 1 ]] || { usage >&2; exit 2; }
    git -C "$root" worktree list
    ;;
  create)
    [[ $# -ge 2 ]] || { usage >&2; exit 2; }
    slug="$2"
    [[ "$slug" =~ ^[a-z0-9][a-z0-9-]{0,39}$ ]] || fail "slug must be 1–40 lowercase letters, digits, or hyphens, starting with a letter or digit."

    base_ref="HEAD"
    base_ref_set=0
    allow_dirty=0
    shift 2
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --allow-dirty-source)
          allow_dirty=1
          ;;
        -*)
          fail "unknown option: $1"
          ;;
        *)
          [[ "$base_ref_set" -eq 0 ]] || fail "provide at most one base ref."
          base_ref="$1"
          base_ref_set=1
          ;;
      esac
      shift
    done
    [[ "$base_ref" != -* ]] || fail "base ref cannot start with a dash."
    [[ ${#base_ref} -le 255 ]] || fail "base ref is too long."

    branch="agent/$slug"
    target="$worktree_root/$slug"
    git -C "$root" check-ref-format --branch "$branch" >/dev/null 2>&1 || fail "generated branch name is invalid."
    git -C "$root" show-ref --verify --quiet "refs/heads/$branch" && fail "branch already exists: $branch"
    [[ ! -e "$target" && ! -L "$target" ]] || fail "target already exists: $target"

    if [[ -n "$(git -C "$root" status --porcelain --untracked-files=normal)" && "$allow_dirty" -ne 1 ]]; then
      fail "source checkout has uncommitted changes. Commit or review them first, or pass --allow-dirty-source to create from the committed base only."
    fi

    commit="$(git -C "$root" rev-parse --verify "${base_ref}^{commit}" 2>/dev/null)" \
      || fail "base ref does not resolve to a commit: $base_ref"

    mkdir -p "$worktree_root"
    git -C "$root" worktree add -b "$branch" "$target" "$commit"
    printf '\nCreated isolated worktree:\n  branch: %s\n  path:   %s\n  base:   %s\n' "$branch" "$target" "$commit"
    if [[ "$allow_dirty" -eq 1 ]]; then
      printf 'Note: pending source changes were not copied into this worktree.\n'
    fi
    ;;
  -h|--help|"")
    usage
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
