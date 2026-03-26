/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  eslint: {
    // TODO: Bu flag kaldırıldığında mevcut ESLint uyarılarını temizle
    ignoreDuringBuilds: true,
  },
  typescript: {
    // TODO: Bu flag kaldırıldığında mevcut TypeScript hatalarını düzelt
    // Kaldırmadan önce: npx tsc --noEmit ile hataları listele
    ignoreBuildErrors: true,
  },
  images: {
    // TODO: Görselleri DB'den dosya sistemine taşıdıktan sonra unoptimized: false yap
    unoptimized: true,
  },
}

export default nextConfig
