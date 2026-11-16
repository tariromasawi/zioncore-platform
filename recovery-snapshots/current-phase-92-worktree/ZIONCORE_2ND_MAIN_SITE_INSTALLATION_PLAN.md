# ZionCore 2nd — Main-Site Integration and Installation Plan

## Purpose

Give the AI or engineer working in the main ZionCore Replit project a
preservation-first, testable procedure for integrating ZionCore 2nd as the
complete next-page experience of ZionCore 1:

- **Main ZionCore:** `https://zioncore.replit.app/`
- **Proposed ZionCore 2nd extension route:**
  `https://zioncore.replit.app/zioncore-2nd/`. This route is not live yet. It
  becomes valid only after the second experience is integrated, tested, and
  the main Replit project is published by its owner.

The desired result is **one ZionCore site** with a main experience and a full
**ZionCore 2nd** extension reachable from the main homepage. ZionCore 2nd must
retain its complete interface, research tools, copy, pages, and behavior. This
is not a split into two products or two deployments.

## Current verified state

| Item | Verified state |
| --- | --- |
| Main production URL | `https://zioncore.replit.app/` |
| Main deployment | Public, Autoscale, successful current build |
| Main web artifact | `artifacts/zioncore-frequency-lab`, served at `/` |
| ZionCore 2nd source | Present under `artifacts/zioncore-2nd/` in this source snapshot |
| ZionCore 2nd integration | Source is present but its complete experience is not yet routed inside the main app |
| Genesis foundation | Full founder-provided source is preserved in ZionCore 2nd; its landing-page feature and `/genesis` route are part of the extension |
| ZionCore 2nd published route | None yet; the supplied Replit preview URL is not a stable production destination |
| Second-app path foundations | Its Vite config accepts `BASE_PATH`; its Wouter router uses a base path |
| Main homepage link | Not added yet |
| Main production source reference | `ca6ff0b252155295315beae1f65fc8e71029ebc1` |
| Second-source reference recorded in the architecture decision | `zioncore-2nd-task-source` at `7be5bc14971d67445dc68282aee140b75833b476` |

The second-app folder is a source copy, not an independently published app.
The required outcome is to integrate it into the existing main web application
as a full-page extension route. Do not create a second Replit project, a
standalone deployment, or a separately published artifact. Keep its code
organized as an internal extension if useful, but keep one customer-facing
product, one main URL, and one publish action.

## Instructions for the main-project AI

Use this document as an installation handoff only after it and the
`artifacts/zioncore-2nd/` source directory are available in the main project's
workspace. A preview URL does not transfer source files into another Replit
project. If this plan is opened from a different project, first merge the
authorized source branch or copy the complete source directory and this plan
into that project's workspace. Do not try to download source from a
token-protected preview URL.

### 1. Preserve both source lines and establish the baseline

1. Record the main project's current branch, commit, working-tree status, and
   deployment reference before editing.
2. Create a recoverable checkpoint before significant integration work.
3. Preserve the original source trees and their history:
   - Main app: `artifacts/zioncore-frequency-lab/`
   - ZionCore 2nd: `artifacts/zioncore-2nd/`
   Keeping the second code internally organized does not mean keeping it as a
   separate product or deployment.
4. Do not wholesale-merge an unrelated branch, replace the main app, remove
   files, delete local or cloud records, or rewrite the second app from scratch.
5. Compare the source references above to the actual repository. Do not claim
   that either reference is the current deployed build without checking it.

### 2. Integrate the complete second experience into the main app

1. Keep `artifacts/zioncore-frequency-lab/` as the one registered main web
   application and integrate the complete ZionCore 2nd experience into its
   route tree at `/zioncore-2nd/`.
2. Preserve the second experience as a full-page application extension: retain
   its own visual design, navigation, Live Lab, History, Exploration,
   Genesis foundation and complete declaration, instruments, account access,
   export, and research functionality. Do not
   reduce it to a card, embedded preview, mockup, or summary page.
3. Adapt the second app's current `Router base` to work under the main app's
   route without hijacking ZionCore 1's router or browser history. Keep the
   original source recoverable and avoid replacing the main app's router.
4. Scope or reconcile the second app's global CSS so it does not restyle or
   break ZionCore 1. Preserve the second app's appearance inside its extension
   route.
5. The second app's `vite.config.ts` is a source/build reference. The main
   artifact's build must produce and serve the integrated route; do not start a
   separate production Vite app for ZionCore 2nd.
