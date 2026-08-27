import type { Metadata, Viewport } from "next";
import AnalyticsProvider from "@/components/analytics-provider";
import PwaProvider from "@/components/pwa-provider";
import "./globals.css";

const title = "謝罪AI — 考え抜いた結果、すみません。";
const description =
  "どんな相談を入力しても、最後は謝ることしかできないAI風のジョークアプリ。生成AI API不使用・アカウント不要・入力は端末内だけで処理。誠意だけは、最先端。";

export const metadata: Metadata = {
  metadataBase: new URL("https://apology-ai-iota.vercel.app"),
  title,
  description,
  applicationName: "謝罪AI",
  keywords: ["謝罪AI", "ジョークアプリ", "謝罪", "生成AI API不使用", "PWA"],
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    title,
    description,
    type: "website",
    locale: "ja_JP",
    siteName: "謝罪AI",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "謝罪AI。考え抜いた結果、すみません。生成AI API不使用のジョークアプリ。",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og.png"],
  },
  appleWebApp: { capable: true, title: "謝罪AI", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8f5" },
    { media: "(prefers-color-scheme: dark)", color: "#101914" },
  ],
  colorScheme: "light dark",
};

const themeScript = `(function(){try{var t=localStorage.getItem('apology-ai:theme');if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t;document.documentElement.classList.toggle('dark',t==='dark');}catch(e){if(matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.dataset.theme='dark';document.documentElement.classList.add('dark');}}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <PwaProvider />
        <AnalyticsProvider />
      </body>
    </html>
  );
}
