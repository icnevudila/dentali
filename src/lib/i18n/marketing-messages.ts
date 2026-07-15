type MessageTree = { [key: string]: string | MessageTree }

/** Marketing / landing copy — merged into each locale catalog. */
export const marketingMessagesEn: MessageTree = {
  landing: {
    eyebrow: "Dental clinic operating system",
    heroTitle: "Run your clinic on",
    heroSubtitle:
      "Patients, appointments, charting, billing, queue, and HMO — branch-aware from the first login. Built for busy front desks and multi-chair clinics.",
    previewUses: "Preview below uses",
    previewSession: " — your signed-in clinic",
    previewDemo: " — demo showcase data",
    previewEmpty:
      "Run scripts/seed-demo-showcase.sql and set LANDING_SHOWCASE_BRANCH_ID to see live previews here.",
    featuresEyebrow: "Every screen",
    featuresTitle: "Desktop, tablet, mobile, and waiting-room TV",
    featuresDescription:
      "Same queue and patient data — optimized layouts for admin desks, kiosk tablets, and the display board.",
    workflowEyebrow: "Product tour",
    workflowTitle: "One system from front desk to chair side",
    workflowDescription:
      "Walk through the modules your clinic team uses every day — with live data when showcase seed is configured.",
    workflowStep: "Step",
    ctaBottomTitle: "Ready to run your clinic on one system?",
    ctaBottomSubtitle:
      "Start a free trial, request a quote for multi-branch groups, or sign in with your staff account.",
    viewPricing: "View pricing",
    alreadyUsing: "Already using dentQL?",
    kioskCheckIn: "Kiosk check-in",
    deviceWebAdmin: "Web admin",
    deviceTabletKiosk: "Tablet kiosk",
    deviceMobile: "Mobile",
    deviceQueueTv: "Queue TV",
    deviceDesktopAdmin: "Desktop · Admin dashboard",
    deviceTabletQueue: "Tablet · Queue board",
    deviceMobileLookup: "Mobile · Patient lookup",
    deviceTvWaiting: "TV · Waiting room",
    stageDashboard: "Command center",
    stagePatients: "Patient registry",
    stageChart: "Dental chart",
    stageAppointments: "Appointments",
    stageKiosk: "Kiosk check-in",
    stageDisplay: "Queue display",
    stageBilling: "Billing",
    wfDashboardTitle: "Clinic command center",
    wfDashboardSubtitle: "Web · Desktop & tablet",
    wfDashboardDesc:
      "Owners and front desk see today's appointments, queue depth, pending consents, and low-stock alerts — branch-aware from the first login.",
    wfPatientsTitle: "Patient registry & intake",
    wfPatientsSubtitle: "Web · Searchable records",
    wfPatientsDesc:
      "Register walk-ins and returning patients, capture demographics, insurance, and intake drafts without losing paper-form completeness.",
    wfChartTitle: "Dental chart & treatment plan",
    wfChartSubtitle: "Web · Chair-side clinical",
    wfChartDesc:
      "FDI odontogram, tooth findings, treatment plans, and clinical notes stay linked to the same patient profile your billing team uses.",
    wfAppointmentsTitle: "Appointments & waitlist",
    wfAppointmentsSubtitle: "Web · Scheduling desk",
    wfAppointmentsDesc:
      "Chair calendars, provider availability, SMS reminders, and waitlist callbacks — built for busy reception desks.",
    wfKioskTitle: "Kiosk check-in",
    wfKioskSubtitle: "Tablet · Patient-facing",
    wfKioskDesc:
      "Patients check in at the branch tablet, confirm contact details, and receive a queue number — no raw errors on screen.",
    wfDisplayTitle: "Queue display board",
    wfDisplaySubtitle: "TV · Waiting room",
    wfDisplayDesc:
      "Large-format queue codes for the waiting area. Now serving and up next — calm typography, no PHI beyond first names.",
    wfBillingTitle: "Billing, HMO & PhilHealth prep",
    wfBillingSubtitle: "Web · Finance desk",
    wfBillingDesc:
      "Invoices in PHP minor units, payment ledger, HMO claim tracking, and PhilHealth eClaims readiness with audit-friendly records.",
  },
  pricingPage: {
    eyebrow: "Pricing",
    title: "Plans that scale with your clinic",
    subtitle:
      "Every plan includes the full clinical workflow — patients, chart, queue, billing, and consent. Start with a free trial; Growth and Enterprise unlock multi-branch and automation.",
    footerNeedCustom: "Need a custom rollout or PhilHealth / PayMongo integration?",
    footerOr: "or",
    footerStartTrial: "start a free trial",
  },
  pricingTiers: {
    mostPopular: "Most popular",
    perMonth: "/ month",
    custom: "Custom",
    priceComingSoon: "Free trial · rates on request",
    starterPrice: "Free 14-day trial",
    growthPrice: "Free 14-day trial",
    enterprisePrice: "Custom quote",
    starterName: "Starter",
    starterDesc: "Single branch, up to 5 staff seats. Core clinical workflow.",
    starterF1: "Patient registry & dental chart",
    starterF2: "Appointments & queue board",
    starterF3: "Billing & receipts",
    starterF4: "Kiosk check-in link",
    starterF5: "Digital consent templates",
    growthName: "Growth",
    growthDesc: "Multi-branch clinics with HMO and inventory.",
    growthF1: "Everything in Starter",
    growthF2: "Multiple branches",
    growthF3: "HMO & insurer billing fields",
    growthF4: "Inventory & low-stock alerts",
    growthF5: "Reports & exports",
    enterpriseName: "Enterprise",
    enterpriseDesc: "Large groups, custom integrations, and dedicated onboarding.",
    enterpriseF1: "Unlimited branches & seats",
    enterpriseF2: "PayMongo & SMS automation",
    enterpriseF3: "Custom workflows & SLA",
    enterpriseF4: "Migration assistance",
    enterpriseF5: "Priority support",
  },
  pricingFaq: {
    title: "Frequently asked questions",
    q1: "Is dentQL built for multi-branch dental clinics?",
    a1: "Yes. Branch-aware workflows, HMO and insurer billing fields, kiosk check-in, queue display, and digital consent are designed for single-site and multi-branch groups.",
    q2: "Can I start without a sales call?",
    a2: "Starter and Growth plans include a free trial. Create an account, run onboarding, and invite staff. Enterprise groups can request a quote for migration and custom integrations.",
    q3: "What is included in every plan?",
    a3: "Patient registry, dental chart, appointments, queue board, billing, consent templates, kiosk links, and TV display — the full clinical workflow from front desk to chair side.",
    q4: "How does multi-branch pricing work?",
    a4: "Growth covers multiple branches under one organization. Enterprise pricing is custom based on branch count, integrations (PayMongo, SMS), and onboarding support.",
    moreDetails: "More details at",
  },
  quotePage: {
    eyebrow: "Sales",
    title: "Get a quote for your clinic",
    subtitle:
      "Tell us about your branches and workflow. We will reply with plan options, migration help, and go-live timing — usually within one business day.",
    bullet1: "Multi-branch & HMO-heavy clinics",
    bullet2: "Custom integrations (PayMongo, SMS, PhilHealth fields)",
    bullet3: "Staff training and data import from spreadsheets",
    readyNow: "Ready to try now?",
    noSalesCall: "— no sales call required for Starter.",
  },
  static: {
    aboutEyebrow: "About dentQL",
    aboutTitle: "Built for real clinic days",
    aboutIntro:
      "dentQL is a clinic operations platform designed around what actually happens in a busy dental branch: check-ins, queue updates, charting, treatment plans, billing, and day-end closeout.",
    aboutCard1Title: "Clinic-first design",
    aboutCard1Body: "Every feature starts from real front-desk and chairside workflows.",
    aboutCard2Title: "Branch-aware operations",
    aboutCard2Body: "Multi-branch setup with shared standards and local control.",
    aboutCard3Title: "Incremental reliability",
    aboutCard3Body: "We ship in small steps and validate changes in live clinic flows.",
    securityEyebrow: "Security",
    securityTitle: "Platform security overview",
    securityIntro:
      "dentQL is designed for day-to-day clinic operations with role-based access, auditable actions, and controlled branch-level workflows.",
    securityCard1Title: "Access control",
    securityCard1Body: "Permissions are enforced by role and branch to keep operational actions within authorized scope.",
    securityCard2Title: "Auditability",
    securityCard2Body: "Key workflow actions can be tracked for accountability and compliance review.",
    securityCard3Title: "Workflow safeguards",
    securityCard3Body: "Check-in, billing, and closeout flows include guardrails to reduce operational mistakes.",
    securityCard4Title: "Continuous hardening",
    securityCard4Body: "Security and reliability improvements are shipped continuously with branch-safe rollouts.",
    contactEyebrow: "Contact",
    contactTitle: "Let's talk about your clinic",
    contactIntro:
      "For demos, onboarding, and implementation questions, share your clinic setup and we'll recommend the fastest rollout path.",
    contactCard1Title: "Sales & onboarding",
    contactCard1Body: "Request a guided demo and deployment checklist for your branch.",
    contactQuoteLink: "Open quote form →",
    contactCard2Title: "Support",
    contactCard2Body: "Existing customer and need urgent assistance? Reach support from your account channel.",
    contactLoginLink: "Sign in →",
    privacyEyebrow: "Legal",
    privacyTitle: "Privacy policy",
    privacyIntro:
      "dentQL processes clinic and account data to run your branch workflows. This summary explains what we collect, why we use it, and how access is controlled. Your organization remains the data controller for patient records.",
    privacyCard1Title: "What we collect",
    privacyCard1Body:
      "Staff account details, clinic and branch configuration, operational usage logs, and patient/clinical records that your authorized staff enter to deliver care and billing.",
    privacyCard2Title: "How we use data",
    privacyCard2Body:
      "To provide product features (scheduling, charting, queue, billing), maintain reliability and security, send operational notifications you configure, and support audit or compliance reviews.",
    privacyCard3Title: "Data access and retention",
    privacyCard3Body:
      "Access is role- and branch-scoped. Retention follows your organization's policies. Deletion or export requests for clinic data should go through your organization administrator.",
    termsEyebrow: "Legal",
    termsTitle: "Terms of service",
    termsIntro:
      "By creating an account or using dentQL, you agree to use the platform for authorized clinical operations, keep credentials secure, and follow applicable healthcare and privacy rules in your jurisdiction.",
    termsCard1Title: "Service usage",
    termsCard1Body:
      "Access is limited to users invited by a clinic organization. You may not misuse the service, attempt to access other clinics' data, or interfere with system integrity.",
    termsCard2Title: "Security responsibilities",
    termsCard2Body:
      "Organizations must manage staff access, revoke leavers promptly, protect kiosk/TV devices, and avoid sharing passwords. dentQL enforces permissions and records critical actions in audit logs.",
    termsCard3Title: "Availability and support",
    termsCard3Body:
      "We maintain the service and ship updates continuously. Support channels and response SLAs depend on your subscription tier. Planned changes that affect workflows are communicated to organization admins.",
  },
}