6. Inspect the existing pnpm workspace configuration and lockfile. Add only
   genuinely missing dependencies and preserve the existing dependency versions.
   Do not create a second public artifact or Replit deployment.

### 3. Preserve route, storage, authentication, and service boundaries

1. Confirm these routes work within the one main site:
   - `/zioncore-2nd/`
   - `/zioncore-2nd/history`
   - `/zioncore-2nd/history/device`
   - `/zioncore-2nd/history/device/:id`
   - `/zioncore-2nd/history/:id`
   - `/zioncore-2nd/exploration`
   - `/zioncore-2nd/genesis`
2. Test direct navigation, refresh, browser back/forward, static assets, audio
   workers, and API calls. Do not rely on navigating from the root page only.
3. The two apps currently use the same local observation storage key. Before
   enabling both on the same origin, define an explicit namespacing/migration
   strategy. Preserve any existing browser records; copy or migrate with
   validation, and never delete the old key as a shortcut.
4. Verify the Firebase project, web App ID, App Check key, and allowed hostname
   for the actual production host. Keep development and production values
   separate. Never put service-account credentials in either browser app.
5. Keep private history and account data authenticated and user-scoped.
   Visitors may use public/local tools without sign-in where supported.
6. Keep wallet, ledger, billing, owner, and payment operations on the existing
   authenticated server routes. Do not grant browser access to financial
   records or owner operations.
7. Do not deploy the candidate `firestore.rules` file automatically. Compare it
   with the live project-wide rules and every existing collection dependency;
   present the complete permission diff and obtain the required owner approval
   before any production rules change.
8. Keep App Check enforcement disabled until valid token exchange has been
   confirmed in a normal browser. Do not log, print, or store App Check tokens.
9. Preserve `artifacts/zioncore-2nd/src/content/genesis-declaration.txt`
   byte-for-byte. Its SHA-256 is
   `f87c324da247443bcf6ac4c6b799241e871abc3dec8aaa69c921cd123943f95e`.
   Keep it available as the founder's archival declaration and render it as
   plain text, never as executable HTML. AI requests should receive only the
   compact, privacy-bounded Genesis context and relevant selected material,
   not the entire archive on every request. The declaration does not override
   evidence, user consent, privacy, or platform safety boundaries.

### 4. Make ZionCore 2nd the next page of ZionCore 1

1. Add a clearly visible link labelled **ZionCore 2nd** to the main landing
   page/navigation, without removing or renaming any current navigation.
2. Link to the internal route `/zioncore-2nd/`, not to a temporary `*.replit.dev`
   URL or a URL containing a preview-access token.
3. Provide an obvious **Return to ZionCore 1** action within ZionCore 2nd so the
   visitor experiences a continuous site, not a detached application.
4. Keep the link usable on desktop and mobile and make its destination clear to
   keyboard and screen-reader users.
5. Do not gate public second-app exploration behind login. Preserve login
   requirements for account history and other private features.

### 5. Validate both products together

Run the repository's existing checks for the integrated app and shared API, then
verify:

- the main homepage still loads and its existing routes still work;
- the full ZionCore 2nd experience, History, and Exploration routes load at
  the extension path;
- direct deep links and refreshes work;
- Firebase sign-in state remains correct and user records remain isolated;
- App Check is initialized for the correct host/app pair, without enabling
  production enforcement prematurely;
- the main app's Messages, Devices, Signal Cards, Plans/Credits, dashboard, and
  owner security have not regressed;
- the second app's local tools, history, exports, AI flow, and mobile layout
  behave as expected;
- failed or unavailable services show honest error/empty states rather than
  fabricated history or analysis.

Do not use production customer data for test fixtures. Do not issue live
payments, change prices, modify production rules, or publish while a required
check is failing.

### 6. Single-site publish gate

There is one main application and one publishing action. After all checks pass,
show the owner the release summary and wait for the owner to publish the main
site. Then verify the main homepage link and `/zioncore-2nd/` extension route on
the live domain. Do not create or publish a separate ZionCore 2nd deployment.

## Recommended URLs

| Experience | Preview target after integration | Production target after owner publication |
| --- | --- | --- |
| Main ZionCore | Main project preview at `/` | `https://zioncore.replit.app/` |
| ZionCore 2nd | Main project preview at `/zioncore-2nd/` | `https://zioncore.replit.app/zioncore-2nd/` |

