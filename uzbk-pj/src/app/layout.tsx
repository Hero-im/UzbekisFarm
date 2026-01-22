import type { Metadata } from "next";
import { Hahmlet, Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import Providers from "@/app/providers";

const bodyFont = Noto_Sans_KR({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const displayFont = Hahmlet({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Local Market MVP",
  description: "Local produce marketplace MVP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${bodyFont.variable} ${displayFont.variable} antialiased`}>
        <Providers>
          <div className="min-h-screen text-[var(--ink)]">
            <Nav />
            <main className="mx-auto w-full max-w-7xl px-6 py-10">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