export const marketingMessagesTr: MessageTree = {
  landing: {
    eyebrow: "Diş kliniği işletim sistemi",
    heroTitle: "Kliniğinizi tek sistemde yönetin:",
    heroSubtitle:
      "Hasta, randevu, chart, faturalama, sıra ve HMO — ilk girişten itibaren şube bazlı. Yoğun resepsiyon ve çok koltuklu klinikler için.",
    previewUses: "Aşağıdaki önizleme",
    previewSession: " — giriş yaptığınız klinik",
    previewDemo: " — demo vitrin verisi",
    previewEmpty:
      "Canlı önizleme için scripts/seed-demo-showcase.sql çalıştırın ve LANDING_SHOWCASE_BRANCH_ID ayarlayın.",
    featuresEyebrow: "Her ekran",
    featuresTitle: "Masaüstü, tablet, mobil ve bekleme odası TV",
    featuresDescription:
      "Aynı sıra ve hasta verisi — resepsiyon, kiosk tableti ve display board için optimize düzenler.",
    workflowEyebrow: "Ürün turu",
    workflowTitle: "Resepsiyondan koltuğa tek sistem",
    workflowDescription:
      "Klinik ekibinizin günlük kullandığı modülleri gezin — vitrin seed yapılandırıldığında canlı veriyle.",
    workflowStep: "Adım",
    ctaBottomTitle: "Kliniğinizi tek sistemde çalıştırmaya hazır mısınız?",
    ctaBottomSubtitle:
      "Ücretsiz deneyin, çok şubeli gruplar için teklif isteyin veya personel hesabınızla giriş yapın.",
    viewPricing: "Fiyatları gör",
    alreadyUsing: "Zaten dentali. kullanıyor musunuz?",
    kioskCheckIn: "Kiosk girişi",
    deviceWebAdmin: "Web yönetim",
    deviceTabletKiosk: "Tablet kiosku",
    deviceMobile: "Mobil",
    deviceQueueTv: "Sıra TV",
    deviceDesktopAdmin: "Masaüstü · Yönetim paneli",
    deviceTabletQueue: "Tablet · Sıra panosu",
    deviceMobileLookup: "Mobil · Hasta arama",
    deviceTvWaiting: "TV · Bekleme odası",
    stageDashboard: "Komuta merkezi",
    stagePatients: "Hasta kaydı",
    stageChart: "Diş chart",
    stageAppointments: "Randevular",
    stageKiosk: "Kiosk girişi",
    stageDisplay: "Sıra ekranı",
    stageBilling: "Faturalama",
    wfDashboardTitle: "Klinik komuta merkezi",
    wfDashboardSubtitle: "Web · Masaüstü ve tablet",
    wfDashboardDesc:
      "Sahipler ve resepsiyon bugünkü randevuları, sıra derinliğini, bekleyen onamları ve düşük stok uyarılarını görür — şube bazlı.",
    wfPatientsTitle: "Hasta kaydı ve intake",
    wfPatientsSubtitle: "Web · Aranabilir kayıtlar",
    wfPatientsDesc:
      "Yeni ve dönen hastaları kaydedin; demografi, sigorta ve intake taslaklarını kağıt form eksiksizliğiyle toplayın.",
    wfChartTitle: "Diş chart ve tedavi planı",
    wfChartSubtitle: "Web · Koltuk yanı klinik",
    wfChartDesc:
      "FDI odontogram, bulgular, tedavi planları ve klinik notlar faturalama ekibinin kullandığı profille bağlı kalır.",
    wfAppointmentsTitle: "Randevular ve bekleme listesi",
    wfAppointmentsSubtitle: "Web · Planlama masası",
    wfAppointmentsDesc:
      "Koltuk takvimleri, doktor müsaitliği, SMS hatırlatmaları ve bekleme listesi — yoğun resepsiyon masaları için.",
    wfKioskTitle: "Kiosk girişi",
    wfKioskSubtitle: "Tablet · Hasta ekranı",
    wfKioskDesc:
      "Hastalar tabletten check-in yapar, iletişim bilgilerini onaylar ve sıra numarası alır — ekranda ham hata yok.",
    wfDisplayTitle: "Sıra display board",
    wfDisplaySubtitle: "TV · Bekleme odası",
    wfDisplayDesc:
      "Bekleme alanı için büyük format sıra kodları. Şu an ve sıradaki — sakin tipografi, PHI sadece ad düzeyinde.",
    wfBillingTitle: "Faturalama, HMO ve PhilHealth",
    wfBillingSubtitle: "Web · Finans masası",
    wfBillingDesc:
      "PHP faturalar, ödeme defteri, HMO takibi ve PhilHealth eClaims hazırlığı — denetlenebilir kayıtlarla.",
  },
  pricingPage: {
    eyebrow: "Fiyatlandırma",
    title: "Kliniğinizle birlikte ölçeklenen planlar",
    subtitle:
      "Her plan tam klinik akışı içerir — hasta, chart, sıra, faturalama ve onam. Ücretsiz denemeyle başlayın; Growth ve Enterprise çok şube ve otomasyonu açar.",
    footerNeedCustom: "Özel kurulum veya PhilHealth / PayMongo entegrasyonu mu?",
    footerOr: "veya",
    footerStartTrial: "ücretsiz denemeye başlayın",
  },
  pricingTiers: {
    mostPopular: "En popüler",
    perMonth: "/ ay",
    custom: "Özel",
    priceComingSoon: "Ücretsiz deneme · fiyat talep üzerine",
    starterPrice: "14 gün ücretsiz deneme",
    growthPrice: "14 gün ücretsiz deneme",
    enterprisePrice: "Özel teklif",
    starterName: "Starter",
    starterDesc: "Tek şube, en fazla 5 personel. Temel klinik akış.",
    starterF1: "Hasta kaydı ve diş chart",
    starterF2: "Randevu ve sıra panosu",
    starterF3: "Faturalama ve makbuz",
    starterF4: "Kiosk check-in linki",
    starterF5: "Dijital onam şablonları",
    growthName: "Growth",
    growthDesc: "HMO ve envanterli çok şubeli klinikler.",
    growthF1: "Starter'daki her şey",
    growthF2: "Birden fazla şube",
    growthF3: "HMO ve sigorta faturalama alanları",
    growthF4: "Envanter ve düşük stok uyarıları",
    growthF5: "Raporlar ve dışa aktarma",
    enterpriseName: "Enterprise",
    enterpriseDesc: "Büyük gruplar, özel entegrasyonlar ve onboarding.",
    enterpriseF1: "Sınırsız şube ve koltuk",
    enterpriseF2: "PayMongo ve SMS otomasyonu",
    enterpriseF3: "Özel iş akışları ve SLA",
    enterpriseF4: "Veri taşıma desteği",
    enterpriseF5: "Öncelikli destek",
  },
  pricingFaq: {
    title: "Sık sorulan sorular",
    q1: "dentQL çok şubeli diş klinikleri için mi?",
    a1: "Evet. Şube bazlı akışlar, HMO ve sigorta faturalama alanları, kiosk, sıra ekranı ve dijital onam tek şube ve çok şubeli gruplar için tasarlandı.",
    q2: "Satış görüşmesi olmadan başlayabilir miyim?",
    a2: "Starter ve Growth ücretsiz deneme içerir. Hesap açın, onboarding yapın, personel davet edin. Enterprise gruplar teklif isteyebilir.",
    q3: "Her planda neler var?",
    a3: "Hasta kaydı, chart, randevu, sıra, faturalama, onam, kiosk ve TV display — resepsiyondan koltuğa tam akış.",
    q4: "Çok şubeli fiyatlandırma nasıl?",
    a4: "Growth tek organizasyonda birden fazla şubeyi kapsar. Enterprise şube sayısı ve entegrasyonlara göre özel fiyatlanır.",
    moreDetails: "Detaylar:",
  },
  quotePage: {
    eyebrow: "Satış",
    title: "Kliniğiniz için teklif alın",
    subtitle:
      "Şube ve iş akışınızı anlatın. Plan seçenekleri, taşıma desteği ve canlıya alma süresiyle genelde bir iş günü içinde döneriz.",
    bullet1: "Çok şubeli ve HMO ağırlıklı klinikler",
    bullet2: "Özel entegrasyonlar (PayMongo, SMS, PhilHealth)",
    bullet3: "Personel eğitimi ve spreadsheet'ten veri aktarımı",
    readyNow: "Hemen denemek ister misiniz?",
    noSalesCall: "— Starter için satış görüşmesi gerekmez.",
  },
  static: {
    aboutEyebrow: "dentQL hakkında",
    aboutTitle: "Gerçek klinik günleri için",
    aboutIntro:
      "dentQL, yoğun bir diş şubesinde gerçekten olanlara göre tasarlanmış bir klinik operasyon platformudur: giriş, sıra, chart, tedavi planı, faturalama ve gün sonu kapanışı.",
    aboutCard1Title: "Klinik odaklı tasarım",
    aboutCard1Body: "Her özellik gerçek resepsiyon ve koltuk yanış akışlarından başlar.",
    aboutCard2Title: "Şube bazlı operasyon",
    aboutCard2Body: "Ortak standartlar ve yerel kontrol ile çok şubeli kurulum.",
    aboutCard3Title: "Kademeli güvenilirlik",
    aboutCard3Body: "Küçük adımlarla gönderir ve değişiklikleri canlı klinik akışlarında doğrularız.",
    securityEyebrow: "Güvenlik",
    securityTitle: "Platform güvenlik özeti",
    securityIntro:
      "dentQL, rol bazlı erişim, denetlenebilir işlemler ve kontrollü şube akışları ile günlük klinik operasyonlar için tasarlanmıştır.",
    securityCard1Title: "Erişim kontrolü",
    securityCard1Body: "İzinler role ve şubeye göre uygulanır; operasyonel işlemler yetkili kapsamda kalır.",
    securityCard2Title: "Denetlenebilirlik",
    securityCard2Body: "Önemli iş akışı adımları hesap verebilirlik ve uyumluluk incelemesi için izlenebilir.",
    securityCard3Title: "İş akışı korumaları",
    securityCard3Body: "Giriş, faturalama ve kapanış akışları operasyonel hataları azaltmak için kısıtlar içerir.",
    securityCard4Title: "Sürekli sertleştirme",
    securityCard4Body: "Güvenlik ve güvenilirlik iyileştirmeleri şube güvenliğiyle sürekli yayınlanır.",
    contactEyebrow: "İletişim",
    contactTitle: "Kliniğiniz hakkında konuşalım",
    contactIntro:
      "Demo, onboarding ve kurulum soruları için klinik yapınızı paylaşın; en hızlı canlıya alma yolunu önerelim.",
    contactCard1Title: "Satış ve onboarding",
    contactCard1Body: "Şubeniz için rehberli demo ve kurulum kontrol listesi isteyin.",
    contactQuoteLink: "Teklif formunu aç →",
    contactCard2Title: "Destek",
    contactCard2Body: "Mevcut müşteri misiniz ve acil yardım mı gerekiyor? Hesap kanalınızdan desteğe ulaşın.",
    contactLoginLink: "Giriş yap →",
    privacyEyebrow: "Yasal",
    privacyTitle: "Gizlilik politikası",
    privacyIntro:
      "dentQL, şube iş akışlarınızı çalıştırmak için klinik ve hesap verilerini işler. Bu özet ne topladığımızı, neden kullandığımızı ve erişimin nasıl kontrol edildiğini açıklar. Hasta kayıtlarında veri sorumlusu kuruluşunuzdur.",
    privacyCard1Title: "Ne topluyoruz",
    privacyCard1Body:
      "Personel hesap bilgileri, klinik/şube yapılandırması, operasyonel kullanım logları ve yetkili personelin bakım ve faturalama için girdiği hasta/klinik kayıtları.",
    privacyCard2Title: "Veriyi nasıl kullanıyoruz",
    privacyCard2Body:
      "Ürün özelliklerini sunmak (randevu, chart, sıra, faturalama), güvenlik ve güvenilirliği sürdürmek, yapılandırdığınız operasyonel bildirimleri göndermek ve denetim/uyumluluk incelemelerini desteklemek için.",
    privacyCard3Title: "Veri erişimi ve saklama",
    privacyCard3Body:
      "Erişim role ve şubeye göre sınırlıdır. Saklama kuruluş politikanıza uyar. Klinik veri silme veya dışa aktarma talepleri kurum yöneticiniz üzerinden ilerlemelidir.",
    termsEyebrow: "Yasal",
    termsTitle: "Hizmet şartları",
    termsIntro:
      "Hesap oluşturarak veya dentQL kullanarak platformu yetkili klinik operasyonları için kullanmayı, kimlik bilgilerini korumayı ve geçerli sağlık/gizlilik kurallarına uymayı kabul edersiniz.",
    termsCard1Title: "Hizmet kullanımı",
    termsCard1Body:
      "Erişim, bir klinik organizasyonu tarafından davet edilen kullanıcılarla sınırlıdır. Hizmeti kötüye kullanamaz, başka kliniklerin verisine erişemez veya sistem bütünlüğünü bozamazsınız.",
    termsCard2Title: "Güvenlik sorumlulukları",
    termsCard2Body:
      "Kuruluşlar personel erişimini yönetmeli, ayrılanları hızla iptal etmeli, kiosk/TV cihazlarını korumalı ve şifre paylaşmamalıdır. dentQL izinleri uygular ve kritik işlemleri denetim kaydına alır.",
    termsCard3Title: "Erişilebilirlik ve destek",
    termsCard3Body:
      "Hizmeti sürdürür ve güncellemeleri sürekli yayınlarız. Destek kanalları ve SLA abonelik kademenize bağlıdır. İş akışını etkileyen planlı değişiklikler organizasyon yöneticilerine bildirilir.",
  },
}

