import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Travel Goals Tracker",
  description: "Interactive 3D Globe Travel Planner",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}