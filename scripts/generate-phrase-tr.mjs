/**
 * Generates scripts/phrase-tr-by-key.json from embedded TR_BY_KEY map.
 * Run: node scripts/generate-phrase-tr.mjs
 */
import fs from "node:fs"
import path from "node:path"
import { enFlat } from "./flatten-code-messages.mjs"
import { codeMessagesTrOverrides } from "../src/lib/i18n/code-messages-tr-overrides.ts"
import { TR_EXACT_EXPORT } from "../src/lib/i18n/fallback-translations.ts"

function flatten(tree, prefix = "") {
  const out = {}
  for (const [key, value] of Object.entries(tree)) {
    const p = prefix ? `${prefix}.${key}` : key
    if (typeof value === "string") out[p] = value
    else Object.assign(out, flatten(value, p))
  }
  return out
}

const overrides = flatten(codeMessagesTrOverrides)

/** Keyed Turkish — complete sentences, no hybrid English. */
const TR_BY_KEY = {
  "appointments.awaitingCheckinBannerHint":
    "Sıra panosunu açın — ilk sütun Check-in. Gelen her hasta için Check-in to Waiting yapın.",
  "appointments.awaitingCheckinBannerTitle": "{n} hastanın Sıra'da check-in'i gerekiyor",
  "appointments.bookModalHint":
    "Randevu gelecekteki gelişi planlar. Hasta zaten klinikteyse Sıra > Hasta gelişi kullanın.",
  "appointments.calendarReportHint":
    "Salt okunur randevu planlayıcı görünümü. Canlı randevuları değiştirmeden kimin rezerve olduğunu, hangi diş hekiminin atandığını, ziyaret nedenini ve günlük yükü inceleyin.",
  "appointments.checkInOnQueueTitle": "Hasta check-in'i Sıra panosunda yapılır",
  "appointments.checkingIn": "Check-in yapılıyor…",
  "appointments.configureSlots": "Çalışma saatleri ve slotları yapılandır",
  "appointments.daySummaryPast": "Program özeti — {day}",
  "appointments.leakageMix": "Program sızıntısı",
  "appointments.metricPortal": "Online randevular",
  "appointments.missingNotesHint":
    "Son tamamlanan randevuları inceleyin ve ziyaret için klinik not imzalamak üzere hasta chart'ını açın.",
  "appointments.missingNotesTitle": "Tamamlanan ziyaretlerde klinik not gerekebilir",
  "appointments.monthBoardBooked": "dolu slot",
  "appointments.monthBoardFooter":
    "Hangi günlerin dolu olduğunu, kimin rezerve olduğunu ve ne tür ziyaretlerin geleceğini görmek için bu panoyu kullanın; ardından tam randevu planlayıcıya geçin.",
  "appointments.monthBoardHint":
    "Canlı planlayıcıyı açmadan önce saat, hasta, atanan diş hekimi ve ziyaret nedenini gösteren salt okunur aylık görünüm.",
  "appointments.occupancy": "Program doluluk ({days}g)",
  "appointments.peakHour": "Yoğun saat",
  "appointments.peakHourEmpty": "Henüz yoğunluk yok",
  "appointments.periodReportHint":
    "Seçilen dönem için program baskısı, sızıntı ve koltuk talebine hızlı bakış.",
  "appointments.pickOpenSlot": "Randevu için uygun bir slot seçin.",
  "appointments.portalFilterTitle": "Yalnızca online portal randevuları gösteriliyor",
  "appointments.providerUtilization": "Hekim kullanımı",
  "appointments.slotPast": "Geçmiş",
  "appointments.slotsConfigured": "Bu hekim için çalışma saatleri tanımlandı.",
  "appointments.summaryTotalSub": "Bu klinik gününde",
  "appointments.summaryUpcoming": "Yaklaşan",
  "appointments.viewTodayTitle": "Bugün gösteriliyor",
  "audit.dailyVolume": "Günlük hacim",
  "audit.historyTitle": "Etkinlik geçmişi",
  "billing.applyDiscount": "Uygula",
  "billing.approveClaim": "Onayla",
  "billing.discount": "İndirim",
  "billing.discountSaved": "İndirim uygulandı",
  "billing.emptyPatientHint":
    "Bu hastanın henüz faturası yok. Tedavi planından başlayın veya manuel fatura oluşturun.",
  "billing.gateFriendly":
    "Check-in öncesi açık faturalama incelenmelidir. Ödeme alın veya yetkiniz varsa geçersiz kılın.",
  "billing.gatewayDryRun":
    "Sandbox modu: PAYMONGO_SECRET_KEY sunucuda yapılandırılana kadar ödeme bağlantıları yer tutucudur. Önizlemek için bağlantıyı açın, hasta ödedikten sonra ödemeyi kaydedin.",
  "billing.hmoPending": "İşlemde",
  "billing.hmoQueueHint":
    "Taslak talepler burada hazırlanır, ardından sağlayıcı incelemesi ve ödeme için gönderilir.",
  "billing.hmoRejectReason": "Red nedeni",
  "billing.hmoSubtitle": "Sağlayıcı taleplerini tek kuyruktan hazırlayın, inceleyin ve kapatın.",
  "billing.hubSubtitle": "Faturalar, ödemeler, HMO talepleri ve PhilHealth senkronu tek yerde.",
  "billing.metricPaidHint": "Tamamen kapatıldı",
  "billing.onlinePaymentLive":
    "Canlı PayMongo ödemesi aktif. Ödeme bağlantısını açın, onaydan sonra faturayı ödendi olarak işaretleyin.",
  "billing.outstanding": "Açık",
  "billing.paymentCompleteHint": "Hasta chart'ına dönün veya çıkış için makbuz yazdırın.",
  "billing.paymongoTitle": "PayMongo online ödeme",
  "billing.phIncomplete": "Eksik",
  "billing.phReadyHint": "Kontrol listesi tamam",
  "billing.phSubmitted": "Senkronize",
  "billing.philhealthIntegration": "PhilHealth eClaims senkronu",
  "billing.providerRef": "Sağlayıcı ref.",
  "billing.rejectClaim": "Reddet",
  "billing.rejectionReason": "Red",
  "billing.reportsDescription":
    "Yedi günlük tahsilat trendleri ve alacak yaşlandırması Raporlar > Finans bölümündedir.",
  "billing.reportsTitle": "Tahsilat ve alacak analitiği",
  "billing.returnToQueueAction": "Sıra'ya dön",
  "billing.returnToQueueBody":
    "Ödeme aldıktan veya faturalamayı inceledikten sonra check-in'i tamamlamak için Sıra'ya dönün.",
  "billing.settled": "Tamamen kapatıldı",
  "billing.submitClaim": "Gönder",
  "billing.subtotal": "Ara toplam",
  "billing.summaryTotalSub": "Tüm durumlar",
  "billing.workflowBillingGate": "Randevu ve check-in kilidi",
  "billing.workflowInvoiceDraft": "Plan onay olayı",
}

