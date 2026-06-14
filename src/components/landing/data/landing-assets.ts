/** Public paths under /landing — sourced from landing-ready crops */

export const LANDING_VIDEOS = {
  kiosk: {
    src: "/landing/videos/kiosk-video.mp4",
    poster: "/landing/timeline-kiosk.png",
    alt: "Kiosk check-in demo",
  },
  portal: {
    src: "/landing/videos/patient-portal-video.mp4",
    poster: "/landing/device-mobile-appointments.png",
    alt: "Patient portal demo",
  },
} as const

export type LandingVideoKey = keyof typeof LANDING_VIDEOS

export const LANDING_HERO_SLIDES = [
  { src: "/landing/hero-dashboard.png", alt: "dentali dashboard" },
  { src: "/landing/hero-dental-chart.png", alt: "dentali dental chart" },
  { src: "/landing/hero-appointments.png", alt: "dentali scheduler" },
  { src: "/landing/hero-queue.png", alt: "dentali queue" },
] as const

export const LANDING_PROBLEM_SCREENSHOT = "/landing/problem-dashboard.png"

export const LANDING_QUEUE_TV = "/landing/timeline-tv-queue.png"

export const LANDING_DEVICES = {
  tablet: "/landing/device-tablet-kiosk.png",
  desktop: "/landing/device-desktop-dashboard.png",
  mobile: "/landing/device-mobile-appointments.png",
} as const

/** Hero slideshow — each app page across desktop / tablet / mobile */
export const LANDING_HERO_PAGES = [
  {
    id: "dashboard",
    label: { en: "Dashboard", tr: "Kontrol Paneli" },
    desktop: "/landing/hero-dashboard.png",
    tablet: "/landing/device-tablet-kiosk.png",
    mobile: "/landing/device-mobile-appointments.png",
  },
  {
    id: "chart",
    label: { en: "Dental chart", tr: "Diş şeması" },
    desktop: "/landing/hero-dental-chart.png",
    tablet: "/landing/device-tablet-kiosk.png",
    mobile: "/landing/device-mobile-appointments.png",
  },
  {
    id: "appointments",
    label: { en: "Appointments", tr: "Randevular" },
    desktop: "/landing/hero-appointments.png",
    tablet: "/landing/device-tablet-kiosk.png",
    mobile: "/landing/device-mobile-appointments.png",
  },
  {
    id: "queue",
    label: { en: "Queue & TV", tr: "Sıra & TV" },
    desktop: "/landing/hero-queue.png",
    tablet: "/landing/device-tablet-kiosk.png",
    mobile: "/landing/device-mobile-appointments.png",
  },
] as const
