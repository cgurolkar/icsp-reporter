"use client"

import { type ReactNode } from "react"
import { LanguageProvider } from "@/contexts/language-context"

export default function ClientProviders({ children }: { children: ReactNode }) {
  return <LanguageProvider>{children}</LanguageProvider>
}
