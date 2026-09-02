import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "Inglês com Gabriel — Suas aulas de inglês";
  const description = "Aulas gravadas, prática e conversação para você falar inglês com confiança.";
  return {
    title,
    description,
    metadataBase: new URL(origin),
    openGraph: { title, description, type: "website", locale: "pt_BR", images: [{ url: `${origin}/og-ingles-com-gabriel.png`, width: 1536, height: 1024, alt: "Inglês com Gabriel — Fale inglês com confiança" }] },
    twitter: { card: "summary_large_image", title, description, images: [`${origin}/og-ingles-com-gabriel.png`] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