export const marketingMessagesFil: MessageTree = {
  landing: {
    eyebrow: "Dental clinic operating system",
    heroTitle: "Patakbuhin ang clinic mo sa",
    heroSubtitle:
      "Patients, appointments, chart, billing, queue, at HMO — branch-aware mula unang login. Para sa abalang front desk at multi-chair clinics.",
    previewUses: "Ginagamit ng preview sa ibaba ang",
    previewSession: " — signed-in clinic mo",
    previewDemo: " — demo showcase data",
    previewEmpty:
      "Patakbuhin ang scripts/seed-demo-showcase.sql at i-set ang LANDING_SHOWCASE_BRANCH_ID para sa live preview.",
    featuresEyebrow: "Bawat screen",
    featuresTitle: "Desktop, tablet, mobile, at waiting-room TV",
    featuresDescription:
      "Parehong queue at patient data — optimized layouts para sa admin desk, kiosk tablet, at display board.",
    workflowEyebrow: "Product tour",
    workflowTitle: "Isang system mula front desk hanggang chair side",
    workflowDescription:
      "Libutin ang modules na ginagamit araw-araw ng clinic team mo — may live data kapag naka-config ang showcase seed.",
    workflowStep: "Step",
    ctaBottomTitle: "Handa nang patakbuhin ang clinic sa isang system?",
    ctaBottomSubtitle:
      "Simulan ang free trial, humiling ng quote para sa multi-branch groups, o mag-sign in gamit ang staff account.",
    viewPricing: "Tingnan ang pricing",
    alreadyUsing: "Gumagamit na ng dentali.?",
    kioskCheckIn: "Kiosk check-in",
    deviceWebAdmin: "Web admin",
    deviceTabletKiosk: "Tablet kiosk",
    deviceMobile: "Mobile",
    deviceQueueTv: "Queue TV",
    deviceDesktopAdmin: "Desktop · Admin dashboard",
    deviceTabletQueue: "Tablet · Queue board",
    deviceMobileLookup: "Mobile · Patient lookup",
    deviceTvWaiting: "TV · Waiting room",
    stageDashboard: "Command center",
    stagePatients: "Patient registry",
    stageChart: "Dental chart",
    stageAppointments: "Appointments",
    stageKiosk: "Kiosk check-in",
    stageDisplay: "Queue display",
    stageBilling: "Billing",
    wfDashboardTitle: "Clinic command center",
    wfDashboardSubtitle: "Web · Desktop at tablet",
    wfDashboardDesc:
      "Nakikita ng owners at front desk ang appointments ngayon, queue depth, pending consents, at low-stock alerts — branch-aware.",
    wfPatientsTitle: "Patient registry at intake",
    wfPatientsSubtitle: "Web · Searchable records",
    wfPatientsDesc:
      "Mag-register ng walk-ins at returning patients, demographics, insurance, at intake drafts nang kumpleto tulad ng paper form.",
    wfChartTitle: "Dental chart at treatment plan",
    wfChartSubtitle: "Web · Chair-side clinical",
    wfChartDesc:
      "FDI odontogram, findings, treatment plans, at clinical notes naka-link sa patient profile na ginagamit ng billing.",
    wfAppointmentsTitle: "Appointments at waitlist",
    wfAppointmentsSubtitle: "Web · Scheduling desk",
    wfAppointmentsDesc:
      "Chair calendars, provider availability, SMS reminders, at waitlist callbacks — para sa busy reception desks.",
    wfKioskTitle: "Kiosk check-in",
    wfKioskSubtitle: "Tablet · Patient-facing",
    wfKioskDesc:
      "Nagche-check in ang patients sa branch tablet, kinukumpirma ang contact details, at nakakakuha ng queue number.",
    wfDisplayTitle: "Queue display board",
    wfDisplaySubtitle: "TV · Waiting room",
    wfDisplayDesc:
      "Malaking queue codes para sa waiting area. Now serving at up next — walang PHI bukod sa first names.",
    wfBillingTitle: "Billing, HMO at PhilHealth prep",
    wfBillingSubtitle: "Web · Finance desk",
    wfBillingDesc:
      "Invoices sa PHP, payment ledger, HMO tracking, at PhilHealth eClaims readiness na may audit-friendly records.",
  },
  pricingPage: {
    eyebrow: "Presyo",
    title: "Mga planong lumalaki kasama ng clinic mo",
    subtitle:
      "Bawat plan may buong clinical workflow — patients, chart, queue, billing, at consent. Magsimula sa free trial; ang Growth at Enterprise ay nagbubukas ng multi-branch at automation.",
    footerNeedCustom: "Kailangan ng custom rollout o PhilHealth / PayMongo integration?",
    footerOr: "o",
    footerStartTrial: "simulan ang free trial",
  },
  pricingTiers: {
    mostPopular: "Pinakasikat",
    perMonth: "/ buwan",
    custom: "Custom",
    priceComingSoon: "Free trial · rates on request",
    starterPrice: "Libre nang 14 araw",
    growthPrice: "Libre nang 14 araw",
    enterprisePrice: "Custom quote",
    starterName: "Starter",
    starterDesc: "Isang branch, hanggang 5 staff seats. Core clinical workflow.",
    starterF1: "Patient registry at dental chart",
    starterF2: "Appointments at queue board",
    starterF3: "Billing at receipts",
    starterF4: "Kiosk check-in link",
    starterF5: "Digital consent templates",
    growthName: "Growth",
    growthDesc: "Multi-branch clinics na may HMO at inventory.",
    growthF1: "Lahat sa Starter",
    growthF2: "Maraming branch",
    growthF3: "HMO at insurer billing fields",
    growthF4: "Inventory at low-stock alerts",
    growthF5: "Reports at exports",
    enterpriseName: "Enterprise",
    enterpriseDesc: "Malalaking grupo, custom integrations, at dedicated onboarding.",
    enterpriseF1: "Unlimited branches at seats",
    enterpriseF2: "PayMongo at SMS automation",
    enterpriseF3: "Custom workflows at SLA",
    enterpriseF4: "Migration assistance",
    enterpriseF5: "Priority support",
  },
  pricingFaq: {
    title: "Mga madalas itanong",
    q1: "Para ba sa multi-branch dental clinics ang dentQL?",
    a1: "Oo. Branch-aware workflows, HMO at insurer billing fields, kiosk, queue display, at digital consent — para sa single-site at multi-branch groups.",
    q2: "Puwede bang magsimula nang walang sales call?",
    a2: "May free trial ang Starter at Growth. Gumawa ng account, mag-onboard, mag-invite ng staff. Puwedeng humiling ng quote ang Enterprise groups.",
    q3: "Ano ang kasama sa bawat plan?",
    a3: "Patient registry, chart, appointments, queue, billing, consent, kiosk links, at TV display — buong workflow mula front desk hanggang chair side.",
    q4: "Paano ang multi-branch pricing?",
    a4: "Saklaw ng Growth ang maraming branch sa isang organization. Custom ang Enterprise base sa branch count at integrations.",
    moreDetails: "Higit pang detalye sa",
  },
  quotePage: {
    eyebrow: "Sales",
    title: "Humiling ng quote para sa clinic mo",
    subtitle:
      "Sabihin ang branches at workflow mo. Magrereply kami ng plan options, migration help, at go-live timing — karaniwang within one business day.",
    bullet1: "Multi-branch at HMO-heavy clinics",
    bullet2: "Custom integrations (PayMongo, SMS, PhilHealth fields)",
    bullet3: "Staff training at data import mula spreadsheets",
    readyNow: "Handa nang subukan?",
    noSalesCall: "— walang sales call para sa Starter.",
  },
}

/** Deep-merge locale overrides onto the English (PH) catalog. */
export function mergeMessageTrees(base: MessageTree, override: MessageTree): MessageTree {
  const out: MessageTree = { ...base }
  for (const key of Object.keys(override)) {
    const baseVal = base[key]
    const overrideVal = override[key]
    if (
      typeof baseVal === "object" &&
      baseVal !== null &&
      typeof overrideVal === "object" &&
      overrideVal !== null
    ) {
      out[key] = mergeMessageTrees(baseVal as MessageTree, overrideVal as MessageTree)
    } else {
      out[key] = overrideVal
    }
  }
  return out
}

export function withMarketingMessages(base: MessageTree, marketing: MessageTree): MessageTree {
  return mergeMessageTrees(mergeMessageTrees(base, marketingMessagesEn), marketing)
}