The current standalone preview remains useful for temporary owner review only.
It is private/temporary and must not be used as the customer-facing page or
homepage link.

## Main-project integration touchpoints

These are the main files the integrating agent should inspect. The links are
repository-relative and become directly usable after this handoff is copied or
merged into the main project's workspace.

- [Main app routes and homepage navigation](artifacts/zioncore-frequency-lab/src/App.tsx)
- [Main artifact configuration](artifacts/zioncore-frequency-lab/.replit-artifact/artifact.toml)
- [Main Firebase client configuration](artifacts/zioncore-frequency-lab/src/lib/firebase.ts)
- [Main local observation storage](artifacts/zioncore-frequency-lab/src/lib/observations.ts)
- [Main cloud observation client](artifacts/zioncore-frequency-lab/src/lib/cloud-observations.ts)
- [Main AI client](artifacts/zioncore-frequency-lab/src/lib/ai-analysis.ts)
- [Main Firestore rules](artifacts/zioncore-frequency-lab/firestore.rules)
- [Main Firestore rules tests](artifacts/zioncore-frequency-lab/src/lib/firestore.rules.test.mjs)
- [Main Firebase environment template](artifacts/zioncore-frequency-lab/.env.example)
- [Shared API artifact configuration](artifacts/api-server/.replit-artifact/artifact.toml)
- [API Firebase identity middleware](artifacts/api-server/src/middlewares/firebase-identity.ts)
- [API AI interpretation route](artifacts/api-server/src/routes/ai-interpretation.ts)
- [API audio interpretation route](artifacts/api-server/src/routes/ai-audio-interpretation.ts)
- [Workspace package definitions](pnpm-workspace.yaml)
- [Workspace dependency lockfile](pnpm-lock.yaml)

## Complete ZionCore 2nd source-file manifest

Copy/merge the listed files together as a source tree. Preserve its design,
copy, page structure, tests, Firebase configuration, and documentation. Do not
copy generated build output, emulator logs, or TypeScript build caches.

### App shell, pages, styling, and public assets

- [App.tsx](artifacts/zioncore-2nd/src/App.tsx)
- [main.tsx](artifacts/zioncore-2nd/src/main.tsx)
- [index.css](artifacts/zioncore-2nd/src/index.css)
- [celestial-exploration.tsx](artifacts/zioncore-2nd/src/pages/celestial-exploration.tsx)
- [celestial-exploration.css](artifacts/zioncore-2nd/src/pages/celestial-exploration.css)
- [genesis-page.tsx](artifacts/zioncore-2nd/src/pages/genesis-page.tsx)
- [not-found.tsx](artifacts/zioncore-2nd/src/pages/not-found.tsx)
- [analysis-panel.tsx](artifacts/zioncore-2nd/src/components/analysis-panel.tsx)
- [account-access.tsx](artifacts/zioncore-2nd/src/components/account-access.tsx)
- [error-boundary.tsx](artifacts/zioncore-2nd/src/components/error-boundary.tsx)
- [favicon.svg](artifacts/zioncore-2nd/public/favicon.svg)
- [robots.txt](artifacts/zioncore-2nd/public/robots.txt)
- [index.html](artifacts/zioncore-2nd/index.html)

### Hooks and research/Firebase libraries

