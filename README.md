# Paperclip Native

A Tauri 2 + Next.js cross-platform app that connects to one or more
[Paperclip](https://paperclip.ing) instances and lets you view data and
control flows (issues, routines, approvals, runs) from desktop or mobile.

This repo is the implementation of the plan attached to issue
`ROU-30 — app plan`. It is intentionally a **standalone repo** rather than
a sibling package inside the Paperclip monorepo, so it can be installed,
versioned, and signed independently.

## Status

Phase 1 scaffold:

- [x] Workspace, build config, lint config
- [x] Multi-instance picker with persisted secure-ish storage (localStorage today, OS keystore via `tauri-plugin-store` is the wired-up next step)
- [x] Bearer-auth API client (`createClient(instance)`)
- [x] Inbox / Issue detail / Routines / Approvals views
- [x] Issue mutations: status change, post comment
- [x] Routine "Run now" action
- [x] WebSocket subscriber against `/api/companies/:cid/events/ws`
- [ ] Mobile builds (Android first, iOS pending signing)
- [ ] Push notifications (server-side relay required)
- [ ] CI workflow (Gitea Actions)

## Architecture (one-liner per layer)

| Layer        | Choice                                                     |
| ------------ | ---------------------------------------------------------- |
| Shell        | Tauri 2 (`src-tauri/`)                                     |
| Frontend     | Next.js 15 App Router with `output: 'export'`              |
| Styling      | Tailwind v3 (token-based, dark by default)                 |
| State        | Zustand (instances) + TanStack Query (server cache)        |
| HTTP         | `fetch` wrapper, `Authorization: Bearer ${apiKey}` per call |
| Realtime     | `WebSocket` with exponential-backoff reconnect             |
| Auth         | Bearer API key per instance (validated via `/api/agents/me`) |
| Secret store | OS keystore via `tauri-plugin-store` (in progress)         |

## Development

Prerequisites: Node 20+, pnpm 9+, Rust stable (`rustup install stable`),
plus the platform Tauri toolchain prereqs from
<https://v2.tauri.app/start/prerequisites/>.

```bash
pnpm install
pnpm tauri:dev          # desktop dev window
pnpm android:dev        # Android device/emulator
pnpm ios:dev            # iOS simulator (signing not configured yet)
```

Pure web preview without Tauri: `pnpm dev` and open <http://localhost:1420>.

## Build

```bash
pnpm tauri:build        # signed bundle in src-tauri/target/release/bundle/
pnpm android:build      # APK / AAB in src-tauri/gen/android/...
```

## Configuration

The app stores instance records (`{ baseUrl, apiKey, defaultCompanyId }`)
locally per device. Add an instance from the onboarding screen by pasting
the Paperclip API URL plus an API key — the app calls `GET /api/agents/me`
to validate before saving.

## Known gotcha: `NODE_ENV`

`next build` will fail with cryptic `<Html> should not be imported outside of pages/_document` errors if `NODE_ENV` is set to anything other than `production` in the parent shell. The Next.js binary normally sets `NODE_ENV=production` itself, but a leaked development value from the surrounding environment overrides it. If you see this error, run `NODE_ENV=production pnpm build`.

## Layout

```
.
├── src/                    Next.js App Router source
│   ├── app/                pages, layout, globals.css
│   ├── components/         UI, providers, views
│   └── lib/                api/, store/, utils
├── src-tauri/              Rust shell (desktop + mobile entry)
└── next.config.mjs         output: 'export', images.unoptimized: true
```

## License

Same license intent as Paperclip itself; placeholder until decided.
