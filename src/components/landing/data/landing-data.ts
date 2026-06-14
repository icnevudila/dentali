/* ── Landing page data: features, testimonials, FAQ, timeline, i18n ── */

import type { LucideIcon } from "lucide-react"
import { landingAsset as asset } from "./landing-assets"
import {
  LayoutDashboard, Users, ClipboardList, CalendarDays,
  CreditCard, Package, BarChart3, Shield, Smartphone,
  Building2, Tv, Zap, Globe, FileText, Heart
} from "lucide-react"

/* ═══════════════════════════════════════════════
   i18n helper type
   ═══════════════════════════════════════════════ */

export interface LandingText {
  en: string
  tr: string
}

function t(en: string, tr: string): LandingText {
  return { en, tr }
}

/* ═══════════════════════════════════════════════
   Social Proof Metrics
   ═══════════════════════════════════════════════ */

export interface SocialHighlight {
  label: LandingText
  detail: LandingText
}

export const SOCIAL_HIGHLIGHTS: SocialHighlight[] = [
  {
    label: t("All-in-one", "Hepsi bir arada"),
    detail: t("Patients to billing", "Hastadan faturalamaya"),
  },
  {
    label: t("No install", "Kurulum yok"),
    detail: t("Runs in your browser", "Tarayıcınızda çalışır"),
  },
  {
    label: t("Branch-ready", "Şubeye hazır"),
    detail: t("Multi-site from day one", "İlk günden çok lokasyon"),
  },
  {
    label: t("Free trial", "Ücretsiz deneme"),
    detail: t("No credit card needed", "Kredi kartı gerekmez"),
  },
]

/* ═══════════════════════════════════════════════
   Problem Cards
   ═══════════════════════════════════════════════ */

export interface ProblemCard {
  icon: string
  text: LandingText
}

export const PROBLEM_CARDS: ProblemCard[] = [
  { icon: "📋", text: t("Paper charts getting lost between rooms", "Kağıt dosyalar odalar arasında kayboluyor") },
  { icon: "🗓️", text: t("Double-booked appointments, angry patients", "Çift randevular, kızgın hastalar") },
  { icon: "💸", text: t("HMO claims stuck in email limbo", "HMO talepleri e-postada takılı kalıyor") },
  { icon: "📱", text: t("Five different apps that don't talk to each other", "Birbiriyle konuşmayan beş farklı uygulama") },
]

export type ProblemDeviceFrame = "desktop" | "tablet" | "mobile" | "tv"

export interface ProblemSolution {
  title: LandingText
  description: LandingText
  image: string
  frame: ProblemDeviceFrame
  frameLabel: LandingText
}

export const PROBLEM_SOLUTIONS: ProblemSolution[] = [
  {
    title: t("Digital patient records", "Dijital hasta kayıtları"),
    description: t(
      "One searchable profile per patient — demographics, history, chart, and consents always in sync across every room.",
      "Hasta başına tek aranabilir profil — demografik bilgi, geçmiş, şema ve onamlar her odada güncel."
    ),
    image: asset("/landing/feature-patients.png"),
    frame: "desktop",
    frameLabel: t("Patient registry", "Hasta kayıtları"),
  },
  {
    title: t("Conflict-free scheduling", "Çakışmasız randevu planı"),
    description: t(
      "Chair and provider calendars with live availability — see who's booked before you confirm.",
      "Koltuk ve doktor takvimleri canlı müsaitlikle — onaylamadan önce kimin dolu olduğunu görün."
    ),
    image: asset("/landing/hero-appointments.png"),
    frame: "desktop",
    frameLabel: t("Appointments", "Randevular"),
  },
  {
    title: t("Billing & claims ledger", "Faturalama ve talep defteri"),
    description: t(
      "Invoices in PHP, payment status, and HMO claim tracking — no more digging through email threads.",
      "PHP faturalar, ödeme durumu ve HMO talep takibi — artık e-posta zincirlerinde kaybolmazsınız."
    ),
    image: asset("/landing/feature-billing.png"),
    frame: "desktop",
    frameLabel: t("Billing", "Faturalama"),
  },
  {
    title: t("One clinic operating system", "Tek klinik işletim sistemi"),
    description: t(
      "Dashboard, queue, inventory, and reports under one login — desktop, tablet, mobile, and waiting-room TV.",
      "Kontrol paneli, sıra, envanter ve raporlar tek girişte — masaüstü, tablet, mobil ve bekleme odası TV."
    ),
    image: asset("/landing/hero-dashboard.png"),
    frame: "desktop",
    frameLabel: t("Dashboard", "Kontrol paneli"),
  },
]

