/** Public paths under /landing — plain paths (query strings break next/image). */
export function landingAsset(path: string) {
  return path
}
const v = landingAsset

export const LANDING_VIDEOS = {
  system: {
    src: v("/landing/videos/system-video.mp4"),
    poster: v("/landing/hero-dashboard.png"),
    alt: "dentQL clinic system overview",
  },
  queue: {
    src: v("/landing/videos/queue-video.mp4"),
    poster: v("/landing/timeline-tv-queue.png"),
    alt: "Waiting room queue display",
  },
  kiosk: {
    src: v("/landing/videos/kiosk-video.mp4"),
    poster: v("/landing/timeline-kiosk.png"),
    alt: "Kiosk check-in demo",
  },
  portal: {
    src: v("/landing/videos/patient-portal-video.mp4"),
    poster: v("/landing/device-mobile-appointments.png"),
    alt: "Patient portal demo",
  },
} as const

export type LandingVideoKey = keyof typeof LANDING_VIDEOS

export const LANDING_HERO_IMAGE = v("/landing/dental-chart.png")

export const LANDING_HERO_SLIDES = [
  { src: LANDING_HERO_IMAGE, alt: "dentQL dental chart" },
] as const

export const LANDING_PROBLEM_SCREENSHOT = v("/landing/problem-dashboard.png")

export const LANDING_QUEUE_TV = v("/landing/timeline-tv-queue.png")

export const LANDING_DEVICES = {
  tablet: v("/landing/device-tablet-kiosk.png"),
  desktop: v("/landing/device-desktop-dashboard.png"),
  mobile: v("/landing/device-mobile-appointments.png"),
} as const

/** Hero slideshow — each app page across desktop / tablet / mobile */
export const LANDING_HERO_PAGES = [
  {
    id: "dashboard",
    label: { en: "Dashboard", tr: "Kontrol Paneli" },
    desktop: v("/landing/hero-dashboard.png"),
    tablet: v("/landing/device-tablet-kiosk.png"),
    mobile: v("/landing/device-mobile-appointments.png"),
  },
  {
    id: "chart",
    label: { en: "Dental chart", tr: "Diş şeması" },
    desktop: v("/landing/dental-chart.png"),
    tablet: v("/landing/device-tablet-kiosk.png"),
    mobile: v("/landing/device-mobile-appointments.png"),
  },
  {
    id: "appointments",
    label: { en: "Appointments", tr: "Randevular" },
    desktop: v("/landing/hero-appointments.png"),
    tablet: v("/landing/device-tablet-kiosk.png"),
    mobile: v("/landing/device-mobile-appointments.png"),
  },
  {
    id: "queue",
    label: { en: "Queue & TV", tr: "Sıra & TV" },
    desktop: v("/landing/hero-queue.png"),
    tablet: v("/landing/device-tablet-kiosk.png"),
    mobile: v("/landing/device-mobile-appointments.png"),
  },
] as const
