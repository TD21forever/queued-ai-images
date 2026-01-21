import type { Metadata } from "next";
import { JetBrains_Mono, Newsreader, Space_Grotesk } from "next/font/google";
import "./globals.css";

const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const body = Newsreader({
  variable: "--font-body",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-code",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "提示词星图",
  description: "带队列控制的轻量文生图工作室。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${display.variable} ${body.variable} ${mono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
