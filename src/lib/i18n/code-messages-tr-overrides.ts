/**
 * Hand-tuned Turkish for high-traffic UI strings from code-messages.
 * Merged after auto-generated codeMessagesTr. Edit here for quality fixes.
 */
import type { MessageTree } from "./message-tree"

export const codeMessagesTrOverrides: MessageTree = {
  appointments: {
    awaitingCheckinBannerHint:
      "Sıra panosunu açın — ilk sütun Check-in. Gelen her hasta için Check-in to Waiting yapın.",
    awaitingCheckinBannerTitle: "{n} hastanın Queue'da check-in'i gerekiyor",
    bookModalHint:
      "Randevu gelecekteki gelişi planlar. Hasta zaten klinikteyse Sıra > Hasta gelişi kullanın.",
    checkInOnQueueHint: "Sıra panosunu açın — ilk sütun bugünkü listeyi gösterir",
    checkInOnQueueTitle: "Hasta check-in'i Sıra panosunda yapılır",
    daySummaryToggle: "Gün özeti ve metrikler",
    metricAwaitingCheckin: "Check-in bekliyor",
    metricAwaitingCheckinHint: "Bugün henüz check-in yapılmadı",
    metricPortal: "Online randevular",
    metricPortalHint: "Hasta portalı — filtrelemek için dokunun",
    metricPortalWeekHint: "Bu hafta {week} — filtrelemek için dokunun",
    missingNotesHint:
      "Son tamamlanan randevuları inceleyin ve ziyaret için klinik not imzalamak üzere hasta chart'ını açın.",
    missingNotesTitle: "Tamamlanan ziyaretlerde klinik not gerekebilir",
    openQueueCheckIn: "Check-in için Sıra'yı aç",
    portalFilterHint:
      "Portaldan yeni hasta kayıtları Hastalar → Bekleyen kayıtlar altında görünür.",
    portalFilterTitle: "Yalnızca online portal randevuları gösteriliyor",
    purposeRequired: "Bu ziyaret için bir amaç girin.",
    searchPatientHint: "En az 2 karakter yazın, ardından listeden hasta seçin.",
    selectPatientFirst: "Randevu oluşturmadan önce bir hasta seçin.",
    selectValidSlot: "Uygun bir saat seçin.",
    slotsConfigured: "Bu hekim için çalışma saatleri tanımlandı.",
    statusFilterHint:
      "Panel veya rapor KPI'sından açıldı. Tam takvime dönmek için filtreyi temizleyin.",
    statusFilterTitle: "{status} randevuları gösteriliyor",
    viewTodayHint: "Takvim bugüne odaklı",
    viewTodayTitle: "Bugün gösteriliyor",
    viewWaitlist: "Bekleme listesini görüntüle",
    workflowCheckinSync: "Sıra check-in senkronu",
    workflowNoShow: "Otomatik gelmedi kuralı",
    workflowWaitlist: "Bekleme listesi slot uyarıları",
    whatsAppReminderBody:
      "Merhaba {patient}, {clinic} kliniğindeki diş randevunuz için hatırlatma: {date} {time}.",
    providerBusyWarning: "Uyarı: Bu diş hekiminin aynı saatte zaten bir randevusu var. Yine de kaydetmek istiyor musunuz?",
    chairLimitWarning: "Uyarı: Bu saatte klinikteki tüm diş koltukları (maksimum {limit}) doludur. Yine de kaydetmek istiyor musunuz?",
  },
  billing: {
    approveClaim: "Onayla",
    claimDetail: "Talep detayı",
    claimStatus: "Durum",
    eyebrow: "Faturalama",
    gateFriendly:
      "Check-in öncesi açık faturalama incelenmelidir. Ödeme alın veya yetkiniz varsa geçersiz kılın.",
    gateShort: "Check-in öncesi faturalama incelemesi gerekli.",
    hmoDraft: "Taslak",
    hmoDraftFilter: "Yalnızca taslak talepler",
    hmoDraftHint: "Henüz gönderilmedi",
    hmoMemberRequired: "Göndermeden önce üye ID zorunludur.",
    hmoPaid: "Ödendi",
    hmoPending: "İşlemde",
    hmoPendingHint: "Gönderildi veya inceleniyor",
    hmoQueueHint:
      "Taslak talepler burada hazırlanır, ardından sağlayıcı incelemesi ve ödeme için gönderilir.",
    hmoRejectHint: "Bu neden talepte kalır; faturalama düzeltip yeniden gönderebilir.",
    hmoRejectReason: "Red nedeni",
    hmoRejectReasonRequired: "Geri göndermeden önce red nedeni girin.",
    hmoSubmitted: "Talep gönderildi.",
    hmoSubtitle: "Sağlayıcı taleplerini tek kuyruktan hazırlayın, inceleyin ve kapatın.",
    hmoTotalClaimed: "toplam talep",
    markPaid: "Ödendi işaretle",
    memberId: "Üye ID",
    noHmoClaimsHint:
      "Aktif HMO kapsamı olan bir hasta için taslak talep oluşturun, ardından inceleme için gönderin.",
    noHmoClaimsTitle: "Henüz HMO talebi yok",
    noHmoDraftClaims: "Taslak HMO talebi yok",
    rejectClaim: "Reddet",
    resetToDraft: "Taslağa al",
    submitClaim: "Gönder",
    checkInOverride: "Faturalama geçersiz kılmayla check-in yap",
    caseRateCode: "Vaka tarifesi kodu",
    duplicateWarning: "Bu açıklamaya sahip bir kalem bu faturada zaten mevcut. Yine de eklemek istiyor musunuz?",
    belowBasePriceWarning: "Uyarı: Girilen birim fiyatı (₱{price}), bu işlem için belirlenen standart taban fiyatın (₱{basePrice}) altındadır. Bu indirimi onaylıyor musunuz?",
  },
  patients: {
    actionDentalChart: "Diş chartı",
    recordTablePlan: "Tedavi planı",
    sourceKiosk: "Kiosk tableti",
    sourcePortalShort: "hasta portalı",
  },
  consent: {
    notStarted: "Başlamadı",
  },
  patient: {
    balanceCleared: "Bakiye kapatıldı",
  },
  visits: {
    activeVisit: "Aktif ziyaret",
    checkInCta: "Hasta gelişini aç",
    closeVisit: "Çıkış / Taburcu",
    noActiveVisit: "Aktif ziyaret yok",
    openVisitsLog: "Ziyaret günlüğünü aç",
    viewAllVisits: "Ziyaret geçmişini görüntüle",
  },
  settings: {
    channelTestWhatsApp: "WhatsApp bağlantısını test et",
    metricPlan: "Abonelik planı",
    notificationsTest: "Test gönder",
    orgDefault: "Kurum varsayılanı",
  },
  pricingTiers: {
    starterF4: "Kiosk check-in bağlantısı",
  },
  landing: {
    deviceTabletKiosk: "Tablet kiosku",
    kioskCheckIn: "Kiosk girişi",
    stageKiosk: "Kiosk girişi",
    wfKioskTitle: "Kiosk girişi",
    workflowDescription:
      "Klinik ekibinizin günlük kullandığı modülleri gezin — vitrin seed yapılandırıldığında canlı veriyle.",
  },
  kiosk: {
    currentlyServing: "Şu An Hizmet Verilen",
    waitCount: "{count} bekleyen",
    estWaitTime: "Tahmini Bekleme Süresi: ~{time} dk",
    progressLabel: "Kayıt İlerleme Durumu",
    progressComplete: "%{n} Tamamlandı",
    consentText: "Sağlık geçmişi bilgilerimin doğru olduğunu onaylıyorum ve kişisel verilerimin klinik güvenlik yasalarına uygun olarak işlenmesine izin veriyorum.",
    drawSignature: "İmzanızı aşağıya çizin:",
  },
  common: {
    none: "Yok",
    clear: "Temizle",
  },
}
