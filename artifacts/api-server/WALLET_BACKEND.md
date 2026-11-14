# ZionCore credit wallet backend

The API server is the only client-facing path to wallet balances and recent
ledger entries. Both endpoints require a Firebase Authentication ID token and
a Firebase App Check token. The server derives the UID from the verified ID
token; callers cannot select another account.

## Server credential

Configure `FIREBASE_SERVICE_ACCOUNT_JSON` through Replit Secrets for the API
server's development and production environments. Its service account must
belong to ZionCore's existing Firebase project. Do not put the credential in
source control, browser configuration, or chat.

Until this secret is configured, wallet endpoints deliberately return `503`.
The API server health endpoint remains available.

## Ledger behavior

- Wallet, transaction, and reservation records are server-managed. Firestore
  rules deny all browser reads and writes to these collections.
- Every grant, reservation, settlement, and release updates the wallet summary
  and appends an immutable transaction record in one Firestore transaction.
- All financial mutations are idempotent. Reusing an idempotency key with
  different inputs is rejected.
- Promotional credits are reserved and consumed before purchased credits.
- Reservations hold credits before work starts; settlement cannot exceed the
  reservation, and unused credits return to their original buckets.
- Credit grants are server-only library operations. There is no browser grant
  endpoint; a future purchase phase must verify its payment webhook before
  calling the purchased-credit grant operation.

## Local verification

Run `pnpm --filter @workspace/api-server run test:unit` for authentication and
App Check middleware tests, and
`pnpm --filter @workspace/api-server run test:wallet` for Firestore-emulator
ledger tests.
