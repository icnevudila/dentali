# Modül 20: Invoices, Payments & Ledger

## Backend / Database
- [x] `invoices`, `invoice_payments`, `invoice_line_items` tabloları
- [x] RPC: `add_invoice_line_item` + total recalc trigger
- [x] RPC: `record_invoice_payment`
- [x] RPC: `void_invoice`
- [x] RPC: `create_payment_intent` / `complete_payment_intent` (gateway stub)
- [x] RPC: `get_patient_balance`
- [x] Invoice PDF — server-side `generate-invoice-pdf` edge fn + client download
- [x] Invoice print export (browser print HTML)
- [x] Billing list patient filter (`?patient=`)

## UI Bileşenleri
- [x] Invoice list + detail
- [x] Payment form + online payment stub
- [x] Void invoice (reason + audit)
- [x] Download PDF (server-side) + Print (browser: line items, status badge, branch header)
- [x] Billing list 7-day collections sparkline

## Frontend Ekranları
- [x] `/billing`
- [x] `/billing/[id]`

- [x] Patient profile balance card (overview)

- [x] **Payment gateway live** — `create-payment-intent` edge fn (PayMongo or stub), invoice detail online payment UI (Q134)

## Durum: ✅ MVP entegre (Q061, Q068, Q071, Q127, Q131, Q134, BACKLOG-02 print polish)
