# Patient Record Requirements

Bu dosya kağıt dental kayıtlarının dijital gereksinimlere çevrilmiş halidir.

## 1. Patient Profile

### Zorunlu alanlar

- `firstName`
- `lastName`
- `birthDate`
- `sex`
- `primaryPhone`
- `addressLine`

### Opsiyonel alanlar

- `middleName`
- `nickname`
- `email`
- `occupation`
- `company`
- `officePhone`
- `guardianName`
- `guardianRelationship`
- `referralSource`
- `consultationReason`
- `nationality`
- `religion`

## 2. Medical History

Medical history versioned olmalı. Hasta her ziyarette güncelleyebilir, eski kayıtlar audit için saklanır.

### Core questions

Her soru şu formatta saklanmalı:

```ts
type MedicalQuestionAnswer = {
  key: string
  answer: 'yes' | 'no' | 'unknown'
  note?: string
}
```

### Question groups

- General health
- Medical treatment now
- Serious illness / surgery
- Hospitalization
- Medications
- Tobacco use
- Alcohol / drug use
- Allergies
- Pregnancy / nursing / birth control
- Blood type
- Blood pressure
- Conditions checklist

### Conditions checklist

- High blood pressure
- Low blood pressure
- Epilepsy / convulsions
- AIDS / HIV infection
- Sexually transmitted disease
- Stomach troubles / ulcers
- Fainting seizure
- Rapid weight loss
- Radiation therapy
- Joint replacement / implant
- Heart surgery
- Heart attack
- Thyroid problem
- Heart disease
- Heart murmur
- Hepatitis / liver disease
- Rheumatic fever
- Hay fever / allergies
- Respiratory problems
- Tuberculosis
- Swollen ankles
- Kidney disease
- Diabetes
- Chest pain
- Stroke
- Cancer / tumors
- Anemia
- Angina
- Asthma
- Emphysema
- Bleeding problems
- Blood diseases
- Head injuries
- Arthritis / rheumatism
- Other

## 3. Consent Records

Consent checkbox değil, imzalı belge mantığında düşünülmeli.

### Consent types

- General treatment consent
- Medication risk consent
- Change in treatment plan consent
- Radiograph consent
- Extraction/removal consent
- Crown/bridge consent
- Endodontic/root canal consent
- Periodontal treatment consent
- Filling consent
- Denture consent
- Data privacy consent

### Consent fields

```ts
type ConsentRecord = {
  id: string
  clinicId: string
  patientId: string
  type: ConsentType
  version: string
  bodyText: string
  accepted: boolean
  signedByName: string
  signerRole: 'patient' | 'guardian'
  signatureImageUrl?: string
  signedAt: string
  witnessedByUserId?: string
  ipAddress?: string
  deviceId?: string
}
```

## 4. Dental Chart / Odontogram

### Tooth condition codes

- `PRESENT`
- `DECAYED_FOR_FILLING`
- `MISSING_CARIES`
- `FILLED`
- `CARIES_FOR_EXTRACTION`
- `ROOT_FRAGMENT`
- `MISSING_OTHER`
- `IMPACTED`
- `SUPERNUMERARY`
- `UNERUPTED`

### Restoration/prosthetics codes

- `JACKET_CROWN`
- `AMALGAM_FILLING`
- `ABUTMENT`
- `PONTIC`
- `INLAY`
- `FIXED_CURE_COMPOSITE`
- `COMPOSITE_FILLING`
- `IMPLANT`
- `SEALANT`
- `REMOVABLE_DENTURE`

### Surgery codes

- `EXTRACTION_CARIES`
- `EXTRACTION_OTHER`

### Surface support

Her tooth item yüzey bazlı işaretlemeyi desteklemeli:

- Mesial
- Distal
- Buccal
- Lingual
- Occlusal / Incisal

```ts
type ToothFinding = {
  toothNo: string
  condition?: ToothConditionCode
  restorations: RestorationCode[]
  surgeries: SurgeryCode[]
  surfaces?: ToothSurface[]
  note?: string
  recordedByUserId: string
  recordedAt: string
}
```

## 5. Orthodontic Treatment Record

Kağıt ortodonti kaydındaki uzun tablonun dijital karşılığı:

```ts
type OrthoTreatmentRecord = {
  id: string
  patientId: string
  date: string
  procedure: string
  nextProcedureDate?: string
  paymentAmountMinor?: number
  balanceMinor?: number
  note?: string
  dentistId?: string
  signedByUserId?: string
}
```

## 6. Treatment Record

```ts
type TreatmentRecord = {
  id: string
  clinicId: string
  patientId: string
  appointmentId?: string
  dentistId: string
  date: string
  toothNos: string[]
  procedureCode?: string
  procedureName: string
  clinicalNotes?: string
  amountChargedMinor: number
  amountPaidMinor: number
  balanceMinor: number
  nextAppointmentAt?: string
  createdByUserId: string
}
```

## 7. Payment card migration

Fotoğraflardaki manuel ödeme kartları şu yapıya aktarılmalı:

- Initial balance
- Down payment
- Adjustment payment
- Installment payment
- Debit/credit movement
- Running balance
- Staff signature / verifier

MVP'de basit ledger yeterli:

```ts
type LedgerEntry = {
  id: string
  patientId: string
  invoiceId?: string
  date: string
  description: string
  debitMinor: number
  creditMinor: number
  balanceMinor: number
  createdByUserId: string
}
```

## 8. Data quality rules

- Birthdate gelecekte olamaz.
- Minor hastada guardian bilgisi istenir.
- Medical history son güncelleme tarihi hasta profilinde görünür.
- Consent olmadan invasive treatment başlatılamaz.
- Paid treatment record değiştirilecekse audit reason zorunlu.
- Dental chart değişiklikleri overwrite değil version olarak saklanır.