- [use-lab-engine.ts](artifacts/zioncore-2nd/src/hooks/use-lab-engine.ts)
- [use-mobile.tsx](artifacts/zioncore-2nd/src/hooks/use-mobile.tsx)
- [use-toast.ts](artifacts/zioncore-2nd/src/hooks/use-toast.ts)
- [ai-analysis.ts](artifacts/zioncore-2nd/src/lib/ai-analysis.ts)
- [ai-analysis.test.ts](artifacts/zioncore-2nd/src/lib/ai-analysis.test.ts)
- [genesis-context.ts](artifacts/zioncore-2nd/src/lib/genesis-context.ts)
- [genesis-foundation.test.ts](artifacts/zioncore-2nd/src/lib/genesis-foundation.test.ts)
- [genesis-declaration.txt — original founder-provided Genesis seed](artifacts/zioncore-2nd/src/content/genesis-declaration.txt)
- [celestial-experiment.ts](artifacts/zioncore-2nd/src/lib/celestial-experiment.ts)
- [celestial-experiment.test.ts](artifacts/zioncore-2nd/src/lib/celestial-experiment.test.ts)
- [cloud-observations.ts](artifacts/zioncore-2nd/src/lib/cloud-observations.ts)
- [firebase.ts](artifacts/zioncore-2nd/src/lib/firebase.ts)
- [firebase-auth.ts](artifacts/zioncore-2nd/src/lib/firebase-auth.ts)
- [firebase-auth.test.ts](artifacts/zioncore-2nd/src/lib/firebase-auth.test.ts)
- [firestore.rules.test.mjs](artifacts/zioncore-2nd/src/lib/firestore.rules.test.mjs)
- [hardware-instruments.ts](artifacts/zioncore-2nd/src/lib/hardware-instruments.ts)
- [hardware-instruments.test.ts](artifacts/zioncore-2nd/src/lib/hardware-instruments.test.ts)
- [observation-validation.ts](artifacts/zioncore-2nd/src/lib/observation-validation.ts)
- [observation-validation.test.ts](artifacts/zioncore-2nd/src/lib/observation-validation.test.ts)
- [observations.ts](artifacts/zioncore-2nd/src/lib/observations.ts)
- [observations.test.ts](artifacts/zioncore-2nd/src/lib/observations.test.ts)
- [research-grid.ts](artifacts/zioncore-2nd/src/lib/research-grid.ts)
- [research-grid.test.ts](artifacts/zioncore-2nd/src/lib/research-grid.test.ts)
- [utils.ts](artifacts/zioncore-2nd/src/lib/utils.ts)

### UI components

- [accordion.tsx](artifacts/zioncore-2nd/src/components/ui/accordion.tsx)
- [alert-dialog.tsx](artifacts/zioncore-2nd/src/components/ui/alert-dialog.tsx)
- [alert.tsx](artifacts/zioncore-2nd/src/components/ui/alert.tsx)
- [aspect-ratio.tsx](artifacts/zioncore-2nd/src/components/ui/aspect-ratio.tsx)
- [avatar.tsx](artifacts/zioncore-2nd/src/components/ui/avatar.tsx)
- [badge.tsx](artifacts/zioncore-2nd/src/components/ui/badge.tsx)
- [breadcrumb.tsx](artifacts/zioncore-2nd/src/components/ui/breadcrumb.tsx)
- [button-group.tsx](artifacts/zioncore-2nd/src/components/ui/button-group.tsx)
- [button.tsx](artifacts/zioncore-2nd/src/components/ui/button.tsx)
- [calendar.tsx](artifacts/zioncore-2nd/src/components/ui/calendar.tsx)
- [card.tsx](artifacts/zioncore-2nd/src/components/ui/card.tsx)
- [carousel.tsx](artifacts/zioncore-2nd/src/components/ui/carousel.tsx)
- [chart.tsx](artifacts/zioncore-2nd/src/components/ui/chart.tsx)
- [checkbox.tsx](artifacts/zioncore-2nd/src/components/ui/checkbox.tsx)
- [collapsible.tsx](artifacts/zioncore-2nd/src/components/ui/collapsible.tsx)
- [command.tsx](artifacts/zioncore-2nd/src/components/ui/command.tsx)
- [context-menu.tsx](artifacts/zioncore-2nd/src/components/ui/context-menu.tsx)
- [dialog.tsx](artifacts/zioncore-2nd/src/components/ui/dialog.tsx)
- [drawer.tsx](artifacts/zioncore-2nd/src/components/ui/drawer.tsx)
- [dropdown-menu.tsx](artifacts/zioncore-2nd/src/components/ui/dropdown-menu.tsx)
- [empty.tsx](artifacts/zioncore-2nd/src/components/ui/empty.tsx)
- [field.tsx](artifacts/zioncore-2nd/src/components/ui/field.tsx)
- [form.tsx](artifacts/zioncore-2nd/src/components/ui/form.tsx)
- [hover-card.tsx](artifacts/zioncore-2nd/src/components/ui/hover-card.tsx)
- [input-group.tsx](artifacts/zioncore-2nd/src/components/ui/input-group.tsx)
- [input-otp.tsx](artifacts/zioncore-2nd/src/components/ui/input-otp.tsx)
- [input.tsx](artifacts/zioncore-2nd/src/components/ui/input.tsx)
- [item.tsx](artifacts/zioncore-2nd/src/components/ui/item.tsx)
- [kbd.tsx](artifacts/zioncore-2nd/src/components/ui/kbd.tsx)
- [label.tsx](artifacts/zioncore-2nd/src/components/ui/label.tsx)
- [menubar.tsx](artifacts/zioncore-2nd/src/components/ui/menubar.tsx)
- [navigation-menu.tsx](artifacts/zioncore-2nd/src/components/ui/navigation-menu.tsx)
- [pagination.tsx](artifacts/zioncore-2nd/src/components/ui/pagination.tsx)
- [popover.tsx](artifacts/zioncore-2nd/src/components/ui/popover.tsx)
- [progress.tsx](artifacts/zioncore-2nd/src/components/ui/progress.tsx)
- [radio-group.tsx](artifacts/zioncore-2nd/src/components/ui/radio-group.tsx)
- [resizable.tsx](artifacts/zioncore-2nd/src/components/ui/resizable.tsx)
- [scroll-area.tsx](artifacts/zioncore-2nd/src/components/ui/scroll-area.tsx)
- [select.tsx](artifacts/zioncore-2nd/src/components/ui/select.tsx)
- [separator.tsx](artifacts/zioncore-2nd/src/components/ui/separator.tsx)
- [sheet.tsx](artifacts/zioncore-2nd/src/components/ui/sheet.tsx)
- [sidebar.tsx](artifacts/zioncore-2nd/src/components/ui/sidebar.tsx)
- [skeleton.tsx](artifacts/zioncore-2nd/src/components/ui/skeleton.tsx)
- [slider.tsx](artifacts/zioncore-2nd/src/components/ui/slider.tsx)
- [sonner.tsx](artifacts/zioncore-2nd/src/components/ui/sonner.tsx)
- [spinner.tsx](artifacts/zioncore-2nd/src/components/ui/spinner.tsx)
- [switch.tsx](artifacts/zioncore-2nd/src/components/ui/switch.tsx)
- [table.tsx](artifacts/zioncore-2nd/src/components/ui/table.tsx)
- [tabs.tsx](artifacts/zioncore-2nd/src/components/ui/tabs.tsx)
- [textarea.tsx](artifacts/zioncore-2nd/src/components/ui/textarea.tsx)
- [toast.tsx](artifacts/zioncore-2nd/src/components/ui/toast.tsx)
- [toaster.tsx](artifacts/zioncore-2nd/src/components/ui/toaster.tsx)
- [toggle-group.tsx](artifacts/zioncore-2nd/src/components/ui/toggle-group.tsx)
- [toggle.tsx](artifacts/zioncore-2nd/src/components/ui/toggle.tsx)
- [tooltip.tsx](artifacts/zioncore-2nd/src/components/ui/tooltip.tsx)

