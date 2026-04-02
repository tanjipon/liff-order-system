import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LIFF Order System",
  description: "An app for ordering.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-TW"
      className={`h-full`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}