// Merge: overrides win, then TR_BY_KEY, then API en→tr, then TR_EXACT
const phrase = { ...TR_BY_KEY }
for (const [key, tr] of Object.entries(overrides)) {
  if (tr) phrase[key] = tr
}

const apiPath = path.join(process.cwd(), "scripts/en-to-tr-api.json")
const api = fs.existsSync(apiPath) ? JSON.parse(fs.readFileSync(apiPath, "utf8")) : {}

let added = 0
let fromApi = 0
for (const [key, en] of Object.entries(enFlat)) {
  if (phrase[key]) continue
  if (api[en]) {
    phrase[key] = api[en]
    fromApi++
    continue
  }
  if (TR_EXACT_EXPORT[en]) {
    phrase[key] = TR_EXACT_EXPORT[en]
    added++
  }
}

const outPath = path.join(process.cwd(), "scripts/phrase-tr-by-key.json")
fs.writeFileSync(outPath, JSON.stringify(phrase, null, 2), "utf8")
console.log(
  `phrase-tr-by-key.json: ${Object.keys(phrase).length} keys (${Object.keys(TR_BY_KEY).length} hand-tuned, +${fromApi} API, +${added} TR_EXACT)`
)
console.log(`Still missing keys: ${Object.keys(enFlat).length - Object.keys(phrase).length}`)
