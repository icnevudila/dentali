/* ── Landing page data: features, testimonials, FAQ, timeline, i18n ── */

import type { LucideIcon } from "lucide-react"
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

export interface SocialMetric {
  value: number
  suffix: string
  label: LandingText
}

export const SOCIAL_METRICS: SocialMetric[] = [
  { value: 12000, suffix: "+", label: t("Patients managed", "Yönetilen hasta") },
  { value: 50, suffix: "+", label: t("Clinics", "Klinik") },
  { value: 99.9, suffix: "%", label: t("Uptime", "Çalışma süresi") },
  { value: 4.9, suffix: "★", label: t("Average rating", "Ortalama puan") },
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
      "Access your data securely from anywhere. Fast page loads, automatic daily backups, and offline protection.",
      "Verilerinize her yerden güvenle erişin. Hızlı sayfa yüklemeleri, otomatik günlük yedeklemeler ve çevrimdışı koruma."
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
  screenshot: string // path relative to /screenshots/all-pages/
}

export const FEATURES: FeatureItem[] = [
  {
    id: "dashboard",
    icon: LayoutDashboard,
    title: t("Dashboard", "Kontrol Paneli"),
    description: t("Real-time clinic pulse — appointments, queue, alerts, and revenue at a glance.", "Gerçek zamanlı klinik nabzı — randevular, sıra, uyarılar ve gelir bir bakışta."),
    screenshot: "dashboard/desktop.png",
  },
  {
    id: "patients",
    icon: Users,
    title: t("Patient Records", "Hasta Kayıtları"),
    description: t("Searchable registry with demographics, insurance, and intake history.", "Demografik bilgiler, sigorta ve kabul geçmişi ile aranabilir kayıt."),
    screenshot: "patients/desktop.png",
  },
  {
    id: "chart",
    icon: ClipboardList,
    title: t("Dental Chart", "Diş Şeması"),
    description: t("Interactive FDI odontogram with findings, notes, and treatment history.", "Bulgular, notlar ve tedavi geçmişi ile interaktif FDI odontogram."),
    screenshot: "patient-chart/desktop.png",
  },
  {
    id: "treatment",
    icon: FileText,
    title: t("Treatment Plans", "Tedavi Planları"),
    description: t("Plan, track, and present treatment options to patients with cost estimates.", "Tedavi seçeneklerini maliyet tahminleriyle planlayın, takip edin ve hastaya sunun."),
    screenshot: "patient-treatment-plan/desktop.png",
  },
  {
    id: "appointments",
    icon: CalendarDays,
    title: t("Appointments", "Randevular"),
    description: t("Chair calendars, provider scheduling, SMS reminders, and waitlist callbacks.", "Koltuk takvimleri, doktor programı, SMS hatırlatmaları ve bekleme listesi."),
    screenshot: "appointments/desktop.png",
  },
  {
    id: "queue",
    icon: Tv,
    title: t("Queue & Waitlist", "Sıra & Bekleme"),
    description: t("Real-time queue management with kiosk check-in and waiting-room TV display.", "Kiosk check-in ve bekleme odası TV ekranı ile gerçek zamanlı sıra yönetimi."),
    screenshot: "queue/desktop.png",
  },
  {
    id: "billing",
    icon: CreditCard,
    title: t("Billing & Claims", "Faturalama"),
    description: t("Invoices, payment ledger, HMO claim tracking, and PhilHealth eClaims prep.", "Faturalar, ödeme defteri, HMO talep takibi ve PhilHealth eClaims hazırlığı."),
    screenshot: "billing/desktop.png",
  },
  {
    id: "inventory",
    icon: Package,
    title: t("Inventory", "Envanter"),
    description: t("Stock tracking with low-stock alerts and automatic reorder suggestions.", "Düşük stok uyarıları ve otomatik yeniden sipariş önerileri ile stok takibi."),
    screenshot: "inventory/desktop.png",
  },
  {
    id: "reports",
    icon: BarChart3,
    title: t("Reports & Analytics", "Raporlar"),
    description: t("Revenue analytics, day-end closeout, compliance reports, and audit trail.", "Gelir analitiği, gün sonu kapanış, uyumluluk raporları ve denetim izi."),
    screenshot: "reports/desktop.png",
  },
  {
    id: "staff",
    icon: Shield,
    title: t("Staff & Roles", "Personel & Roller"),
    description: t("Team management with role-based access control and activity audit log.", "Rol tabanlı erişim kontrolü ve etkinlik denetim günlüğü ile ekip yönetimi."),
    screenshot: "staff/desktop.png",
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
    screenshot: "dashboard/desktop.png",
    device: "desktop",
  },
  {
    time: "8:00",
    title: t("Patient checks in at kiosk", "Hasta kiosk'tan kayıt yaptırır"),
    description: t("Walk-in or appointed — the patient taps their name on the tablet and gets a queue number.", "Randevulu veya randevusuz — hasta tablette ismini seçer ve sıra numarası alır."),
    screenshot: "queue/tablet.png",
    device: "tablet",
  },
  {
    time: "8:30",
    title: t("Review patient profile", "Hasta profilini inceleyin"),
    description: t("Pull up demographics, medical history, past treatments, and insurance details.", "Demografik bilgileri, tıbbi geçmişi, geçmiş tedavileri ve sigorta detaylarını görün."),
    screenshot: "patient-profile/desktop.png",
    device: "desktop",
  },
  {
    time: "9:00",
    title: t("Chart findings on the odontogram", "Diş şemasına bulguları işleyin"),
    description: t("Tap teeth, record findings, attach clinical notes — all linked to the patient file.", "Dişlere tıklayın, bulguları kaydedin, klinik notlar ekleyin — hepsi hasta dosyasına bağlı."),
    screenshot: "patient-chart/desktop.png",
    device: "desktop",
  },
  {
    time: "10:00",
    title: t("Waiting room shows live queue", "Bekleme odası canlı sırayı gösterir"),
    description: t("The TV display board shows who's next — calm typography, no PHI beyond first names.", "TV ekranı sıradakini gösterir — sakin tipografi, ad dışında kişisel bilgi yok."),
    screenshot: "queue/desktop.png",
    device: "tv",
  },
  {
    time: "12:00",
    title: t("Generate invoice & submit claim", "Fatura oluşturun & talep gönderin"),
    description: t("Invoices in PHP, payment ledger updated, HMO claim filed — one screen.", "PHP cinsinden faturalar, ödeme defteri güncellenir, HMO talebi dosyalanır — tek ekran."),
    screenshot: "billing/desktop.png",
    device: "desktop",
  },
  {
    time: "15:00",
    title: t("Check inventory levels", "Envanter seviyelerini kontrol edin"),
    description: t("Low-stock alerts for supplies, reorder suggestions ready for approval.", "Malzeme düşük stok uyarıları, onay için hazır yeniden sipariş önerileri."),
    screenshot: "inventory/desktop.png",
    device: "desktop",
  },
  {
    time: "17:00",
    title: t("Run day-end closeout", "Gün sonu kapanışını çalıştırın"),
    description: t("Revenue summary, patient count, outstanding balances — one click to close the day.", "Gelir özeti, hasta sayısı, ödenmemiş bakiyeler — tek tıkla günü kapatın."),
    screenshot: "reports-closeout/desktop.png",
    device: "desktop",
  },
]

