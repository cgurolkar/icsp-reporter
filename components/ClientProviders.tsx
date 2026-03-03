"use client"

import { type ReactNode } from "react"
import { LanguageProvider } from "@/contexts/language-context"
import { AuthProvider } from "@/contexts/auth-context"
import RegisterServiceWorker from "@/components/RegisterServiceWorker"

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider>
      <AuthProvider>
        <RegisterServiceWorker />
        {children}
      </AuthProvider>
    </LanguageProvider>
  )
}