export interface ClinicExperienceItem {
  id: string
  tag: LandingText
  title: LandingText
  description: LandingText
  bullets: LandingText[]
  media: "video" | "image"
  videoKey?: "kiosk" | "portal"
  image?: string
  frame: ProblemDeviceFrame
}

export const CLINIC_EXPERIENCE_ITEMS: ClinicExperienceItem[] = [
  {
    id: "kiosk",
    tag: t("Branded for your clinic", "Kliniğinize özel"),
    title: t("Kiosk check-in on your tablet", "Tabletinizde markalı kiosk check-in"),
    description: t(
      "Your clinic name, branch, and queue flow on screen — patients tap in without crowding reception.",
      "Ekranda kliniğinizin adı, şubesi ve sıra akışı — hastalar resepsiyona yığılmadan kayıt olur."
    ),
    bullets: [
      t("Walk-in or appointed check-in", "Randevulu veya randevusuz kayıt"),
      t("Queue number issued instantly", "Anında sıra numarası"),
      t("Works on any tablet in the browser", "Tarayıcıda her tablette çalışır"),
    ],
    media: "video",
    videoKey: "kiosk",
    frame: "tablet",
  },
  {
    id: "portal",
    tag: t("Patient-facing", "Hasta tarafı"),
    title: t("Patient portal on mobile", "Mobilde hasta portalı"),
    description: t(
      "Patients view appointments, profile details, and clinic info from their phone — white-labeled to your practice.",
      "Hastalar randevularını, profil bilgilerini ve klinik detaylarını telefondan görür — kliniğinize özel arayüz."
    ),
    bullets: [
      t("Appointment history & upcoming visits", "Randevu geçmişi ve yaklaşan ziyaretler"),
      t("Secure access per patient", "Hasta başına güvenli erişim"),
      t("No app store install required", "Uygulama mağazası gerekmez"),
    ],
    media: "video",
    videoKey: "portal",
    frame: "mobile",
  },
  {
    id: "queue-tv",
    tag: t("Waiting room", "Bekleme odası"),
    title: t("Live queue on the TV", "TV'de canlı sıra"),
    description: t(
      "A calm, full-screen board for your waiting room — who's being served now and who's next, without exposing full PHI.",
      "Bekleme odanız için sakin, tam ekran pano — kim içeride, sırada kim var; gereksiz kişisel bilgi yok."
    ),
    bullets: [
      t("Opens in any TV browser", "Her TV tarayıcısında açılır"),
      t("Updates in real time from queue", "Sıradan gerçek zamanlı güncellenir"),
      t("Per-branch display URL", "Şube başına ayrı ekran adresi"),
    ],
    media: "image",
    image: asset("/landing/timeline-tv-queue.png"),
    frame: "tv",
  },
]

/* ═══════════════════════════════════════════════
   USP / Why Different
   ═══════════════════════════════════════════════ */

export interface UspCard {
  icon: LucideIcon
  title: LandingText
  description: LandingText
}

