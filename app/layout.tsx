import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Base Wall Sign",
  description: "Sign the Base wall from Farcaster.",
  manifest: "/manifest.json",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
