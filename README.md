# dentQL

Philippines-focused, multi-branch dental clinic operating system — patients, charting, queue, billing, HMO, inventory, and workflow automation on **Next.js 16 + Supabase**.

## Quick start

```bash
npm install
cp .env.example .env.local   # Supabase URL, anon key, etc.
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Full setup: [README_INSTALL.md](./README_INSTALL.md).

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript check |
| `npm run quality:ci` | Lint + typecheck + i18n audit + build |
| `npm run test:e2e` | Playwright smoke / journey specs |
| `supabase db push` | Apply pending migrations to linked project |

## Documentation

| Doc | Contents |
|-----|----------|
| [docs/00_README_START_HERE.md](./docs/00_README_START_HERE.md) | Doc index |
| [docs/15_ROADMAP_AND_TODOS.md](./docs/15_ROADMAP_AND_TODOS.md) | Sprint roadmap |
| [docs/README.md](./docs/README.md) | 24-module A–Z product pack |
| [tasks/POLISH_QUEUE.md](./tasks/POLISH_QUEUE.md) | Polish / hardening backlog |

## Recent platform notes

- **Permissions:** `inventory.read` / `inventory.write` (migration `20260620120000_inventory_permissions.sql`); legacy `settings.manage` still grants full inventory access.
- **Workflow:** Branch Google review URL + intake consent slugs; see migrations `20260620100000_*` and `20260620110000_*`.
- **i18n:** App UI (EN / TR / FIL), marketing pages, and PDA intake forms use `src/lib/i18n/`.

## Deploy

Vercel + Supabase. See [README_INSTALL.md](./README_INSTALL.md) and `docs/SUPABASE_CRON_SETUP.md` for cron jobs (SMS reminders, owner digest, etc.).
