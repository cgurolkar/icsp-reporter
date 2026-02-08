import type { Metadata } from "next"
import "./globals.css"
import ClientProviders from "@/components/ClientProviders"
import ConditionalSiteLayout from "@/components/ConditionalSiteLayout"

export const metadata: Metadata = {
  title: "ICSP Reporter",
  description: "Günlük çalışma raporu - Rekäiz Al-Turba / ICSP",
  generator: "ICSP Reporter",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="tr">
      <body style={{ margin: 0 }}>
        <ClientProviders>
          <ConditionalSiteLayout>{children}</ConditionalSiteLayout>
        </ClientProviders>
      </body>
    </html>
  )
}
