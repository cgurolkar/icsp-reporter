# ICSP Reporter — Android Uygulaması Planı

**Kararlar (onaylandı):** Capacitor · offline-first zorunlu · Play Store (kurumsal hesap) + doğrudan APK · ilk sürüm kapsamı: Günlük rapor formu, Raporlar/görüntüleme, Admin paneli

---

## 1. Mevcut durumun özeti

| Konu | Durum |
|---|---|
| Framework | Next.js 14.2.16 App Router, `output: 'standalone'` |
| Veritabanı | PostgreSQL (`lib/database.ts`, 996 satır) — SQLite yolu (`lib/sqlite.ts`) kullanılmıyor |
| Auth | JWT (jose, HS256, 7 gün) → `icsp_session` **httpOnly cookie** |
| Roller | `admin`, `manager`, `user`, `personel`, `operator` (`lib/auth.ts`) |
| Yayın | Docker Compose, **HTTP** `:3001` (cookie `Secure` bilinçli olarak kapalı) |
| PWA | `app/manifest.ts` + `public/sw.js` (yalnızca kurulabilirlik; önbellek yok) |
| Mobil ekranlar | **Hepsi `"use client"`** — `app/form`, `app/reports`, `app/admin`, `app/proje`, `app/login`, `app/operator-form` |
| Next bağımlılığı (UI) | 7× `next/navigation`, 6× `next/link`, 1× `next/image` → çok düşük |

**En önemli bulgu:** Arayüz fiilen `/api/*` ile konuşan bir SPA. Sunucu bileşeni içinde veri çekimi yok. Bu yüzden ekranları yeniden yazmaya gerek yok — Capacitor'a paketlenebilirler.

---

## 2. Mimari kararı: neden "paketlenmiş SPA", neden "remote URL" değil

Capacitor'ın iki kullanım modeli var ve **offline-first şartı seçimi tek başına belirliyor**:

| Model | Nasıl çalışır | Offline | Karar |
|---|---|---|---|
| A — `server.url` | WebView doğrudan `https://sunucu` adresini açar | ❌ Bağlantı yoksa sayfa bile açılmaz | **Red** |
| B — paketlenmiş `webDir` | Arayüz APK'nın içinde; veri HTTPS API ile | ✅ Arayüz her zaman açılır, veri yerelde kuyruklanır | **Seçildi** |

Model B'nin uygulanışı — **tek kod tabanı korunur**:

