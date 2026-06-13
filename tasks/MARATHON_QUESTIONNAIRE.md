# Marathon Soru Maratonu — Cevapla, Sonra Başlarız

> **Talimat:** Her bölümü sırayla cevapla. `CEVAP:` satırına yaz. Belirsiz bırakırsan güvenli varsayılanı ben seçerim ve not düşerim.
>
> **Kural:** Sen cevaplayana kadar yeni sayfaya geçmem; sayfa içinde de her buton çalışana kadar bitirmem.

---

## BÖLÜM A — Altyapı & Ortam (FAZ 0)

### A1. Supabase
- **A1.1** Supabase proje URL'in hazır mı? Migration'ları SQL Editor'da çalıştırdın mı?
  - CEVAP:
- **A1.2** Migration'ları ben `supabase db push` / CLI ile mi uygulayayım, sen manuel mi yaptın?
  - CEVAP: (ben CLI / sen manuel / henüz hiçbiri)
- **A1.3** Test için seed data istiyor musun? (fake org "Dentali Demo", 2 branch, 3 kullanıcı: owner, dentist, receptionist)
  - CEVAP: (evet otomatik seed / hayır kendi verim var / kısmi)
- **A1.4** Varsa test kullanıcı email/şifreleri (gerçek credential — sadece sen doldur, commit etmeyeceğim):
  - Owner: CEVAP:
  - Dentist: CEVAP:
  - Receptionist: CEVAP:

### A2. Vercel & GitHub
- **A2.1** Vercel projesi `icnevudila/dentali` repo'suna bağlı mı?
  - CEVAP:
- **A2.2** Vercel env'ler (`NEXT_PUBLIC_SUPABASE_URL`, `ANON_KEY`) Dashboard'da set mi?
  - CEVAP:
- **A2.3** Canlı URL (varsa):
  - CEVAP:
- **A2.4** Her commit'te auto-deploy istiyor musun?
  - CEVAP: (evet main / evet preview branch / hayır sadece local)

### A3. Proje & Build
- **A3.1** Klasör adı `2026dosyaisci` olacak mı, yoksa `2026 yeni dişçi` kalacak mı? (Turbopack Türkçe karakter sorunu var)
  - CEVAP:
- **A3.2** Ürün adı UI'da ne yazsın? (`dentali.` / `SmileHub PH` / `DentQL PH` / başka)
  - CEVAP:
- **A3.3** Dil: Tüm UI `en-PH` (İngilizce Filipinler) mı, Türkçe karışık mı?
  - CEVAP:
- **A3.4** Login olmadan dashboard'a erişim şu an kapalı — middleware redirect açayım mı?
  - CEVAP: (evet zorunlu login / hayır preview için açık kalsın)

---

## BÖLÜM B — Global UX & Teknik Kararlar

### B1. Tasarım
- **B1.1** Renk paleti: mevcut teal/clinical tonlar kalsın mı?
  - CEVAP:
- **B1.2** Toast bildirimleri: (sonner / basit inline banner / shadcn toast — henüz yok, hangisini ekleyeyim?)
  - CEVAP:
- **B1.3** Tablo bileşeni: native HTML table mı, yoksa DataTable kütüphanesi (TanStack Table) kurayım mı?
  - CEVAP:
- **B1.4** Export formatları hangi sayfalarda şart? (CSV / PDF / print)
  - Patients list: CEVAP:
  - Invoices: CEVAP:
  - Audit logs: CEVAP:
  - Reports: CEVAP:

### B2. Branch & Permission
- **B2.1** Kullanıcı login olunca branch seçilmemişse ne olsun?
  - CEVAP: (ilk branch auto / branch picker modal / /onboarding sayfası)
- **B2.2** Owner tüm branch'leri görür — doğru mu?
  - CEVAP:
- **B2.3** Receptionist hangi branch'lerde çalışabilir? (sadece atanan / tüm org)
  - CEVAP:
- **B2.4** Custom role oluşturma MVP'de olsun mu, yoksa 5 sabit role yeterli mi?
  - CEVAP:

### B3. Audit
- **B3.1** Her save işleminde `audit_logs` tablosuna yazayım mı?
  - CEVAP: (evet hepsi / sadece kritik modüller)
- **B3.2** Audit drawer (kayıt geçmişi) hangi sayfalarda görünsün?
  - CEVAP:

---

## BÖLÜM C — Modül 01: Organization & Multi-Branch

### SAYFA: `/settings/organization`
- **C1.1** Düzenlenebilir alanlar: name, address, contact_number — logo upload MVP'de olsun mu?
  - CEVAP:
- **C1.2** Timezone her zaman `Asia/Manila` kilitli mi?
  - CEVAP:
- **C1.3** Save sonrası: toast + inline success — hangisi?
  - CEVAP:

### SAYFA: `/settings/branches` + `/settings/branches/[id]`
- **C2.1** Branch oluşturma: sadece name zorunlu mu, address de zorunlu mu?
  - CEVAP:
- **C2.2** Branch deactivate (soft delete) butonu olsun mu? Deaktif branch seçilebilir mi?
  - CEVAP:
- **C2.3** Branch detail'de **clinic hours** grid (Paz–Cmt) bu sayfada mı, ayrı `/hours` route mu?
  - CEVAP:
- **C2.4** Varsayılan çalışma saatleri? (ör. 09:00–18:00, Pazar kapalı)
  - CEVAP:

### SAYFA: Topbar `BranchSwitcher`
- **C3.1** Branch değişince sayfa otomatik refresh / veri yenileme yeterli mi?
  - CEVAP:
- **C3.2** Branch adı kısaltılsın mı uzun isimlerde?
  - CEVAP:

---

## BÖLÜM D — Modül 02: Auth, Roles & Permissions

### SAYFA: `/login`
- **D1.1** Sadece email/password mi, magic link de olsun mu?
  - CEVAP:
- **D1.2** "Forgot password" linki MVP'de olsun mu?
  - CEVAP:
- **D1.3** `staff_profiles.is_active = false` ise login engellensin mi?
  - CEVAP:
- **D1.4** Login sonrası redirect: `/` dashboard mı?
  - CEVAP:

### SAYFA: `/settings/roles`
- **D2.1** MVP: salt okunur permission listesi yeterli mi, yoksa admin checkbox ile düzenlesin mi?
  - CEVAP:
- **D2.2** "Create Custom Role" butonu şimdi mi, Phase 2 mi?
  - CEVAP:

### Logout
- **D3.1** Logout nerede? (Topbar dropdown — şu an yok, ekleyeyim mi?)
  - CEVAP:
- **D3.2** Logout → session_audit_logs yazılsın mı?
  - CEVAP:

---

## BÖLÜM E — Modül 03: Staff & Team

### SAYFA: `/settings/staff`
- **E1.1** Staff invite: email ile Supabase invite mi, manuel "create user" mi?
  - CEVAP:
- **E1.2** Tablo kolonları: Name, Email, Role, Branches, Status — başka?
  - CEVAP:
- **E1.3** Staff detail sayfası `/settings/staff/[id]` ayrı route olsun mu?
  - CEVAP:
- **E1.4** Bir staff birden fazla branch'te farklı role olabilir mi?
  - CEVAP: (evet / hayır tek role tüm branch'lerde)

---

## BÖLÜM F — Modül 04: Settings & Configuration

### SAYFA: `/settings` hub
- **F1.1** Settings alt menüsü nasıl olsun?
  - CEVAP: (sidebar sub-nav / tabs / ayrı sayfalar — mevcut layout'a uygun tercih)
- **F1.2** Currency `PHP` read-only gösterilsin mi?
  - CEVAP:
- **F1.3** Notification templates MVP'de atla mı?
  - CEVAP:
- **F1.4** Kiosk / TV token ayarları Phase 2'de mi kalsın?
  - CEVAP:

---

## BÖLÜM G — Modül 05: Patient Registry

### SAYFA: `/patients`
- **G1.1** Hasta org-level mi (tüm branch'lerde aynı kayıt), branch link ayrı mı? (MD'ye uygun: org-level + branch visit link)
  - CEVAP: (MD'ye uy / farklı model — açıkla)
- **G1.2** Liste pagination: kaç satır? (25 / 50)
  - CEVAP:
- **G1.3** Arama: name + phone yeterli mi, OR number da şart mı?
  - CEVAP:
- **G1.4** Duplicate detection: aynı phone uyarısı modal mı, ayrı `/patients/duplicates` sayfası mı?
  - CEVAP:
- **G1.5** "New Patient" butonu → `/patients/new` mı?
  - CEVAP:

### SAYFA: `/patients/[id]` (Profile)
- **G2.1** Tab'lar MVP'de hangileri aktif olsun?
  - Overview: CEVAP: (evet/hayır)
  - Medical History: CEVAP:
  - Dental Chart: CEVAP:
  - Treatments: CEVAP:
  - Appointments: CEVAP:
  - Invoices: CEVAP:
  - Consents: CEVAP:
  - Documents: CEVAP:
  - Audit: CEVAP:
- **G2.2** Header actions: New appointment, Create invoice — hangileri şimdi?
  - CEVAP:
- **G2.3** Patient soft delete / archive olsun mu?
  - CEVAP:

### SAYFA: `/patients/[id]/edit`
- **G3.1** Hangi alanlar düzenlenebilir? (ad, telefon, email, adres, emergency contact, HMO — listele)
  - CEVAP:

---

## BÖLÜM H — Modül 06: Patient Intake

### SAYFA: `/patients/new`
- **H1.1** Wizard adımları onaylıyor musun?
  1. Personal info
  2. Contact & emergency
  3. Insurance / HMO
  4. Referral & reason
  5. Review & submit
  - CEVAP: (evet / değiştir — yaz)
- **H1.2** Draft kaydet (yarım form) MVP'de olsun mu?
  - CEVAP:
- **H1.3** Telefon formatı: `+63` zorunlu normalize mi?
  - CEVAP:
- **H1.4** Submit sonrası redirect: patient profile mı, chart mı?
  - CEVAP:

---

## BÖLÜM I — Modül 07: Medical History

### SAYFA: `/patients/[id]/medical-history` (route eklenecek)
- **I1.1** Kağıt formdaki tüm bölümler dijitalde olsun mu? (allergies, medications, pregnancy, conditions, blood type, BP)
  - CEVAP:
- **I1.2** Her save yeni version mu (append-only)?
  - CEVAP:
- **I1.3** `MedicalAlertBanner` chart + appointment'ta görünsün mü?
  - CEVAP:
- **I1.4** Dentist "reviewed" onayı zorunlu mu?
  - CEVAP:

---

## BÖLÜM J — Modül 08: Consent & Legal Forms

### SAYFA: `/patients/[id]/consents` + `/consents/[formId]`
- **J1.1** Consent türleri MVP'de hangileri?
  - Informed consent: CEVAP:
  - Treatment consent: CEVAP:
  - Data privacy (DPA): CEVAP:
- **J1.2** İmza: canvas signature pad yeterli mi?
  - CEVAP:
- **J1.3** İmzalı belge PDF olarak storage'a kaydedilsin mi?
  - CEVAP:
- **J1.4** Template metinleri admin düzenleyebilsin mi (`/settings/consent-templates`)?
  - CEVAP:
- **J1.5** Void consent: sadece admin + reason zorunlu mu?
  - CEVAP:

---

## BÖLÜM K — Modül 09: Dental Chart / Odontogram

### SAYFA: `/patients/[id]/chart`
- **K1.1** Anatomik SVG (zip) kalıcı görsel omurga — onaylıyor musun?
  - CEVAP:
- **K1.2** Primary teeth (51–85): ayrı grid mi, ikinci SVG mi, MVP'de atla mı?
  - CEVAP:
- **K1.3** Tooth surface seçimi (M/O/D/B/L) şart mı MVP'de?
  - CEVAP:
- **K1.4** Condition legend: hangi durumlar? (healthy, decayed, restored, missing, impacted — başka?)
  - CEVAP:
- **K1.5** Save: her diş anında mı, batch "Save Chart" butonu mu?
  - CEVAP:
- **K1.6** Chart version history UI MVP'de olsun mu?
  - CEVAP:
- **K1.7** Receptionist chart'ta read-only mi?
  - CEVAP:

### SAYFA: `/patients/[id]/tooth/[toothId]`
- **K2.1** Deep link sayfası drawer ile aynı form mu, yoksa sadece drawer yeterli mi?
  - CEVAP:

---

## BÖLÜM L — Modül 10: Treatment Plan

### SAYFA: `/patients/[id]/treatment-plan` (route eklenecek)
- **L1.1** Chart finding → "Add to plan" akışı şart mı?
  - CEVAP:
- **L1.2** Hasta onayı (signature/checkbox) MVP'de?
  - CEVAP:
- **L1.3** Onaylı plan → invoice draft dönüşümü bu sprint'te mi?
  - CEVAP:
- **L1.4** Procedure catalog (Modül 19) önce mi bitmeli?
  - CEVAP:

---

## BÖLÜM M — Modül 13: Appointments

### SAYFA: `/appointments` (henüz yok)
- **M1.1** MVP görünüm: day list yeterli mi, week calendar şart mı?
  - CEVAP:
- **M1.2** Appointment status flow onaylı mı? scheduled → confirmed → checked_in → completed / cancelled / no_show
  - CEVAP:
- **M1.3** Dentist filter şart mı?
  - CEVAP:
- **M1.4** Chair/room MVP'de olsun mu?
  - CEVAP:
- **M1.5** Drag-reschedule Phase 2 mi?
  - CEVAP:

---

## BÖLÜM N — Modül 19: Procedure Catalog

### SAYFA: `/settings/procedures` (henüz yok)
- **N1.1** Seed procedure listesi ekleyeyim mi? (cleaning, extraction, filling, root canal — örnek)
  - CEVAP:
- **N1.2** Fiyat branch override UI şart mı?
  - CEVAP:
- **N1.3** `tooth_required` flag procedure bazında mı?
  - CEVAP:

---

## BÖLÜM O — Modül 20: Invoices & Payments

### SAYFA: `/billing/invoices` + detail (henüz yok)
- **O1.1** OR number formatı? (otomatik sequential / manuel)
  - CEVAP:
- **O1.2** Partial payment MVP'de?
  - CEVAP:
- **O1.3** Void invoice: reason zorunlu + audit?
  - CEVAP:
- **O1.4** Print receipt: browser print CSS yeterli mi?
  - CEVAP:
- **O1.5** Patient profile'da open balance chip şart mı?
  - CEVAP:

---

## BÖLÜM P — Modül 24: Audit (MVP)

### SAYFA: `/settings/audit` (henüz yok)
- **P1.1** Audit viewer MVP'de read-only liste yeterli mi?
  - CEVAP:
- **P1.2** Filtreler: user, entity, date range — hepsi mi?
  - CEVAP:

---

## BÖLÜM Q — Dashboard `/`

- **Q1.1** MVP KPI kartları hangileri gerçek data alsın? (appointments today, waiting, payments — hangisi mock/empty kalabilir)
  - CEVAP:
- **Q1.2** "New appointment" primary CTA dashboard'da olsun mu?
  - CEVAP:
- **Q1.3** Queue / billing snapshot appointments modülü bitene kadar empty state mi?
  - CEVAP:

---

## BÖLÜM R — Phase 2 Modüller (şimdi mi, sonra mı?)

Her biri için: **şimdi / sonra / asla MVP'de değil**

| Modül | Karar |
|-------|-------|
| 11 Clinical Notes | CEVAP: |
| 12 Orthodontic | CEVAP: |
| 14 Waitlist | CEVAP: |
| 15 Check-in & Queue | CEVAP: |
| 16 Kiosk | CEVAP: |
| 17 TV Display | CEVAP: |
| 18 SMS | CEVAP: |
| 21 HMO Claims | CEVAP: |
| 22 PhilHealth | CEVAP: |
| 23 Inventory | CEVAP: |

---

## BÖLÜM S — Sidebar & Navigasyon

- **S1.1** Sidebar item'ları permission'a göre gizlensin mi?
  - CEVAP:
- **S1.2** Ek menü item'ları şimdi?
  - Queue: CEVAP:
  - Waitlist: CEVAP:
  - Reports: CEVAP:
  - HMO: CEVAP:

---

## BÖLÜM T — Senin Öncelik Sıran

- **T1** İlk tam bitmesini istediğin 3 sayfa (sırayla):
  1. CEVAP:
  2. CEVAP:
  3. CEVAP:

- **T2** MVP'de olmazsa olmaz tek özellik (bir cümle):
  - CEVAP:

- **T3** Kesinlikle istemediğin / ertele dediğin şey:
  - CEVAP:

- **T4** Başlamam için onay cümlesi (ör. "cevapları okudum, marathon başla"):
  - CEVAP:

---

*Dosyayı doldurup kaydet veya chat'e yapıştır. `T4` onayı gelmeden kod yazmam.*
