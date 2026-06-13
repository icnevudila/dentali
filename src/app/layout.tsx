import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });
const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "dentali. | Clinic OS",
    template: "%s | dentali.",
  },
  description:
    "Branch-aware dental clinic operating system for Philippine clinics — patients, charting, billing, queue, HMO, and consent.",
  applicationName: "dentali.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "dentali.",
    statusBarStyle: "default",
  },
  openGraph: {
    type: "website",
    siteName: "dentali.",
    locale: "en_PH",
    alternateLocale: ["en_US", "tr_TR", "fil_PH"],
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-PH" suppressHydrationWarning data-theme="light">
      <body className={inter.className}>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