- `app/api/**` + `middleware.ts` sunucuda kalır (değişmez, web sürümü aynen çalışmaya devam eder).
- Mobil için ikinci bir derleme hedefi: `output: 'export'`. Bu mod route handler ve middleware ile bir arada **çalışmaz**, bu yüzden `scripts/build-mobile.sh` kaynak ağacını filtreleyerek geçici bir dizine kopyalar:
  - dışarıda bırakılır: `app/api/`, `middleware.ts`, `app/admin-bypass/`, `app/icon.tsx`, `app/apple-icon.tsx` (son ikisi `ImageResponse` kullanıyor, export'ta desteklenmez → yerine statik PNG)
  - `next build` → `out-mobile/` → Capacitor `webDir`
- Yedek yol (gerekirse): `mobile/` altında Vite + React SPA, mevcut `components/` ve `contexts/` doğrudan import edilir. Next bağımlılığı düşük olduğu için maliyeti sınırlı (`next/link` → `react-router` Link, `next/navigation` → `useNavigate` shim'leri). Ancak iki derleme yapılandırması bakım yükü getirir; **önce export yolu denenmeli**.

---

## 3. Ön koşullar — bunlar yapılmadan Android uygulaması çalışmaz

Bunlar "iyi olur" değil, **bloklayıcı**. Faz 0'da bitmeli.

### 3.1 HTTPS (zorunlu)
Sunucu şu an düz HTTP'de. Android 9+ varsayılan olarak cleartext trafiği engeller; Play Store'da `usesCleartextTraffic` ile ilerlemek hem güvenlik hem inceleme riski.
- Alan adı + Caddy veya nginx + Let's Encrypt (Caddy otomatik sertifika ile en az iş).
- `docker-compose.yml`'e reverse proxy servisi.
- Sonrasında `lib/auth.ts:setSessionCookie` zaten HTTPS'te `Secure` ekliyor — ek iş yok.

### 3.2 Bearer token desteği (zorunlu)
Capacitor WebView'ın origin'i `https://localhost`. API `https://rapor.firma.com` olunca her istek **cross-origin** olur; `SameSite=Lax` cookie gönderilmez.
- `lib/auth-session.ts:getSessionFromRequest` → önce `Authorization: Bearer <token>` başlığına, yoksa cookie'ye bakmalı. (Küçük, geriye dönük uyumlu değişiklik; web tarafı etkilenmez.)
- `app/api/auth/login/route.ts` yanıtına token'ı gövdede de eklemek (cookie korunur).
- `/api/*` için CORS: uygulama origin'ine `Access-Control-Allow-Origin`, `OPTIONS` ön kontrol yanıtı.
- Token Capacitor Preferences değil, **güvenli depo**da tutulmalı (`capacitor-secure-storage-plugin` veya Android Keystore destekli eşdeğeri).
- 7 günlük tek token sahada yetersiz: **yenileme (refresh) akışı** eklenmeli, yoksa operatör haftada bir yeniden giriş yapar.

### 3.3 Fotoğraf yükleme akışının değişmesi (zorunlu)
`components/steps/daily-info-step.tsx` fotoğrafları `readAsDataURL` ile **base64 data URL** olarak `dailyInfo.image1/image2`'ye koyuyor; sınır 5 MB. Base64 şişmesiyle iki fotoğraf tek JSON POST'unda `/api/send-report`'a **~13 MB** olarak gidiyor.
- Şantiye mobil hattında bu istek pratikte başarısız olur; offline kuyrukta ise 13 MB'ı SQLite satırında taşımak demek.
- Gerekli: `POST /api/uploads` (multipart) + dosyayı diske/objeye yaz + rapora **referans** (URL/id) bağla. İstemci tarafında Capacitor Camera ile çek, yerel dosya olarak sakla, senkronizasyonda ayrı ayrı yükle.
- Yükleme öncesi istemcide yeniden boyutlandırma/sıkıştırma (örn. uzun kenar 1600px, JPEG q=0.8) → ~13 MB yerine ~600 KB.

### 3.4 Idempotency (zorunlu)
Offline kuyruk **yeniden dener**. Şu an `/api/send-report` her POST'ta yeni kayıt oluşturuyor → zayıf bağlantıda aynı günün raporu 2-3 kez düşer.
- İstemcide üretilen `client_uuid` (UUID v4) rapor gövdesine eklenir.
- `work_reports`/ilgili tabloya `client_uuid` kolonu + **UNIQUE index**; sunucu `ON CONFLICT DO NOTHING/UPDATE` ile upsert yapar ve mevcut kaydı döner.
- Bu, offline-first'ün olmazsa olmazı; atlanırsa veri bütünlüğü bozulur.

---

## 4. Offline-first tasarımı

### 4.1 Kapsam kararı (öneri)
Offline yazma **yalnızca günlük rapor formu** (ve ileride operatör makine girişi) için. Gerekçe: admin paneli kullanıcı/şantiye/makine mutasyonları yapıyor; bunların offline yazımı çakışma çözümünü katlanarak zorlaştırır, sahada da ihtiyaç yok.

| Ekran | Offline davranışı |
|---|---|
| Günlük rapor formu | **Tam offline:** yerel kayıt + kuyruk + otomatik senkronizasyon |
| Raporlar / görüntüleme | **Salt-okuma önbellek:** son çekilen veri gösterilir, "çevrimdışı — son güncelleme: ..." etiketiyle |
| Admin paneli | **Yalnızca çevrimiçi:** bağlantı yoksa net uyarı, yazma denemesi engellenir |

### 4.2 Yerel veri katmanı
`@capacitor-community/sqlite` ile:

- `outbox(id, client_uuid, endpoint, method, payload_json, created_at, attempts, last_error, status)` — gönderilecek yazma işlemleri
- `outbox_files(id, outbox_id, local_path, field_name, uploaded_url)` — fotoğraflar, ayrı yüklenir
- `cache_sites`, `cache_machines`, `cache_users`, `cache_reports` — referans veri aynası (`updated_at` ile)
- `form_drafts(site_id, report_date, form_json, updated_at)` — yarım kalan form (otomatik kayıt)

Formun offline çalışması için **önceden önbelleğe alınması gereken** uçlar — bunlar form açılışında sunucuya soruluyor:
`/api/sites`, `/api/projects`, `/api/users`, `/api/reports/prev-day-planned`, `/api/sites/[id]/last-report`, `/api/sites/[id]/assigned-operators`, `/api/operator-entry?siteId=&reportDate=`, `/api/admin/settings`

Son iki tanesi (önceki günün planı, kalan kazık sayısı) formun ön-doldurmasını besliyor; önbelleklenmezse offline form eksik açılır.

### 4.3 Senkronizasyon
- Tetikleyiciler: uygulama ön plana gelişi, `@capacitor/network` bağlantı olayı, manuel "Şimdi senkronize et", form gönderimi.
- Sıra: önce `outbox_files` yüklemeleri → dönen URL'ler payload'a yazılır → sonra rapor POST'u. (Tersi olursa rapor fotoğrafsız kaydedilir.)
- Yeniden deneme: üstel geri çekilme (2s, 8s, 30s, 2dk, 10dk), kalıcı hata (4xx) → kuyruk `status='failed'`, kullanıcıya görünür liste + "tekrar dene".
- Çakışma kuralı — **netleştirilmeli:** aynı (şantiye, tarih) için sunucuda rapor varken offline rapor gelirse ne olacak? Öneri: `client_uuid` farklıysa sunucu **reddeder ve kullanıcıya "bu gün için rapor mevcut, görüntüle/birleştir" der**; sessiz üzerine yazma olmaz.
- Kullanıcıya durum göstergesi: bekleyen N kayıt, son senkronizasyon zamanı, çevrimdışı bandı.

---

## 5. Fazlar ve iş tahmini

Tahminler tek geliştirici-günü; aralık, belirsizliği yansıtıyor.

### Faz 0 — Ön koşullar (sunucu tarafı) · **4–6 gün**
1. HTTPS + alan adı + reverse proxy (Caddy) · 1 gün
2. `Authorization: Bearer` desteği + login yanıtında token + CORS · 1 gün
3. Refresh token akışı · 1 gün
4. `POST /api/uploads` (multipart) + rapora referansla bağlama + `daily-info-step` fotoğraf akışının değişmesi · 1,5–2 gün
5. `client_uuid` + UNIQUE index + `/api/send-report` upsert'e geçiş · 1 gün

### Faz 1 — Capacitor iskeleti · **3–4 gün**
6. `@capacitor/core`, `cli`, `android` kurulumu; `capacitor.config.ts` · 0,5 gün
7. `scripts/build-mobile.sh` + `next.config.mobile.mjs` (`output: 'export'`, filtrelenmiş ağaç, statik ikonlar) · 1–1,5 gün
8. `next/navigation` → Capacitor'da çalışan yönlendirme; `app/layout.tsx` mobil varyantı; middleware'in yaptığı rota koruması **istemci tarafına** taşınır (mobilde middleware yok) · 1 gün
9. API taban URL'i yapılandırması (dev/prod), `fetch` sarmalayıcı (token ekleme, 401'de yenileme) · 0,5–1 gün
10. İlk APK'nın cihazda açılması ve girişin çalışması — **doğrulama noktası** · 0,5 gün

### Faz 2 — Offline katmanı · **7–10 gün**
11. SQLite şeması + veri erişim katmanı · 1,5 gün
12. Outbox + senkronizasyon motoru (geri çekilme, dosya önceliği, hata durumları) · 3–4 gün
13. Referans veri önbelleği + offline form ön-doldurma · 1,5–2 gün
14. Form taslağı otomatik kaydı · 0,5 gün
15. Çevrimdışı/senkronizasyon arayüzü (bant, bekleyen liste, tekrar dene) · 1,5 gün
16. Raporlar ekranının salt-okuma önbelleği · 1 gün

### Faz 3 — Native yetenekler · **3–4 gün**
17. `@capacitor/camera` ile fotoğraf + sıkıştırma · 1 gün
18. Geri tuşu, splash, durum çubuğu, derin bağlantı, oturum sonlanması · 1 gün
19. (Opsiyonel) Push bildirim — rapor hatırlatması. FCM kurulumu + sunucu tarafı · 1–2 gün *(ilk sürümden çıkarılabilir)*

### Faz 4 — Play Store + APK · **3–5 gün (inceleme süresi hariç)**
20. İmzalama: upload keystore, `signingConfig`, **keystore yedeği** (kaybı = uygulamayı güncelleyememek) · 0,5 gün
21. `targetSdk`/`compileSdk` güncel Play gereksinimine ayarlanır — *gönderim öncesi Play Console'daki yürürlükteki zorunluluk teyit edilmeli* · 0,5 gün
22. Gizlilik politikası sayfası (fotoğraf, konum yoksa belirt, hesap verisi) + Play **Data safety** formu · 1 gün
23. Mağaza varlıkları: ikon 512×512, feature graphic 1024×500, en az 2 ekran görüntüsü, açıklamalar · 1 gün
24. AAB → Play (internal testing → production), APK → doğrudan dağıtım · 0,5 gün
25. `versionCode`/`versionName` şeması + sürüm notları · 0,5 gün

### Faz 5 — Test ve devreye alma · **4–6 gün**
26. Offline senaryo testleri: uçak modunda rapor, yarıda kesilen yükleme, token süresi dolması, aynı günün çift raporu, 2 fotoğraflı rapor zayıf hatta
27. Gerçek cihaz matrisi (en az 3 cihaz, Android 10–15 aralığı), düşük bellek, Türkçe/çoklu dil (`contexts/language-context.tsx`)
28. Sahada pilot: 1 şantiye, 1 hafta, geri bildirim turu

**Toplam: ~24–35 geliştirici-günü** (push bildirim hariç, Play inceleme bekleme süresi hariç).

---

## 6. Dosya/klasör yapısı (hedef)

```
icsp-reporter/
├─ app/                        # değişmez (web + mobil ortak)
│  └─ api/                     # yalnızca sunucu; mobil derlemede dışarıda
├─ components/                 # değişmez, ortak
├─ lib/
│  ├─ auth-session.ts          # ⟳ Bearer desteği
│  ├─ api-client.ts            # ✚ token+taban URL+401 yenileme sarmalayıcı
│  ├─ offline/
│  │  ├─ db.ts                 # ✚ SQLite şeması
│  │  ├─ outbox.ts             # ✚ kuyruk
│  │  ├─ sync.ts               # ✚ senkronizasyon motoru
│  │  └─ cache.ts              # ✚ referans veri
├─ android/                    # ✚ Capacitor native proje (git'e dahil)
├─ capacitor.config.ts         # ✚
├─ next.config.mobile.mjs      # ✚
├─ scripts/build-mobile.sh     # ✚
└─ ANDROID-PLAN.md             # bu dosya
```

---

## 7. Riskler

| Risk | Etki | Önlem |
|---|---|---|
| `output: 'export'` beklenmedik bir dinamik kullanımda patlar | Faz 1 uzar | Faz 1'in ilk işi derlemeyi çalıştırmak; tıkanırsa Vite yedek yoluna geçilir |
| Keystore kaybı | Uygulama bir daha güncellenemez | Parola yöneticisi + şifreli yedek, en az iki yerde; Play App Signing açık |
| Çakışma kuralı netleşmezse | Sahada veri kaybı/çift kayıt | Faz 2 öncesi karar: aynı gün + aynı şantiye raporu davranışı |
| Base64 fotoğraf akışı korunursa | Senkronizasyon sahada çalışmaz | Faz 0.4 pazarlık konusu değil |
| Admin panelinin (1466 satır) mobilde kullanılabilirliği | Düşük kullanım, yüksek destek yükü | İlk sürümde salt-okuma + kritik mutasyonlar; dar ekran düzeni Faz 3'te gözden geçirilir |
| Play inceleme gecikmesi | Yayın tarihi kayar | Faz 4'e internal testing ile erken başlanır |

---

## 8. Karara bağlanması gerekenler

1. **Alan adı** — uygulamanın bağlanacağı HTTPS adresi ne olacak?
2. **Çakışma kuralı** — aynı şantiye + aynı gün için ikinci rapor: reddet mi, yeni kayıt mı, birleştir mi?
3. **Operatör makine girişi** (`/operator-form`) ilk sürüm kapsamına alınmadı — ancak günlük rapor formundaki "Makine Detayları" bölümü operatör girişlerini okuyor (`/api/operator-entry`). Operatörler mobilde giriş yapamazsa bu bölüm sahada boş kalır. **Kapsama eklenmesi öneriliyor.**
4. **Push bildirim** ilk sürümde olsun mu? (Faz 3.19, 1–2 gün)
5. **Fotoğraf depolama** — sunucu diski mi, S3/R2 gibi bir obje depolama mı? (Yedekleme ve disk büyümesi açısından)
