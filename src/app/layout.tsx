import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { CookieConsentBanner } from "@/components/marketing/CookieConsentBanner";
import { LocaleBootstrap } from "@/components/i18n/LocaleBootstrap";
import { BRAND_NAME, BRAND_TITLE, BRAND_TITLE_TEMPLATE } from "@/lib/brand";
import { getSiteUrl } from "@/lib/site-url";
import { Toaster } from "sonner";
import { TOASTER_OPTIONS } from "@/lib/ui/notify";
import "./globals.css";

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-clinic-body",
  display: "swap",
});
const displayFont = Archivo({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-clinic-display",
  display: "swap",
});
const monoFont = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-clinic-mono",
  display: "swap",
});
const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: BRAND_TITLE,
    template: BRAND_TITLE_TEMPLATE,
  },
  description:
    "Branch-aware dental clinic operating system — patients, charting, billing, queue, HMO, and consent.",
  applicationName: BRAND_NAME,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: BRAND_NAME,
    statusBarStyle: "default",
  },
  openGraph: {
    type: "website",
    siteName: BRAND_NAME,
    locale: "en_PH",
    alternateLocale: ["en_US", "tr_TR", "fil_PH"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0EA5E9",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-theme="light">
      <body className={`${bodyFont.variable} ${displayFont.variable} ${monoFont.variable} font-sans`}>
        <LocaleBootstrap />
        <ServiceWorkerRegister />
        <CookieConsentBanner />
        {children}
        <Toaster {...TOASTER_OPTIONS} />
      </body>
    </html>
  );
}
