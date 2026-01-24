import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Real Estate",
  description: "Find your dream home",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