export const USP_CARDS: UspCard[] = [
  {
    icon: Building2,
    title: t("Branch-aware from day one", "İlk günden çok şubeli"),
    description: t(
      "Every branch sees its own data. Owners see everything. No per-branch license tricks.",
      "Her şube kendi verisini görür. Sahipler her şeyi görür. Şube başına lisans oyunu yok."
    ),
  },
  {
    icon: Smartphone,
    title: t("Every screen, one system", "Her ekran, tek sistem"),
    description: t(
      "Desktop admin, tablet kiosk, mobile lookup, waiting-room TV — same data, optimized layouts.",
      "Masaüstü yönetim, tablet kiosk, mobil arama, bekleme odası TV — aynı veri, optimize görünüm."
    ),
  },
  {
    icon: FileText,
    title: t("Paperless Consent Forms", "Kağıtsız Onam Formları"),
    description: t(
      "Design custom intake and treatment consents. Patients sign digitally on tablets or phones — instantly saved to history.",
      "Özel kabul ve tedavi onam formları tasarlayın. Hastalar tablet veya telefondan dijital imza atsın — anında geçmişe kaydedilsin."
    ),
  },
  {
    icon: BarChart3,
    title: t("Multi-Branch Analytics", "Çoklu Şube Analitiği"),
    description: t(
      "Consolidated revenues, active patient count, and appointment performance across all clinics in real time.",
      "Tüm kliniklerinizdeki konsolide gelirleri, aktif hasta sayısını ve randevu performansını gerçek zamanlı takip edin."
    ),
  },
  {
    icon: Globe,
    title: t("Cloud Native & Fast", "Bulut Tabanlı ve Hızlı"),
    description: t(
      "Access your data securely from anywhere. Fast page loads and a workflow built for busy clinic days.",
      "Verilerinize her yerden güvenle erişin. Hızlı sayfa yüklemeleri ve yoğun klinik günleri için tasarlanmış iş akışı."
    ),
  },
  {
    icon: Zap,
    title: t("Zero training needed", "Eğitim gerektirmez"),
    description: t(
      "Intuitive interface your staff can use from day one. No week-long onboarding.",
      "Personelinizin ilk günden kullanacağı sezgisel arayüz. Haftalık eğitime gerek yok."
    ),
  },
]

/* ═══════════════════════════════════════════════
   Features Showcase
   ═══════════════════════════════════════════════ */

export interface FeatureItem {
  id: string
  icon: LucideIcon
  title: LandingText
  description: LandingText
  screenshot: string // path under /landing/
}

export const FEATURES: FeatureItem[] = [
  {
    id: "dashboard",
    icon: LayoutDashboard,
    title: t("Dashboard", "Kontrol Paneli"),
    description: t("Real-time clinic pulse — appointments, queue, alerts, and revenue at a glance.", "Gerçek zamanlı klinik nabzı — randevular, sıra, uyarılar ve gelir bir bakışta."),
    screenshot: asset("/landing/feature-dashboard.png"),
  },
  {
    id: "patients",
    icon: Users,
    title: t("Patient Records", "Hasta Kayıtları"),
    description: t("Searchable registry with demographics, insurance, and intake history.", "Demografik bilgiler, sigorta ve kabul geçmişi ile aranabilir kayıt."),
    screenshot: asset("/landing/feature-patients.png"),
  },
  {
    id: "chart",
    icon: ClipboardList,
    title: t("Dental Chart", "Diş Şeması"),
    description: t("Interactive FDI odontogram with findings, notes, and treatment history.", "Bulgular, notlar ve tedavi geçmişi ile interaktif FDI odontogram."),
    screenshot: asset("/landing/feature-dental-chart.png"),
  },
  {
    id: "treatment",
    icon: FileText,
    title: t("Treatment Plans", "Tedavi Planları"),
    description: t("Plan, track, and present treatment options to patients with cost estimates.", "Tedavi seçeneklerini maliyet tahminleriyle planlayın, takip edin ve hastaya sunun."),
    screenshot: asset("/landing/feature-treatment.png"),
  },
  {
    id: "appointments",
    icon: CalendarDays,
    title: t("Appointments", "Randevular"),
    description: t("Chair calendars, provider scheduling, SMS reminders, and waitlist callbacks.", "Koltuk takvimleri, doktor programı, SMS hatırlatmaları ve bekleme listesi."),
    screenshot: asset("/landing/feature-appointments.png"),
  },
  {
    id: "queue",
    icon: Tv,
    title: t("Queue & Waitlist", "Sıra & Bekleme"),
    description: t("Real-time queue management with kiosk check-in and waiting-room TV display.", "Kiosk check-in ve bekleme odası TV ekranı ile gerçek zamanlı sıra yönetimi."),
    screenshot: asset("/landing/feature-queue.png"),
  },
  {
    id: "billing",
    icon: CreditCard,
    title: t("Billing & Claims", "Faturalama"),
    description: t("Invoices, payment ledger, and HMO claim tracking in one place.", "Faturalar, ödeme defteri ve HMO talep takibi tek yerde."),
    screenshot: asset("/landing/feature-billing.png"),
  },
  {
    id: "inventory",
    icon: Package,
    title: t("Inventory", "Envanter"),
    description: t("Stock tracking with low-stock alerts and automatic reorder suggestions.", "Düşük stok uyarıları ve otomatik yeniden sipariş önerileri ile stok takibi."),
    screenshot: asset("/landing/feature-inventory.png"),
  },
  {
    id: "reports",
    icon: BarChart3,
    title: t("Reports & Analytics", "Raporlar"),
    description: t("Revenue analytics, day-end closeout, compliance reports, and audit trail.", "Gelir analitiği, gün sonu kapanış, uyumluluk raporları ve denetim izi."),
    screenshot: asset("/landing/feature-reports.png"),
  },
  {
    id: "staff",
    icon: Shield,
    title: t("Staff & Roles", "Personel & Roller"),
    description: t("Team management with role-based access control and activity audit log.", "Rol tabanlı erişim kontrolü ve etkinlik denetim günlüğü ile ekip yönetimi."),
    screenshot: asset("/landing/feature-staff.png"),
  },
]

