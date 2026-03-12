import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Matside Store",
  description: "Premium Jiu Jitsu gear from Matside",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-slate-950 text-slate-50 antialiased">{children}</body>
    </html>
  );
}
