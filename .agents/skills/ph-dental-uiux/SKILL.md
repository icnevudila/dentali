---
name: ph-dental-uiux
description: Use this skill when designing or implementing UI/UX for the Philippines multi-branch dental clinic operating system. It enforces the product's UI/UX master rules, Supabase-aware states, module relationships, and anti-slop design constraints.
---

# PH Dental UI/UX Skill

Before designing or coding any screen, read:

- docs/00-master/04_UI_UX_MASTER_RULES.md
- docs/00-master/03_SUPABASE_BACKEND_RULES.md
- docs/00-master/01_MODULE_MAP.md
- the relevant module MD file
- the relevant example screen under docs/screens

## Rules

- Do not invent colors, spacing, components, dashboard layouts, or decorative gradients.
- Use the product design system from the docs.
- Every screen must include loading, empty, error, permission denied, saving, saved, and failed states where relevant.
- Every screen must respect organization and branch context.
- Every UI action that changes sensitive data must map to a Supabase permission/RLS rule.
- Do not implement UI before producing:
  1. component tree
  2. user flow
  3. backend tables/RPC/Edge Functions used
  4. module integrations
  5. error and permission states
  6. test checklist

For dental chart, intake, medical history, consent, treatment plan, appointments, invoice, HMO, kiosk, and queue screens, preserve real clinic workflow over decorative UI.
