# Modül 01: Organization & Multi-Branch

## Backend / Database
- [x] `organizations` tablosuna eksik alanların eklenmesi
- [x] `branches` ve `branch_settings` tablolarının güncellenmesi
- [x] RLS poliçelerinin yazılması (org_id ve branch_id tabanlı)
- [x] RPC: `current_user_org_id()` ve `user_has_branch_access()`
- [x] RPC: `get_branch_context()`, `get_my_branches()`

## UI Bileşenleri
- [x] `BranchSwitcher` bileşeni (Supabase sync + permission reload)
- [x] `BranchBootstrap` — login sonrası branch listesi yükleme
- [x] `useBranch` hook'unun oluşturulması

## Frontend Ekranları
- [x] `/settings/organization` sayfası (Supabase CRUD)
- [x] `/settings/branches` sayfası (liste + create)
- [x] `/settings/branches/[id]` sayfası (branch profile + regional overrides Q128)
- [x] `useBranchContext` hook + `branch-context-service`
- [x] Branch switcher `branchRevision` invalidation (Q132)
- [x] **Branch deactivate audit** — `deactivate_branch` RPC (reason, audit, token revoke, last-active guard), inactive branches in settings list (Q133)
