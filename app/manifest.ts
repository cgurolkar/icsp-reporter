import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ICSP Reporter - Günlük Çalışma Raporu",
    short_name: "ICSP Reporter",
    description: "Günlük çalışma raporu - Rekäiz Al-Turba / ICSP",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1a237e",
    orientation: "portrait",
    scope: "/",
    icons: [
      {
        src: "/icon",
        sizes: "32x32",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  }
}
