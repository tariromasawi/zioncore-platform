# ZionCore worktree Git history

This split Git bundle preserves committed refs and history for the six development worktrees and two source-candidate refs listed below. The current Phase 2 worktree's uncommitted source is preserved on the separate phase2/source-preservation branch.

Bundle size: 1689659 bytes
SHA-256: 686dfdb72c3b970a779595c2d1aed43bf58e600ad7604d8c3e743960a90f5797
Parts: 4

Reassemble in the listed order with: cat source-history/zioncore-worktree-history.bundle.part-* > zioncore-worktree-history.bundle. Then run git bundle verify zioncore-worktree-history.bundle and git bundle list-heads zioncore-worktree-history.bundle.

Refs in the bundle: agent/phase-87-owner-claims, agent/phase-88-dashboard-metrics, agent/phase-89-cost-guards, agent/phase-90-recovery-operations, agent/phase-91-version-architecture, agent/phase-92-integration, zioncore-2nd-task-source, and zioncore-main-source-candidate. The clean main worktree is represented by its source snapshot branch; its full branch history is not included because it contains a large generated source ZIP excluded from source preservation.
