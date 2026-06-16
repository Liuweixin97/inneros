# Local Dev Server Notes

This project currently uses Next.js 16.2.7. In Next 16, `next dev` uses Turbopack by default. During the forest-world UI work, the local Turbopack dev server entered a bad state once: the `next-server` process kept running at high CPU and stopped responding reliably to browser navigation.

## Standard Command

Use the normal development command:

```bash
npm run dev
```

This runs:

```bash
next dev --webpack
```

The webpack dev server is currently the default because it has been more stable for this project than Turbopack during long UI iteration sessions.

## Automatic Stale Process Cleanup

`npm run dev` has a `predev` hook:

```bash
node scripts/kill-dev-server.mjs
```

Before starting Next.js, the script checks port `3000`. If an old process is still listening on that port, it sends `SIGTERM`, then falls back to `SIGKILL` if needed.

Manual cleanup is also available:

```bash
npm run dev:kill
```

## Turbopack Is Still Available

If you want to test Turbopack again:

```bash
npm run dev:turbo
```

Use this only when you specifically want to compare performance or verify whether the upstream Turbopack issue has stopped reproducing.

## Next.js Dev Indicator

The on-screen Next.js development indicator is disabled in `next.config.ts`:

```ts
devIndicators: false
```

Compile and runtime errors will still appear. Only the persistent route/status indicator in the page UI is hidden.

## What To Check When The Site Feels Frozen

Run:

```bash
ps -axo pid,ppid,stat,%cpu,%mem,etime,command | rg "(next-server|next dev|npm run dev)"
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

If `next-server` is using very high CPU for a long time or has been running since an old session, clear it:

```bash
npm run dev:kill
npm run dev
```

