# ZionCore release evidence

## Repeatable local checks

Run `pnpm run verify:release` from the workspace root. The same command is
registered as the `zioncore-release` validation.

The command stops at the first failed or unexecutable check. Each subprocess
has an eight-minute timeout. A stopped run does not imply later checks passed.
The local database suites use the existing demo-project Firebase emulators;
wallet/fulfillment/recovery tests reject absent, remote or malformed emulator
targets before initializing their Firebase app.

Checks:

1. Canonical workspace type checking.
2. Frontend unit tests.
3. API unit tests.
4. Tooling tests, including failure behavior of this check runner.
5. Firebase Authentication emulator tests.
6. Firestore client security-rule emulator tests.
7. Transactional wallet, Stripe fulfillment and paid-reading recovery emulator tests.
8. API production build.
9. Web production build, including the initial-bundle regression guard.

This is a repeatable engineering check, not an automatic block on the Publish
button, a security audit, or a certification that live integrations work.
Emulator tests do not contact Stripe to create real payments.

## Operational evidence still required

### Local results verified

| Suite | Passed |
| --- | ---: |
| Frontend unit | 118 |
| API unit | 54 |
| Tooling unit | 10 |
| Authentication emulator | 2 |
| Firestore rules emulator | 9 |
| Wallet, fulfillment and recovery emulator | 15 |
| **Total distinct tests** | **208** |

The registered nine-step run passed all 208 local tests. An additional
timeout-result regression was then added and the tooling suite and tooling
type check passed again. Subsequent local-archive changes added ten frontend
regressions. The current History restore panel rendered in a 402 px browser
preview without horizontal overflow. An isolated, anonymous browser test also
covered file selection, no-write preview, confirmation, reload persistence,
repeat-import prevention and acknowledgement before skipping an invalid row,
using only synthetic local fixtures. The backend and emulator results are
local checks, not live-service evidence.

Both production builds and the canonical workspace type check passed. No real
purchase or production-data write was performed. Local emulator logs are
excluded from Git and deployment inputs.

| Area | Required evidence before claiming operational completion |
| --- | --- |
| Production identity | Real authorized Google/Apple sign-in and sign-out, with correct account isolation and App Check behavior |
| Production wallet | Correct balance after refresh, sign-out/sign-in and a second authorized session |
| Live Stripe fulfillment | An explicitly approved real purchase, verified webhook delivery, one credit grant across repeated notifications, correct cancellation/refund handling |
| Premium | Verified subscription state, expiry/cancellation handling and correct server-side entitlement |
| Paid interpretation | Approved quote, reservation, successful report, settlement, visible remaining balance and recovery after interrupted transport |
| Production cleanup | Required Firestore collection-group index available; retry-record cleanup succeeds |
| Storage reliability | Investigate existing SDK listener/deprecation warnings without hiding them or weakening stream cleanup |
| Experience | Real-device microphone permissions, audio playback/stop, keyboard access and representative mobile-network performance |

Do not mark these complete from the presence of code, a health response,
successful local tests or installed credentials. Record the actual observed
result without customer identifiers, tokens, signed URLs or credentials.

## Tactical priorities

- Resolve money, identity, privacy and data-loss risks before cosmetic additions.
- Change one coherent behavior at a time; preserve working capabilities.
- Test failure and retry paths, not only successful responses.
- Keep speculative interpretation distinct from measured signal observations.
- Prefer measured reliability, comprehension and repeat use over code volume
  or unsupported superiority claims.
- Evaluate retention, purchase completion, support issues and costs using
  observed, appropriately collected data; none is guaranteed by this checklist.
