import type { Metadata } from "next";
import "./globals.css";
import TabBar from "@/components/TabBar";

export const metadata: Metadata = {
  title: "SweetAsMenu - AI-Powered Digital Menus for NZ Restaurants",
  description: "Transform any restaurant menu with AI translation (50+ languages), photo enhancement, and instant QR codes. Perfect for all cuisines in New Zealand.",
  keywords: "digital menu, restaurant menu, QR code menu, AI translation, menu translation, food photo enhancement, restaurant technology, New Zealand restaurants, SweetAsMenu",
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.png', type: 'image/png', sizes: '32x32' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.png" type="image/png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="antialiased">
        <TabBar />
        <div>
          {children}
        </div>
      </body>
    </html>
  );
}