/* ═══════════════════════════════════════════════
   Day in Clinic Timeline
   ═══════════════════════════════════════════════ */

export interface TimelineStep {
  time: string
  title: LandingText
  description: LandingText
  screenshot: string | null
  device: "desktop" | "tablet" | "mobile" | "tv"
}

export const TIMELINE_STEPS: TimelineStep[] = [
  {
    time: "7:30",
    title: t("Open your dashboard", "Kontrol panelini açın"),
    description: t("See today's schedule, alerts, pending consents, and low-stock items.", "Günün programını, uyarıları, onay bekleyen formları ve azalan stokları görün."),
    screenshot: asset("/landing/timeline-dashboard.png"),
    device: "desktop",
  },
  {
    time: "8:00",
    title: t("Patient checks in at kiosk", "Hasta kiosk'tan kayıt yaptırır"),
    description: t("Walk-in or appointed — the patient taps their name on the tablet and gets a queue number.", "Randevulu veya randevusuz — hasta tablette ismini seçer ve sıra numarası alır."),
    screenshot: asset("/landing/timeline-kiosk.png"),
    device: "tablet",
  },
  {
    time: "8:30",
    title: t("Review patient profile", "Hasta profilini inceleyin"),
    description: t("Pull up demographics, medical history, past treatments, and insurance details.", "Demografik bilgileri, tıbbi geçmişi, geçmiş tedavileri ve sigorta detaylarını görün."),
    screenshot: asset("/landing/timeline-patient.png"),
    device: "desktop",
  },
  {
    time: "9:00",
    title: t("Chart findings on the odontogram", "Diş şemasına bulguları işleyin"),
    description: t("Tap teeth, record findings, attach clinical notes — all linked to the patient file.", "Dişlere tıklayın, bulguları kaydedin, klinik notlar ekleyin — hepsi hasta dosyasına bağlı."),
    screenshot: asset("/landing/timeline-chart.png"),
    device: "desktop",
  },
  {
    time: "10:00",
    title: t("Waiting room shows live queue", "Bekleme odası canlı sırayı gösterir"),
    description: t("The TV display board shows who's next — calm typography, no PHI beyond first names.", "TV ekranı sıradakini gösterir — sakin tipografi, ad dışında kişisel bilgi yok."),
    screenshot: asset("/landing/timeline-tv-queue.png"),
    device: "tv",
  },
  {
    time: "12:00",
    title: t("Generate invoice & submit claim", "Fatura oluşturun & talep gönderin"),
    description: t("Invoices in PHP, payment ledger updated, HMO claim filed — one screen.", "PHP cinsinden faturalar, ödeme defteri güncellenir, HMO talebi dosyalanır — tek ekran."),
    screenshot: asset("/landing/timeline-billing.png"),
    device: "desktop",
  },
  {
    time: "15:00",
    title: t("Check inventory levels", "Envanter seviyelerini kontrol edin"),
    description: t("Low-stock alerts for supplies, reorder suggestions ready for approval.", "Malzeme düşük stok uyarıları, onay için hazır yeniden sipariş önerileri."),
    screenshot: asset("/landing/timeline-inventory.png"),
    device: "desktop",
  },
  {
    time: "17:00",
    title: t("Run day-end closeout", "Gün sonu kapanışını çalıştırın"),
    description: t("Revenue summary, patient count, outstanding balances — one click to close the day.", "Gelir özeti, hasta sayısı, ödenmemiş bakiyeler — tek tıkla günü kapatın."),
    screenshot: asset("/landing/timeline-reports.png"),
    device: "desktop",
  },
]

