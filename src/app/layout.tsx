import type { Metadata, Viewport } from "next";
import { Manrope, Newsreader } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: {
    default: "SignFlow — Sign with confidence",
    template: "%s · SignFlow",
  },
  description:
    "Prepare, send, sign and track documents in one considered workspace. A modern electronic signature platform for professionals and teams.",
};

export const viewport: Viewport = {
  themeColor: "#F8F9FA",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${manrope.variable} ${newsreader.variable}`}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
