import './globals.css';
import { Inter, Roboto_Mono } from 'next/font/google';
import { Metadata } from 'next';

export const metadata = {
  title: {
    absolute: '7Teck.vn',
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
    <html lang="vi" data-theme="mytheme">
      <head>
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