/* ═══════════════════════════════════════════════
   Testimonials — keep lean; add real quotes as they arrive
   ═══════════════════════════════════════════════ */

export interface Testimonial {
  name: string
  role: string
  clinic: string
  initials: string
  color: string
  rating: number
  quote: LandingText
}

export const TESTIMONIALS: Testimonial[] = [
  {
    name: "Ana Reyes",
    role: "Clinic Manager",
    clinic: "Dental Care Plus QC",
    initials: "AR",
    color: "#f59e0b",
    rating: 5,
    quote: t(
      "HMO claims used to take me hours. Now I submit them in minutes and track every status in real time.",
      "HMO talepleri saatlerimi alıyordu. Şimdi dakikalar içinde gönderiyorum ve her durumu gerçek zamanlı takip ediyorum."
    ),
  },
  {
    name: "Mark Villanueva",
    role: "Front Desk Lead",
    clinic: "SmileHub Dental Manila",
    initials: "MV",
    color: "#06b6d4",
    rating: 5,
    quote: t(
      "The queue display on our waiting room TV is a game changer. Patients are calmer and we get fewer 'how long?' questions.",
      "Bekleme odası TV'sindeki sıra ekranı oyun değiştirici. Hastalar daha sakin ve 'ne kadar sürecek?' soruları azaldı."
    ),
  },
]

/* ═══════════════════════════════════════════════
   FAQ
   ═══════════════════════════════════════════════ */

export interface FaqItem {
  question: LandingText
  answer: LandingText
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: t("How long does setup take?", "Kurulum ne kadar sürer?"),
    answer: t(
      "Most clinics are up and running within an hour. Create your organization, add branches and staff, configure your procedure catalog — and you're ready to see patients.",
      "Çoğu klinik bir saat içinde çalışmaya başlar. Organizasyonunuzu oluşturun, şubeleri ve personeli ekleyin, işlem kataloğunu yapılandırın — ve hasta kabule hazırsınız."
    ),
  },
  {
    question: t("Can I migrate from my current system?", "Mevcut sistemimden geçiş yapabilir miyim?"),
    answer: t(
      "Yes. We offer assisted migration for patient records, appointment history, and billing data. Our team will help you transition smoothly with zero downtime.",
      "Evet. Hasta kayıtları, randevu geçmişi ve faturalama verileri için yardımlı geçiş sunuyoruz. Ekibimiz sıfır kesinti ile sorunsuz geçiş yapmanıza yardımcı olur."
    ),
  },
  {
    question: t("Is my patient data secure?", "Hasta verilerim güvende mi?"),
    answer: t(
      "Absolutely. All data is encrypted at rest and in transit, with role-based access control and a full audit trail for every sensitive action.",
      "Kesinlikle. Tüm veriler hem depolamada hem de aktarımda şifrelenir; rol tabanlı erişim kontrolü ve her hassas işlem için tam denetim izi vardır."
    ),
  },
  {
    question: t("Do you support multiple branches?", "Birden fazla şubeyi destekliyor musunuz?"),
    answer: t(
      "Yes — branch awareness is built into the core. Each branch has isolated data, separate queues, and independent settings. Owners and admins see the full picture across all branches.",
      "Evet — şube bilinci sistemin temelinde. Her şubenin izole verileri, ayrı sıraları ve bağımsız ayarları vardır. Sahipler ve yöneticiler tüm şubelerin tam resmini görür."
    ),
  },
  {
    question: t("What devices are supported?", "Hangi cihazlar destekleniyor?"),
    answer: t(
      "Any device with a modern browser. Desktop for admin, tablet for kiosk check-in, phone for mobile access, and any screen for the queue TV display. No app to install.",
      "Modern tarayıcıya sahip herhangi bir cihaz. Yönetim için masaüstü, kiosk check-in için tablet, mobil erişim için telefon ve sıra TV ekranı için herhangi bir ekran. Uygulama yüklemeye gerek yok."
    ),
  },
  {
    question: t("Is there a free trial?", "Ücretsiz deneme var mı?"),
    answer: t(
      "Yes! Start with a free trial — no credit card required. Explore every feature with sample data, then go live when you're ready.",
      "Evet! Ücretsiz deneme ile başlayın — kredi kartı gerekmez. Örnek verilerle tüm özellikleri keşfedin, hazır olduğunuzda canlıya geçin."
    ),
  },
  {
    question: t("Do I need to install anything?", "Bir şey yüklemem gerekiyor mu?"),
    answer: t(
      "No. dentali. runs entirely in the browser — Chrome, Safari, Edge, Firefox. You can also install it as a PWA on tablets and phones for an app-like experience.",
      "Hayır. dentali. tamamen tarayıcıda çalışır — Chrome, Safari, Edge, Firefox. Ayrıca tablet ve telefonlara uygulama deneyimi için PWA olarak yükleyebilirsiniz."
    ),
  },
]

