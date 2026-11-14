# ZionCore Phase 2 — Deployment Provenance Comparison

Captured: **2026-11-11**

## Finding

The live site is **strongly consistent with the main-source candidate**, and is **not consistent with the research-lab task build** based on the public bundle markers checked. The exact Git commit that produced the live deployment is **not proven**.

## Deployment metadata

The Replit deployment metadata for this workspace reports:

- URL: `https://zioncore.replit.app`
- Type: `autoscale`
- Visibility: `public`
- Active deployment: yes
- Current build status: successful

This metadata does not include a source branch, Git commit, or source-tree hash. It establishes deployment availability and build health, not source provenance.

## Public build comparison

- The deployed root HTML title, canonical URL, description, and social metadata match `artifacts/zioncore-frequency-lab/index.html` in the main-source candidate.
- The live HTML references `/assets/index-uVc3p_PU.js`. The downloaded bundle was 647,016 bytes with SHA-256 `7fa73af9f144abd070937bbb6cb72932429390a87d761a9744a7c8eb8bb46574`.
- The live bundle contains route/API markers for `/discover`, `/cards`, `/messages`, `/devices`, `/owner`, `/admin`, `/api/billing`, and `/api/owner`.
- The live bundle does not contain the checked `/exploration` or `/history/device` markers present in the research-lab task source.
- These markers agree with the main-source candidate's route registration in `artifacts/zioncore-frequency-lab/src/App.tsx` and differ from the task-source route set.
- Sampled paths returned HTTP 200, but the SPA fallback serves the same HTML for unknown paths; those status codes do **not** prove the corresponding page exists or works.

The live asset's HTTP `Last-Modified` header is **2026-11-10 14:12:07 UTC**, while the main-source candidate commit is dated **2026-11-10 14:20:44 UTC**. This timestamp ordering is a reason not to claim an exact match. HTTP asset timestamps are not a Git commit attestation and may reflect build or upload time.

## Source references

- Main-source candidate: `zioncore-main-source-candidate` — `d4be0c767ae0cbe075ac0bce5e40191e32bc2a1d`
- Research-lab task source: `zioncore-2nd-task-source` — `7be5bc14971d67445dc68282aee140b75833b476`
- Current workspace `HEAD`: `28feec5e7e2d8de76842abd2fddb9379446e21db`

The candidate source has no checked-in production `dist` bundle to compare byte-for-byte with the live JavaScript. The observed HTML and feature markers are corroborating evidence only.

## Conclusion and next evidence needed

Use `zioncore-main-source-candidate` as the best-supported source reference for the live application, but label its relationship to production **probable, not verified**. A definitive answer requires owner-visible publishing history or build metadata that explicitly maps the serving deployment to a source revision. Until that is available, do not overwrite the candidate, merge the task branch wholesale, or claim that a specific commit is deployed.

## Scope and workspace state

This phase was read-only with respect to application source and production settings. No deployment, Firebase, Firestore, Stripe, customer data, or Git refs were changed.

At the start of this phase, the working tree already contained changes to `.agents/agent_assets_metadata.toml` and `ZIONCORE_GENESIS_100_PHASE_PLAN.md`, plus the new Phase 1 baseline record. Those existing changes were left untouched.
