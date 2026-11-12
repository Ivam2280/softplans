# Contributing

## Setup

Use Node.js 24 or newer, then install the locked dependencies and browser engines:

```bash
npm ci
npx playwright install chromium webkit
npm run dev
```

Linux browser tests may also need system packages: use `npx playwright install --with-deps chromium webkit`.

## Before submitting a change

```bash
npm run format
npm run check
npm run test:e2e
```

Browser tests build and serve the production app under `/SoftPlans/`. Keep port 4173 free so tests exercise their own build. The test suite includes task and group workflows, date and time pickers, backups, legacy storage, save failures, cross-tab updates, responsive layouts and accessibility scans.

Use focused unit tests for data logic and browser tests for interactions. Keep all three translation dictionaries in sync. Changes to persistence must preserve existing saved workspaces and validate imported data before writing it.

## Screenshots and icons

With the development server running on port 3000:

```bash
npm run screenshots
```

The script creates 18 WebP images across desktop, mobile and tablet views at 2× pixel density. Desktop and tablet images appear individually in the README; additional views are grouped in expandable galleries.

It uses an isolated browser context and a fixed date, so it does not modify your normal browser data. Before each capture, it waits at least 2.5 seconds, then waits for finite animations and a painted frame. Normal motion remains enabled so the captured dialogs, overlays and blur match the actual interface.

Override `SCREENSHOT_BASE_URL` to capture a different local server. Review every image and update README captions if the interface changes.

After changing `public/icons/icon.svg`, run `npm run icons` to regenerate the PNG variants.

## Pull requests

Describe the user-visible change, relevant tradeoffs and checks performed. Include screenshots for visual changes. Do not commit `node_modules/`, `dist/`, browser test output or personal task backups.
