"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { ThemeProvider } from "@mui/material/styles"
import CssBaseline from "@mui/material/CssBaseline"
import { theme } from "@/lib/theme"
import { LanguageProvider } from "@/contexts/language-context"
import ReportForm from "@/components/ReportForm"

export default function BilgiGirisiPage() {
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
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LanguageProvider>
        <ReportForm initialSiteId={initialSiteId} initialSiteName={initialSiteName || undefined} />
      </LanguageProvider>
    </ThemeProvider>
  )
}
