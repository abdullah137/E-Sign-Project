import type { Metadata, Viewport } from "next";
import { Newsreader, Open_Sans } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const openSans = Open_Sans({
  subsets: ["latin"],
  variable: "--font-open-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const signature = Newsreader({
  subsets: ["latin"],
  variable: "--font-signature",
  display: "swap",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: {
    default: "Juripass — Tenancy agreements, signed",
    template: "%s · Juripass",
  },
  description:
    "Screen tenants, involve landlords and prepare tenancy agreements with an integrated signing workflow. Juripass keeps the property, the people and the evidence in one workspace for lawyers and rental agencies.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1220" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${openSans.variable} ${signature.variable}`}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
