import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { CookieConsentBanner } from "@/components/marketing/CookieConsentBanner";
import { LocaleBootstrap } from "@/components/i18n/LocaleBootstrap";
import { BRAND_NAME, BRAND_TITLE, BRAND_TITLE_TEMPLATE } from "@/lib/brand";
import { getSiteUrl } from "@/lib/site-url";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });
const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: BRAND_TITLE,
    template: BRAND_TITLE_TEMPLATE,
  },
  description:
    "Branch-aware dental clinic operating system for Philippine clinics — patients, charting, billing, queue, HMO, and consent.",
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
      <body className={inter.className}>
        <LocaleBootstrap />
        <ServiceWorkerRegister />
        <CookieConsentBanner />
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
