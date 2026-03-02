import type { Metadata } from "next"
import "./globals.css"
import ClientProviders from "@/components/ClientProviders"
import ConditionalSiteLayout from "@/components/ConditionalSiteLayout"

export const metadata: Metadata = {
  title: "ICSP Reporter",
  description: "Günlük çalışma raporu - Rekäiz Al-Turba / ICSP",
  generator: "ICSP Reporter",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ICSP Reporter",
  },
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover" as const,
  themeColor: "#1a237e",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="tr">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
      </head>
      <body style={{ margin: 0 }}>
        <ClientProviders>
          <ConditionalSiteLayout>{children}</ConditionalSiteLayout>
        </ClientProviders>
      </body>
    </html>
  )
}
