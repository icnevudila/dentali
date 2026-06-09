# PH Dental App Docs — Repo Ready ZIP

Bu ZIP repo kök dizinine açılacak şekilde hazırlandı.

Açınca beklenen yapı doğrudan şöyle olur:

```txt
project-root/
  docs/
    00-master/
    01-foundation/
    02-patient-clinical/
    03-operations/
    04-billing-claims/
    05-control-intelligence/
    screens/
    README.md
    ALL_24_MODULES_MERGED.md
    module_manifest.json
```

AI agent artık şu pathleri bulabilmeli:

```txt
docs/00-master/00_PRODUCT_MASTER_PLAN.md
docs/00-master/01_MODULE_MAP.md
docs/00-master/02_MULTI_BRANCH_ARCHITECTURE.md
docs/00-master/03_SUPABASE_BACKEND_RULES.md
docs/00-master/04_UI_UX_MASTER_RULES.md
docs/00-master/05_AI_AGENT_RULES.md
docs/01-foundation/01_ORGANIZATION_MULTI_BRANCH.md
docs/01-foundation/02_AUTH_ROLES_PERMISSIONS.md
docs/01-foundation/03_STAFF_TEAM.md
docs/01-foundation/04_SETTINGS_CONFIGURATION.md
```

## Kullanım

1. ZIP'i proje/repo köküne çıkar.
2. AI agent'a `START_PHASE_1_PROMPT.md` içindeki promptu ver.
3. Agent önce dosyaları doğrulamalı, sonra Phase 1 planı çıkarmalı.
4. Plan onaylanmadan kod yazdırma.
