import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "MantraCode — Agentic AI Coding Assistant for Your Terminal",
  description:
    "MantraCode is an agentic AI coding assistant that runs entirely inside your terminal. PLAN mode for exploration, BUILD mode for generation. Powered by Google Vertex AI.",
  openGraph: {
    title: "MantraCode — Agentic AI Coding Assistant",
    description:
      "An agentic AI coding assistant that runs entirely inside your terminal. PLAN mode for exploration, BUILD mode for generation.",
    type: "website",
    siteName: "MantraCode",
  },
  twitter: {
    card: "summary_large_image",
    title: "MantraCode — Agentic AI Coding Assistant",
    description:
      "An agentic AI coding assistant that runs entirely inside your terminal.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
