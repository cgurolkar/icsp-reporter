"use client"

import { usePathname } from "next/navigation"
import AppHeader from "@/components/AppHeader"
import TopNav from "@/components/TopNav"

export default function ConditionalSiteLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAdmin = pathname?.startsWith("/admin")

  return (
    <>
      {!isAdmin && (
        <>
          <AppHeader />
          <TopNav />
        </>
      )}
      {children}
    </>
  )
}