/* ═══════════════════════════════════════════════
   Section Headings (i18n)
   ═══════════════════════════════════════════════ */

export const LANDING_HEADINGS = {
  hero: {
    title1: t("Software that makes", "Kliniğinizi"),
    title2: t("your clinic smile.", "gülümseten yazılım."),
    subtitle: t(
      "One calm system for patients, appointments, charting, billing, queue, and kiosk — so your team can focus on care, not chaos.",
      "Hastalar, randevular, diş şeması, faturalama, sıra ve kiosk için tek sakin sistem — ekibiniz kaosa değil, bakıma odaklansın."
    ),
    ctaPrimary: t("Start free trial →", "Ücretsiz denemeyi başlat →"),
    ctaSecondary: t("Get a quote", "Teklif alın"),
    trustLine: t("Free trial · No credit card · Set up in under an hour", "Ücretsiz deneme · Kredi kartı yok · Bir saatten kısa kurulum"),
  },
  problem: {
    eyebrow: t("Operations Chaos", "Operasyonel Kaos"),
    title: t("Sound familiar?", "Tanıdık geldi mi?"),
    subtitle: t("Running a clinic is hard. Running it with five disconnected tools is harder.", "Klinik yönetmek zordur. Beş farklı kopuk araçla yönetmek daha da zordur."),
    transition: t("There's a better way.", "Daha iyi bir yol var."),
    solutionLabel: t("With dentali.", "dentali. ile"),
  },
  clinicExperience: {
    eyebrow: t("Your clinic, your brand", "Kliniğiniz, markanız"),
    title: t("Built around how your clinic runs", "Kliniğinizin işleyişine göre tasarlandı"),
    subtitle: t(
      "Kiosk, patient portal, and waiting-room TV — configured per branch, shown with your clinic identity.",
      "Kiosk, hasta portalı ve bekleme odası TV — şube bazlı, kliniğinizin kimliğiyle."
    ),
  },
  whyDifferent: {
    eyebrow: t("Why dentali.", "Neden dentali."),
    title: t("Built different. Built for you.", "Farklı düşünüldü. Sizin için tasarlandı."),
    subtitle: t("We design systems around the daily workflows of doctors and clinic staff.", "Sistemlerimizi doktorların ve klinik personelinin günlük iş akışlarına göre tasarlıyoruz."),
  },
  features: {
    eyebrow: t("Features", "Özellikler"),
    title: t("Everything your clinic needs", "Kliniğinizin ihtiyacı olan her şey"),
    subtitle: t(
      "From front desk to chair side — explore the modules your team uses every day.",
      "Resepsiyondan koltuk kenarına — ekibinizin her gün kullandığı modülleri keşfedin."
    ),
  },
  dayInClinic: {
    eyebrow: t("Product tour", "Ürün turu"),
    title: t("A day in your clinic", "Kliniğinizde bir gün"),
    subtitle: t(
      "See how dentali. fits into your daily workflow — from morning to closeout.",
      "dentali.'nin günlük iş akışınıza nasıl uyduğunu görün — sabahtan kapanışa."
    ),
  },
  multiDevice: {
    eyebrow: t("Seamless Access", "Kusursuz Erişim"),
    title: t("One system. Every screen.", "Tek sistem. Her ekran."),
    subtitle: t(
      "Admin desk, reception tablet, doctor's phone, waiting room TV — same data, optimized for each.",
      "Yönetici masaüstü, resepsiyon tableti, doktor telefonu, bekleme odası TV — aynı veri, her biri için optimize."
    ),
    desktopLabel: t("Admin Desk", "Yönetici Masası"),
    tabletLabel: t("Reception Kiosk", "Resepsiyon Kiosku"),
    mobileLabel: t("Doctor's Companion", "Doktor Mobil"),
  },
  testimonials: {
    eyebrow: t("Wall of Love", "Sevgi Duvarı"),
    title: t("Loved by clinics worldwide", "Dünya genelindeki klinikler tarafından seviliyor"),
    subtitle: t("Hear directly from dental clinic owners, doctors, and staff.", "Doğrudan klinik sahiplerinden, diş hekimlerinden ve personelden dinleyin."),
  },
  faq: {
    eyebrow: t("Support", "Destek"),
    title: t("Questions? We've got answers.", "Sorularınız mı var? Cevaplarımız hazır."),
    subtitle: t("Everything you need to know about setting up and using dentali.", "dentali. kurulumu ve kullanımı hakkında bilmeniz gereken her şey."),
  },
  finalCta: {
    title: t("Ready for a calmer clinic day?", "Daha sakin bir klinik gününe hazır mısınız?"),
    subtitle: t(
      "Start your free trial and see how dentali. fits your front desk, chairs, and waiting room.",
      "Ücretsiz denemenizi başlatın; dentali.'nin resepsiyon, koltuk ve bekleme odanıza nasıl uyduğunu görün."
    ),
    ctaPrimary: t("Start free trial →", "Ücretsiz denemeyi başlat →"),
    ctaSecondary: t("Get a quote", "Teklif alın"),
    loginPrefix: t("Already using dentali.?", "Zaten dentali. kullanıyor musunuz?"),
    loginLink: t("Sign in", "Giriş yap"),
    kioskLink: t("Kiosk check-in", "Kiosk giriş"),
  },
  nav: {
    product: t("Product", "Ürün"),
    pricing: t("Pricing", "Fiyatlandırma"),
    quote: t("Get a quote", "Teklif alın"),
    signIn: t("Sign in", "Giriş yap"),
    startTrial: t("Start free trial", "Ücretsiz dene"),
  },
  footer: {
    slogan: t("Software that makes your clinic smile — one branch-aware system for the whole team.", "Kliniğinizi gülümseten yazılım — tüm ekip için şube bilincine sahip tek sistem."),
    tagline: t("Built for modern dental clinics.", "Modern diş klinikleri için tasarlandı."),
    productTitle: t("Product", "Ürün"),
    companyTitle: t("Company", "Şirket"),
    legalTitle: t("Legal", "Yasal"),
    featuresLink: t("Features", "Özellikler"),
    pricingLink: t("Pricing", "Fiyatlandırma"),
    securityLink: t("Security", "Güvenlik"),
    aboutLink: t("About", "Hakkımızda"),
    contactLink: t("Contact", "İletişim"),
    blogLink: t("Blog", "Blog"),
    privacyLink: t("Privacy policy", "Gizlilik politikası"),
    termsLink: t("Terms of service", "Hizmet şartları"),
  },
} as const
