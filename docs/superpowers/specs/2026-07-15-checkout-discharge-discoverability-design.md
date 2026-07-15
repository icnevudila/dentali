# Checkout / Discharge discoverability

## Goal

Make the operational “finish today’s visit” action obvious so staff do not confuse it with the epicrisis discharge *document*.

## Product language

| Concept | Label (EN) | Label (TR) |
|---------|------------|------------|
| Close today’s visit | Checkout / Discharge | Çıkış / Taburcu |
| Wizard | Patient checkout | Hasta çıkışı |
| Epicrisis PDF/print | Discharge summary (document) | Epikriz belgesi |

## Entry points

1. **Patient profile header** — primary button when encounter is open.
2. **Visit journey panel** — finish action whenever encounter is open (soft-gated wizard).
3. **Queue · In Chair** — primary column action (status → served + opens wizard).
4. **Epicrisis page** — banner: document only; link back to checkout.

## Non-goals

- No new backend status or RPC.
- Queue status enum stays `served`.
