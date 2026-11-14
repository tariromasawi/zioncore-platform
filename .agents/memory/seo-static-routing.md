---
name: Static SEO routing
description: Route crawlable landing-page HTML separately from the ZionCore SPA fallback.
---

For this root Vite SPA, a nested public `index.html` does not by itself guarantee that the clean `/slug/` URL will serve that page. The development server can fall back to the app shell, and production has a wildcard rewrite. Add a matching development route handler and a specific production rewrite before the wildcard; keep the canonical URL, sitemap URL, and tested route aligned.

One-off shell builds also need the required `PORT` and `BASE_PATH` values that the managed artifact workflow normally injects.

**Why:** A route may return HTTP 200 while serving the wrong HTML, making a sitemap appear valid but leaving crawlers with the SPA shell instead of the intended page. Manual builds also fail early when the managed workflow environment is absent.

**How to apply:** For each future public SEO page, verify the page-specific title and canonical from the clean URL after restarting the web workflow, confirm the production rewrite order, and provide `PORT` plus `BASE_PATH` for direct build commands.
