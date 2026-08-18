import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Legajo Técnico Digital",
  description: "Gestión digital de Higiene y Seguridad Laboral",
  applicationName: "Legajo Técnico",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", type: "image/png" }],
  },
  openGraph: {
    title: "Legajo Técnico Digital",
    description: "Gestión digital de Higiene y Seguridad Laboral",
    siteName: "Legajo Técnico",
    locale: "es_AR",
    type: "website",
    images: [
      {
        url: "/login.jpg",
        width: 512,
        height: 512,
        alt: "Legajo Técnico",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Legajo Técnico Digital",
    description: "Gestión digital de Higiene y Seguridad Laboral",
    images: ["/login.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
