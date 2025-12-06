# CollabList

> Collaborative todo lists with shareable view/edit links, per-item voting, and real-time updates.

## Overview

CollabList pairs a friendly React UI with a lightweight Hono API (running through the `speed-framework`) to make ad-hoc planning effortless. Owners can spin up a list, pass around view or edit links (or QR codes), and everyone stays in sync thanks to server-sent events (SSE). Voting rules, sorting modes, and collaborator roles are all enforced server-side with SQLite-backed persistence.

### Feature Highlights

- **Shareable access tokens**: Every list gets permanent view/edit tokens surfaced in the Share dialog, so you can safely send read-only or editable links without requiring accounts.
- **Real-time presence**: `api/sse.ts` pushes `list.updated`, `item.*`, and `vote.updated` events, and the UI shows connection state via `SseStatusBadge`.
- **Flexible prioritization**: Open or restricted voting (`voting_policy`), drag-and-drop ordering when in `manual` mode, or automatic ordering by updates, creation time, or score.
- **Owner & collaborator workflows**: Signed-in users (via the Speed auth SDK) can manage collaborators, fork lists, and persist their own dashboard of lists.
- **Forkable templates**: Any list can be cloned (including items) to jump-start new planning sessions.

## Architecture at a Glance

- **Client**: React 19 + Vite 6 + Tailwind, organized under `src/` with route pages (`Home`, `ListPage`), dialog components, and a small API helper (`src/lib/api.ts`) that manages collaboration tokens and anonymous IDs.
- **API**: Hono routers under `api/` (`lists.ts`, `items.ts`, `votes.ts`, `users.ts`, `sse.ts`) wired up through `speed-framework`. Routes enforce per-role permissions and broadcast mutations over SSE.
- **Database**: SQLite (see `migrations/`) stores users, lists, items, votes, and collaborators. Apply migrations via `npm run db:apply`; inspect data with `npm run db:exec`.
- **Auth & identity**: The injected `speed` SDK exposes `speed.auth` and file uploads/LLM helpers (see `src/Example.tsx`). Collaboration tokens are cached in `localStorage` for unauthenticated editors.

## Getting Started

### Prerequisites

- Node.js 20+ (needed for Vite 6 and modern tooling)
- SQLite CLI (only if you want to inspect `.data/db.sqlite`)
- The Speed framework checkout available at `../framework` (installed automatically by `npm install`)

### Installation & Local Dev

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Provision the database**
   ```bash
   npm run db:apply
   ```
3. **Start the API (Speed runtime on port 4000)**
   ```bash
   npx speed dev --port 4000
   ```
   The CLI comes from the linked `speed-framework` and exposes the Hono routers in `api/`.
4. **Start the web client**
   ```bash
   npx vite dev --host
   ```
   The Vite dev server proxies `/api` to `http://localhost:4000` per `vite.config.ts`.

Visit `http://localhost:5173` to create or join a list. When you open a list via a view/edit token, the UI stores that token locally and reuses it for subsequent API calls.

### Useful Scripts

| Command | Purpose |
| --- | --- |
| `npm run lint` | ESLint across the repo (`eslint.config.js`) |
| `npm run check` | TypeScript project references build (`tsc -b`) |
| `npm run build` | Production React build via Vite |
| `npm run db:apply` | Run all SQL migrations against `.data/db.sqlite` |
| `npm run db:exec` | Open a SQLite shell on the project database |

## Development Notes

- Keep API changes in their domain files; each router is mounted by the Speed runtime automatically.
- When you introduce a new migration, follow the incremental numbering pattern in `migrations/` so `db:apply` stays deterministic.
- The front end expects `speed-sdk.js` to be injected (the Speed hosting platform handles `%VITE_DEV_SCRIPT%` and global `speed`). If you run outside that environment, make sure the SDK script is served.
- Real-time UX depends on SSE; avoid long-poll fallbacks unless you also update `SseStatusBadge` and reconnection logic in `ListPage`.

## Deployment

1. `npm run build` to generate the optimized client bundle.
2. Deploy the API (Speed/Node) so the Hono routes run on port 4000 or update the proxy target.
3. Upload the `dist/` assets plus `public/` static files. Ensure `speed-sdk.js` remains available before the React bundle executes.

That’s it—clone, install, run the migrations, and you can start sharing collaborative lists in a few minutes.