### Build, package, Firebase, and product documentation

- [package.json](artifacts/zioncore-2nd/package.json)
- [vite.config.ts](artifacts/zioncore-2nd/vite.config.ts)
- [tsconfig.json](artifacts/zioncore-2nd/tsconfig.json)
- [components.json](artifacts/zioncore-2nd/components.json)
- [.env.example](artifacts/zioncore-2nd/.env.example)
- [firebase.emulator.json](artifacts/zioncore-2nd/firebase.emulator.json)
- [firestore.rules](artifacts/zioncore-2nd/firestore.rules)
- [FIREBASE_SETUP.md](artifacts/zioncore-2nd/FIREBASE_SETUP.md)
- [RESEARCH_GRID.md](artifacts/zioncore-2nd/RESEARCH_GRID.md)

## Source and platform references

- [ZionCore version architecture decision](ZIONCORE_VERSION_ARCHITECTURE_DECISION.md)
- [Main production Firebase review](ZIONCORE_FIREBASE_PRODUCTION_REVIEW.md)
- [Replit: Multiple Artifacts vs. Separate Projects](https://docs.replit.com/features/projects-and-artifacts/multiple-artifacts-vs-projects)
- [Replit: Artifacts](https://docs.replit.com/features/projects-and-artifacts/artifacts)
- [Replit: Cloud billing updates](https://docs.replit.com/billing/aug-cloud-billing-updates)

## Final acceptance

The integration is ready for owner review when ZionCore 1 and the complete
ZionCore 2nd experience operate as one site and one deployment; the main
homepage links to the full `/zioncore-2nd/` page; ZionCore 2nd provides a clear
return path to ZionCore 1; its Genesis foundation is prominent and its full
original declaration is preserved and included in the source archive; existing
main routes and customer data remain intact; private data stays account-scoped;
AI receives bounded Genesis context rather than the full archival declaration;
App Check is verified without premature enforcement; and all required tests
pass. A passing preview is not a production publication; the owner controls
the final publish action.
