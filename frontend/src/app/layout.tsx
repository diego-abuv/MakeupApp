import type { Metadata } from "next";
import { connection } from "next/server";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SHOP_NAME = process.env.NEXT_PUBLIC_SHOP_NAME || "MakeupApp Studio";
const SITE_URL =
  process.env.NEXT_PUBLIC_SHOP_ADDRESS || "https://makeupapp.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "MakeupApp - Agende seu horário",
  description:
    "Agende seu horário no estúdio de maquiagem em poucos cliques, sem WhatsApp.",
  openGraph: {
    type: "website",
    siteName: SHOP_NAME,
    locale: "pt_BR",
    url: SITE_URL,
    title: `${SHOP_NAME} · Agende seu horário`,
    description:
      "Escolha o dia, o serviço e o horário em poucos cliques — e garanta o sinal de 50% via Pix.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: `${SHOP_NAME} — Agende seu horário`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SHOP_NAME} · Agende seu horário`,
    description:
      "Escolha o dia, o serviço e o horário em poucos cliques — e garanta o sinal de 50% via Pix.",
    images: ["/og.png"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Dynamic rendering: permite ao Proxy injetar o nonce do CSP por request.
  await connection();
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
