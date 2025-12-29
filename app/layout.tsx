import type { Metadata } from "next"
import { Inter } from "next/font/google"
import Link from "next/link"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "AVS Brain by ValueTempo",
  description: "AVS brain decisioning layer for AI-native products",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <nav className="border-b bg-background">
          <div className="container mx-auto px-6 py-3">
            <div className="flex items-center gap-6">
              <Link href="/" className="font-semibold">
                AVS Brain
              </Link>
              <div className="flex items-center gap-4 text-sm">
                <Link href="/decision-log" className="hover:underline">
                  Decision Log
                </Link>
                <Link href="/configs" className="hover:underline">
                  Configs
                </Link>
                <Link href="/catalogs" className="hover:underline">
                  Catalogs
                </Link>
              </div>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  )
}

