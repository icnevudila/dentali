# DICOM Windows Gateway (deferred)

**Status:** Planned — do last (after remaining clinic go-live items)  
**Date:** 2026-07-26  
**Scope choice:** Option **C** — C-STORE live path + Modality Worklist as disabled skeleton  
**Delivery approach:** Orthanc + PowerShell/Node helpers under `tools/dicom-gateway-windows/` (not a single PyInstaller exe)

## Goal

Run a **low-cost on-prem DICOM bridge** on a Windows PC so dental modalities can:

1. **C-STORE** images into Orthanc on the clinic LAN  
2. Optionally later pull **Modality Worklist** from today’s DentQL appointments  
3. Sync received studies into DentQL (`patient-documents`, category `xray`) for the existing radiology viewer

This is **not** a full PACS and does **not** run on Vercel. Cloud app stays as-is; the PC is the DIMSE endpoint.

## Non-goals (v1)

- Raspberry Pi package (later port of same config)  
- Full PACS archive / long-term retention policies  
- Automatic tooth-chart linking / measurements  
- Commercial vendor PACS replacement  
- Opening Orthanc to the public internet  

## Architecture

```
[Modalite] --C-STORE--> [Orthanc on Windows PC]
                              |
                              v
                     [sync agent (Node)]
                              |
                              v
              [Supabase Storage + patient_documents]
                              |
                              v
                 [DentQL PatientRadiologyPanel]

[DentQL appointments] --(flag on)--> [worklist generate] --> [Orthanc MWL]
                                                              ^
                                                         [Modalite query]
```

## Package layout (when implemented)

```
tools/dicom-gateway-windows/
  README.md                 # TR kurulum (klinik personeli)
  orthanc.json              # AE Title DENTQL, DICOM 4242, HTTP 8042
  Start-Gateway.bat
  Stop-Gateway.bat
  .env.example              # SUPABASE_URL, gateway credentials (no secrets in git)
  sync/
    watch-and-upload.mjs    # Orthanc changes → DentQL upload
  worklist/
    generate.mjs            # skeleton; WORKLIST_ENABLED=false by default
    sample-worklist.json
  scripts/
    Install-Notes.md        # Orthanc Windows installer steps
```

## C-STORE (v1 must-work)

| Setting | Value |
|--------|--------|
| AE Title | `DENTQL` |
| DICOM port | `4242` |
| Orthanc HTTP | `http://127.0.0.1:8042` |
| Network | Clinic LAN only; Windows firewall allow 4242 from modalities |

**Patient match (order):**

1. DICOM `PatientID` / Accession if it matches DentQL patient / appointment codes  
2. Else quarantine folder + staff manual attach in DentQL UI (minimal: log + skip auto-upload)

**Upload target:** existing `patient-documents` bucket + `category = xray` (same path as current radiology panel). Prefer storing original `.dcm` when MIME allows; otherwise lossless preview PNG + metadata sidecar in notes/metadata.

## Worklist (skeleton only until flagged on)

- `WORKLIST_ENABLED=false` by default  
- When enabled: pull today’s `appointments` for configured `branch_id` (Asia/Manila day bounds)  
- Map: patient name, PatientID, scheduled time, accession ≈ appointment id  
- Many cheap dental units lack MWL — C-STORE still valuable without it  

## Security / PHI

- No PHI in gateway console logs (ids only)  
- Service role or dedicated gateway key only on the PC `.env` (never commit)  
- Orthanc not exposed beyond LAN; prefer no port-forward  
- Audit: upload events should create organization audit entries like other document uploads  

## Success criteria

1. Test `.dcm` C-STOREd to Orthanc appears in Orthanc UI  
2. Sync agent attaches study to a known demo patient in DentQL radiology  
3. Worklist script runs dry-run and prints today’s appointment count without enabling MWL on Orthanc  
4. Pi later: same Orthanc config + Node scripts  

## Implementation order (when unblocked)

1. Scaffold `tools/dicom-gateway-windows/` + Orthanc config + bat launchers  
2. Sync agent MVP (manual Orthanc study id → patient id CLI first)  
3. Watch mode  
4. Worklist skeleton + flag  
5. Docs: modality AE Title checklist  
6. Optional: DentQL “unmatched DICOM” staff UI  

## Dependencies / blockers before starting

- Finish other remaining go-live items (secrets, RLS, smoke)  
- Confirm at least one clinic modality supports C-STORE to a custom AE Title  
- Decide gateway auth: service role on PC vs dedicated Edge RPC with scoped key  

## Decision log

- 2026-07-26: User chose scope **C** and approach **Orthanc + scripts**  
- 2026-07-26: User deferred implementation — write plan now, implement **last**
