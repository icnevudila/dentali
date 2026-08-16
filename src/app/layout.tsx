import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { CookieConsentBanner } from "@/components/marketing/CookieConsentBanner";
import { LocaleBootstrap } from "@/components/i18n/LocaleBootstrap";
import { BRAND_NAME, BRAND_TITLE, BRAND_TITLE_TEMPLATE } from "@/lib/brand";
import { getSiteUrl } from "@/lib/site-url";
import { Toaster } from "sonner";
import { TOASTER_OPTIONS } from "@/lib/ui/notify";
import "./globals.css";

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
  themeColor: "#f9fafb",
  colorScheme: "light",
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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">
        <LocaleBootstrap />
        <ServiceWorkerRegister />
        <CookieConsentBanner />
        {children}
        <Toaster {...TOASTER_OPTIONS} />
      </body>
    </html>
  );
}
