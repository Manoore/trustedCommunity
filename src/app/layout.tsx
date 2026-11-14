import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PwaRegister } from "@/components/pwa-register";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#12866f",
  width: "device-width",
  initialScale: 1,
};

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Trusted By — the people you trust, recommending the people you need",
    template: "%s · Trusted By",
  },
  description:
    "Keep the businesses and people you already recommend to friends in one list, and share it with a link. Named recommendations, not anonymous star ratings.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-US">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <SiteHeader />
        <main id="main" className="mx-auto max-w-6xl px-4 py-8">
          {children}
        </main>
        <SiteFooter />
        <PwaRegister />
      </body>
    </html>
  );
}
