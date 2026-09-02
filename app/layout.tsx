import "./globals.css";
import { Inter, Roboto_Mono } from "next/font/google";
import type { Metadata, Viewport } from "next";

const APP_BACKGROUND_COLOR = "#050a11";

export const metadata = {
  title: {
    absolute: "7Teck.vn",
  },
  robots: {
    index: false,
    follow: true,
    googleBot: {
      index: false,
      follow: true,
    },
  },
  icons: {
    icon: {
      url: '/favicon.png',
      type: 'image/png',
    },
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
} satisfies Metadata;

export const viewport = {
  themeColor: APP_BACKGROUND_COLOR,
} satisfies Viewport;

const geistSans = Inter({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap', // Giảm CLS
});

const geistMono = Roboto_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap', // Giảm CLS
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      data-theme="mytheme"
      className="bg-[#050a11]"
      style={{
        backgroundColor: APP_BACKGROUND_COLOR,
        colorScheme: "dark",
      }}
    >
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-dvh bg-[#050a11] antialiased`}
        style={{
          backgroundColor: APP_BACKGROUND_COLOR,
        }}
      >
        {children}
      </body>
    </html>
  );
}