import type { Metadata } from "next";
import { Inter } from 'next/font/google'
import "./globals.css";
import { ThemeProvider } from "../components/theme-provider";
import Footer from "../components/footer";

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: "Energy Wise",
  description: "Track the variable cost of energy and gas in the Netherlands",
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
        </ThemeProvider>
        <Footer />
      </body>
    </html>
  );
}
