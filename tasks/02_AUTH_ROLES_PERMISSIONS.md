# Modül 02: Auth, Roles & Permissions

## Backend / Database
- [x] `roles`, `permissions`, `role_permissions` tabloları
- [x] `staff_branch_assignments` tablosu
- [x] RPC: `has_permission(permission_key, branch_id)`
- [x] RPC: `get_my_permissions()`, `get_my_branch_ids()`, `get_my_branches()`
- [x] Seed data: Varsayılan roller ve izinlerin eklenmesi
- [x] `session_audit_logs` tablosu

## UI Bileşenleri
- [x] `useAuth` ve `usePermission` hook'ları
- [x] `PermissionGate` + `PermissionDenied`
- [x] `permission-store` (branch değişince invalidate)

## Frontend Ekranları
- [x] `/login` sayfası (Supabase Auth + session audit)
- [x] `/settings/roles` sayfası (gerçek permission matrix)
