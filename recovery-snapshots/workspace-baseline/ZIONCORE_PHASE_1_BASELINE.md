# ZionCore Phase 1 — Source Baseline Record

Captured: **2026-11-11 18:14:11 UTC**

This record freezes the source references observed before further implementation. It does not establish which commit produced the live deployment.

## Current workspace

- Branch: `main`
- `HEAD`: `28feec5e7e2d8de76842abd2fddb9379446e21db`
- Parent: `7be5bc14971d67445dc68282aee140b75833b476`
- Tree: `2c84dd5da7a8cc57fde1bad0531a89a1d1c6efb2`

## Preserved source references

| Source line | Ref | Full commit | Parent | Commit date (UTC) | Subject |
|---|---|---|---|---|---|
| Main-source candidate | `zioncore-main-source-candidate` | `d4be0c767ae0cbe075ac0bce5e40191e32bc2a1d` | `ca6ff0b252155295315beae1f65fc8e71029ebc1` | 2026-11-10 14:20:44 | Published your App |
| Research-lab task source | `zioncore-2nd-task-source` | `7be5bc14971d67445dc68282aee140b75833b476` | `9c358019e7afd6e2806bfb463cf5e9e119f0d909` | 2026-11-10 14:55:04 | Update frequency lab analysis logic and testing suite |

Both preservation refs exist locally. `HEAD` is a child of the research-lab task-source commit. The main-source candidate is a separate ref; neither ref was moved.

## Working-tree state at capture

The working tree was **not clean**. The only modified tracked file was `ZIONCORE_GENESIS_100_PHASE_PLAN.md` (21 insertions and 21 deletions). Its current contents were preserved and not reset or rewritten.

- Plan file blob at `HEAD`: `622c5ae1522636a4fef920ddbad4927773a954e7`
- Captured working-tree Git blob: `7eff1c357983307d0e43911e4b3383b64072977c`
- Captured working-tree SHA-256: `0cfffc49f82614e6846af7ac1c4862e421ef370dc38f6b04727ab3e6f1fff4a2`

The edits to the plan include changes to branch-review and testing safeguards. They are recorded as existing workspace changes, not accepted as implementation instructions.

## Deployment provenance and scope

- Public main URL: `https://zioncore.replit.app`
- The exact Git commit behind that live deployment remains **unverified**. `zioncore-main-source-candidate` is a candidate source reference, not proof of the deployed revision.
- No app code, source refs, Firebase configuration, Firestore rules, Stripe settings, customer records, or deployment settings were changed during Phase 1.
- This note records the Phase 1 baseline; it is not a checkpoint or production backup.

## Phase 1 result

Both preservation refs and the current `HEAD` were verified and recorded. The existing plan-file modification remains untouched. Continue only from a separate working branch or after explicitly reviewing that modification; never reset or merge the preserved refs wholesale.
