# Modül 18: Notifications / SMS

## Backend
- [x] `notification_templates`, `notification_logs`, `notification_branch_settings`
- [x] RPC `send_test_notification`, `get_notification_status`
- [x] Edge Function `send-sms` (Semaphore live provider when dry-run off + `SEMAPHORE_API_KEY`)
- [x] Edge Function `send-appointment-reminder` (template render + log)
- [x] Edge Function `daily-reminder-cron` (scheduled batch stub)

## UI
- [x] `/settings/notifications` — templates, dry-run, logs, live send via edge fn
- [x] Branch template overrides — effective templates RPC, upsert/reset, edge fn resolution (Q146)
- [x] `/appointments` day view — per-appointment reminder button

## Durum: ✅ MVP entegre (Q052, Q072, Q095, Q146 branch overrides)
