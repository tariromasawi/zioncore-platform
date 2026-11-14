# ZionCore production operations

## Official address

Use `https://zioncore.replit.app` as the production address. Keep authentication, canonical URLs, social metadata, and Stripe return URLs aligned with this host.

## Release and recovery

1. Review the active published build in Replit Publishing before a release.
2. After publishing, confirm the website loads and `GET /api/healthz` returns HTTP 200.
3. Confirm owner-only routes reject anonymous requests before signing in with an approved owner account.
4. If a release fails its health check, use Replit’s published-build history or project checkpoints to restore the last known good version; do not apply an unreviewed production data migration as a recovery step.
5. Re-run the release gate before publishing a correction.

## Firebase data protection

The production Firestore service-account read, cleanup query, and required expiry-index checks passed on 2026-11-09. A temporary document was created, read, deleted, and verified absent.

At that check, Firestore point-in-time recovery was disabled and no backup schedules were returned. App Storage has no built-in automated object backup. Configure backups only after choosing a protected destination, retention period, access policy, and budget; avoid copying customer audio or account data into temporary storage.

## Uptime and spending controls

- Replit documents deployment uptime monitoring and downtime email alerts in Publishing → Monitoring. Enable these in the account UI if available for the deployment.
- Replit documents usage limits and budget controls under Settings → Billing → Usage. Set a budget cap and review usage there; these are account-level controls and cannot be safely changed from application code.
- The API health endpoint is a lightweight availability check, not proof that Firebase, Stripe, or AI operations are healthy. Use the owner diagnostics and provider checks for those services.

## Portability and providers

The application uses Replit for hosting and App Storage, Firebase for Authentication and Firestore, Stripe for billing, and Google Gemini for AI. Keep provider credentials in the deployment’s environment configuration, keep service adapters isolated, and validate each provider after any hosting change. The app supports the current primary domain without requiring a paid domain.
