# Paperclip Native

A Tauri 2 + Next.js cross-platform app that connects to one or more
[Paperclip](https://paperclip.ing) instances and lets you view data and
control flows (issues, routines, approvals, runs) from desktop or mobile.

This repo is the implementation of the plan attached to issue
`ROU-30 — app plan`. It is intentionally a **standalone repo** rather than
a sibling package inside the Paperclip monorepo, so it can be installed,
versioned, and signed independently.

## Status

Phase 1 scaffold + V2 (Phase 7) surfaces:

- [x] Workspace, build config, lint config
- [x] Multi-instance picker (`{ baseUrl, apiKey }`) persisted via `tauri-plugin-store` (OS-encrypted file) with `localStorage` fallback for the web preview
- [x] `pck_…` API-key onboarding (validated via `GET /api/agents/me`)
- [x] Bearer-auth API client (`createClient(instance)`)
- [x] Inbox / Issue detail / Routines / Approvals views
- [x] Channels view — list + add (Nostr / Telegram), test, ad-hoc DM, graceful 501 banner while ROU-53 / ROU-54 ship
- [x] Layers view — stack list, reorder, enable / disable, edit JSON config, audit-log viewer
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

The single entrypoint is `scripts/build.sh`. It honours the `NODE_ENV=production`
gotcha (see below), checks toolchain presence, and produces artifacts in
predictable locations.

```bash
./scripts/build.sh             # web → desktop → android (skips ios off macOS)
./scripts/build.sh web         # Next.js static export only → ./out
./scripts/build.sh desktop     # web + Tauri desktop bundle
./scripts/build.sh android     # web + Tauri Android APK/AAB
./scripts/build.sh ios         # macOS host only
./scripts/build.sh desktop --debug
```

Direct shortcuts (also fine):

```bash
pnpm build                # web only
pnpm tauri:build          # desktop bundle in src-tauri/target/release/bundle/
pnpm android:build        # APK / AAB in src-tauri/gen/android/...
```

### System prerequisites

The Rust shell links against platform GUI libraries. Install these once on the
build host:

- **Linux (Debian/Ubuntu)** — required for desktop builds:

  ```bash
  sudo apt install -y \
    libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev \
    libayatana-appindicator3-dev libssl-dev libsoup-3.0-dev \
    pkg-config build-essential
  ```

- **macOS** — `xcode-select --install`. Add Apple Developer signing certs
  for distributable builds.

- **Windows** — Microsoft C++ Build Tools and the Windows 10/11 SDK.

- **Android** — install the Android SDK + NDK (NDK 26+), then export:

  ```bash
  export ANDROID_HOME=/path/to/android-sdk
  export NDK_HOME="$ANDROID_HOME/ndk/<version>"
  export JAVA_HOME=/path/to/jdk-17
  ```

  Run `pnpm tauri android init` once before the first Android build to
  scaffold `src-tauri/gen/android/`.

- **iOS** — macOS host only; run `pnpm tauri ios init` once. Signing is
  parked until an Apple Developer account is provisioned (mirrors Bloom
  in its current state).

## Configuration

The app stores instance records (`{ baseUrl, apiKey, defaultCompanyId }`)
per device. Add an instance from the onboarding screen by pasting the
Paperclip URL plus a `pck_…` API key (issued by
`POST /api/companies/:cid/api-keys` once Phase 6 / ROU-42 is deployed —
V2 listens on `:3210`). The app calls `GET /api/agents/me` to validate
before saving.

Secrets are persisted by `@tauri-apps/plugin-store` to a per-OS encrypted
file (the Tauri-managed app data dir). When running the bare web preview
without Tauri, the persistence layer falls back to `localStorage` so dev
flows still work.

### V2 surfaces

The Channels and Layers screens require the V2 server (port `:3210`,
`FEATURE_V2=1`). When a route returns the structured `not_implemented`
envelope, the UI shows a "Phase X — shipping in ROU-…" banner instead of
a raw error so the screen lights up automatically once the dependency
phase ships.

## Known gotcha: `NODE_ENV`

`next build` will fail with cryptic `<Html> should not be imported outside of pages/_document` errors if `NODE_ENV` is set to anything other than `production` in the parent shell. The Next.js binary normally sets `NODE_ENV=production` itself, but a leaked development value from the surrounding environment overrides it. If you see this error, run `NODE_ENV=production pnpm build`.

## Layout

```
.
├── pages/                  Next.js Pages Router (output: 'export')
│   ├── _app.tsx            providers (TanStack Query, Head)
│   ├── _error.tsx          custom error page
│   ├── 404.tsx             custom 404
│   └── index.tsx           main entry, dynamic-imports HomeApp (ssr: false)
├── src/
│   ├── components/         views, providers, ui primitives
│   ├── lib/                api/ (client, types, realtime), store/, utils
│   └── styles/globals.css  Tailwind entry + tokens
├── src-tauri/              Rust shell (desktop + mobile entry)
├── scripts/build.sh        single build entrypoint (web / desktop / android / ios / all)
└── next.config.mjs         output: 'export', images.unoptimized: true
```

## License

Same license intent as Paperclip itself; placeholder until decided.
