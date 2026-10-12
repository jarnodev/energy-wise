import type { Metadata } from "next";
import { Inter } from 'next/font/google'
import "./globals.css";
import { ThemeProvider } from "../components/theme-provider";
import Footer from "../components/footer";
import { ThemeToggler } from "@/components/theme-toggler";

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: "Energy Wise",
  description: "Track the variable cost of energy and gas in the Netherlands",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>)
{
  return (
    <html lang="en">
      <body
        className={`${inter.className} antialiased min-h-screen flex flex-col`}
      >
        <ThemeProvider>
          <div className="flex-1 flex flex-col">{children}</div>
          <ThemeToggler />
        </ThemeProvider>
        <Footer />
      </body>
    </html>
  );
}
