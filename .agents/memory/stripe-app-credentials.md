---
name: Stripe app credentials
description: Distinguishes Stripe agent tools from credentials available to the running application.
---

Stripe MCP access is for agent-side inspection and actions; it is not an application API connection. A server-side Checkout integration needs a separate app/API credential path.

**Why:** Application code cannot call a custom MCP server, and agent access alone does not provide a Stripe secret to the app runtime.

**How to apply:** Before implementing or enabling Stripe Checkout, verify the server has a test-mode API credential and webhook secret. Keep live checkout disabled until owner approval, required compliance settings, and product entitlements are ready.
