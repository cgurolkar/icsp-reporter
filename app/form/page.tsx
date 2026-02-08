"use client"

import { Suspense, useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { ThemeProvider } from "@mui/material/styles"
import CssBaseline from "@mui/material/CssBaseline"
import { theme } from "@/lib/theme"
import { LanguageProvider } from "@/contexts/language-context"
import ReportForm from "@/components/ReportForm"

function FormContent() {
  const searchParams = useSearchParams()
  const siteIdParam = searchParams.get("siteId")
  const initialSiteId = siteIdParam ? parseInt(siteIdParam, 10) : undefined
  const [initialSiteName, setInitialSiteName] = useState<string>("")

  useEffect(() => {
    if (initialSiteId) {
      fetch("/api/sites")
        .then((res) => (res.ok ? res.json() : []))
        .then((list: { id: number; name: string }[]) => {
          const site = list.find((s) => s.id === initialSiteId)
          if (site) setInitialSiteName(site.name)
        })
        .catch(() => {})
    }
  }, [initialSiteId])

  return (
    <ReportForm initialSiteId={initialSiteId} initialSiteName={initialSiteName || undefined} />
  )
}

export default function BilgiGirisiPage() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LanguageProvider>
        <Suspense fallback={<div style={{ padding: 24, textAlign: "center" }}>Yükleniyor...</div>}>
          <FormContent />
        </Suspense>
      </LanguageProvider>
    </ThemeProvider>
  )
}