/* ═══════════════════════════════════════════════
   Testimonials (Placeholder)
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
    name: "Dr. Maria Santos",
    role: "Owner & Dentist",
    clinic: "BrightSmile Dental Makati",
    initials: "MS",
    color: "#14b8a6",
    rating: 5,
    quote: t(
      "We switched from paper charts and three different apps. Now everything is in one place — my staff learned it in a day.",
      "Kağıt dosyalardan ve üç farklı uygulamadan geçtik. Artık her şey tek yerde — personelim bir günde öğrendi."
    ),
  },
  {
    name: "Dr. Ricardo Lim",
    role: "Orthodontist",
    clinic: "Lim Orthodontics BGC",
    initials: "RL",
    color: "#3b82f6",
    rating: 5,
    quote: t(
      "The dental chart is beautiful and fast. I can chart findings while talking to the patient — no more scribbling on paper after.",
      "Diş şeması güzel ve hızlı. Hastayla konuşurken bulguları işleyebiliyorum — artık sonradan kağıda karalamak yok."
    ),
  },
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
    name: "Dr. James Cruz",
    role: "Clinic Owner",
    clinic: "Cruz Dental Pasig",
    initials: "JC",
    color: "#8b5cf6",
    rating: 5,
    quote: t(
      "I have three branches and I can see all their dashboards from my phone. The branch-aware design is exactly what chains need.",
      "Üç şubem var ve hepsinin panelini telefonumdan görebiliyorum. Şube bilinçli tasarım tam olarak zincirlerin ihtiyacı."
    ),
  },
  {
    name: "Dr. Patricia Tan",
    role: "Pediatric Dentist",
    clinic: "Little Teeth Dental",
    initials: "PT",
    color: "#ec4899",
    rating: 5,
    quote: t(
      "Parents love the kiosk check-in — kids just tap their name and sit down. No more crowded reception desks.",
      "Ebeveynler kiosk check-in'i seviyor — çocuklar sadece isimlerine dokunup oturuyor. Artık kalabalık resepsiyon yok."
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
  {
    name: "Dr. Elena Garcia",
    role: "Endodontist",
    clinic: "RootCare Dental Cebu",
    initials: "EG",
    color: "#10b981",
    rating: 5,
    quote: t(
      "Treatment plans are so clear now. I can show patients exactly what we'll do, how much it costs, and track progress per tooth.",
      "Tedavi planları artık çok net. Hastalara tam olarak ne yapacağımızı, maliyetini gösterebiliyor ve diş başına ilerlemeyi takip edebiliyorum."
    ),
  },
  {
    name: "Dr. Kevin Ong",
    role: "General Dentist",
    clinic: "Ong Family Dental",
    initials: "KO",
    color: "#f97316",
    rating: 4,
    quote: t(
      "Honestly didn't think we needed software — we're a small clinic. But the appointment reminders alone saved us from no-shows.",
      "Yazılıma ihtiyacımız olduğunu düşünmüyordum — küçük bir kliniğiz. Ama randevu hatırlatmaları bile gelmeyenleri azalttı."
    ),
  },
  {
    name: "Dr. Lisa Mendoza",
    role: "Prosthodontist",
    clinic: "Precision Dental Lab & Clinic",
    initials: "LM",
    color: "#6366f1",
    rating: 5,
    quote: t(
      "The inventory module finally solved our supply ordering chaos. Low-stock alerts mean we never run out mid-procedure.",
      "Envanter modülü sipariş kaosunu çözdü. Düşük stok uyarıları sayesinde işlem sırasında malzememiz hiç bitmiyor."
    ),
  },
  {
    name: "Carlo Aquino",
    role: "IT Administrator",
    clinic: "DentaGroup (5 branches)",
    initials: "CA",
    color: "#14b8a6",
    rating: 5,
    quote: t(
      "Zero installation, runs in the browser, works on any device. I set up a new branch in 30 minutes — including the TV display.",
      "Kurulum yok, tarayıcıda çalışıyor, her cihazda çalışıyor. TV ekranı dahil 30 dakikada yeni şube kurdum."
    ),
  },
  {
    name: "Dr. Sofia Ramos",
    role: "Oral Surgeon",
    clinic: "Metro Oral Surgery Center",
    initials: "SR",
    color: "#ef4444",
    rating: 5,
    quote: t(
      "Consent forms used to be our biggest compliance headache. Digital consent signing with dentali. is seamless and audit-ready.",
      "Onay formları en büyük uyumluluk sorunumuzdu. dentali. ile dijital onay imzalama sorunsuz ve denetime hazır."
    ),
  },
  {
    name: "Nurse Joy Dela Cruz",
    role: "Dental Hygienist",
    clinic: "FreshSmile Dental Davao",
    initials: "JD",
    color: "#a855f7",
    rating: 5,
    quote: t(
      "I can see my patient list, their medical history, and clinical notes all on my phone before they even sit in the chair.",
      "Hasta koltuğa oturmadan önce hasta listemi, tıbbi geçmişlerini ve klinik notlarını telefonumdan görebiliyorum."
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
      "Absolutely. All data is encrypted at rest and in transit. We use Supabase with row-level security, role-based access control, and full audit logging.",
      "Kesinlikle. Tüm veriler hem depolamada hem de aktarımda şifrelenir. Satır düzeyi güvenlik, rol tabanlı erişim kontrolü ve tam denetim kaydı kullanıyoruz."
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
    question: t("Do you support PhilHealth eClaims?", "PhilHealth eClaims destekliyor musunuz?"),
    answer: t(
      "Yes. We prepare your claims data in the format PhilHealth requires, track submission status, and keep audit-ready records for compliance.",
      "Evet. Talep verilerinizi PhilHealth'in gerektirdiği formatta hazırlıyor, gönderim durumunu takip ediyor ve uyumluluk için denetime hazır kayıtlar tutuyoruz."
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
    eyebrow: t("Modern Dental Clinic Operating System", "Modern Diş Kliniği İşletim Sistemi"),
    title1: t("Your entire clinic.", "Tüm kliniğiniz."),
    title2: t("One system.", "Tek bir sistem."),
    subtitle: t(
      "Patients, appointments, charting, billing, queue, kiosk, and consent — branch-aware from day one.",
      "Hastalar, randevular, diş şeması, faturalama, sıra, kiosk ve onam formları — ilk günden çok şubeli."
    ),
    ctaPrimary: t("Start free trial →", "Ücretsiz denemeyi başlat →"),
    ctaSecondary: t("Get a quote", "Teklif alın"),
    trustLine: t("Trusted by 50+ modern clinics worldwide", "Dünya genelinde 50+ modern klinik tarafından güveniliyor"),
  },
  problem: {
    eyebrow: t("Operations Chaos", "Operasyonel Kaos"),
    title: t("Sound familiar?", "Tanıdık geldi mi?"),
    subtitle: t("Running a clinic is hard. Running it with five disconnected tools is harder.", "Klinik yönetmek zordur. Beş farklı kopuk araçla yönetmek daha da zordur."),
    transition: t("There's a better way.", "Daha iyi bir yol var."),
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
    title: t("Ready to modernize your clinic?", "Kliniğinizi modernleştirmeye hazır mısınız?"),
    subtitle: t("Join 50+ clinics already running on dentali.", "dentali. üzerinde çalışan 50+ kliniğe katılın."),
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
    slogan: t("Running modern dental clinics on one branch-aware system.", "Modern diş kliniklerini şube bilincine sahip tek bir sistemle yönetin."),
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
