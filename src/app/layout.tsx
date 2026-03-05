import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YieldLab - Revenue Management Dashboard",
  description: "Hotel dynamic pricing and revenue management platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
