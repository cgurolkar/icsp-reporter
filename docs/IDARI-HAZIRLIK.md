# İdari Bölüm Hazırlık Planı

Bu belge, **icsp.txt** içindeki idari yönetim (personel, puantaj, finans, özlük) vizyonunun mevcut **ICSP Reporter** uygulamasına ve veritabanı mimarisine adım adım nasıl adapte edileceğini tanımlar.

**İçindekiler:** 1. Özet ve hedef eşleştirme · 2. Veritabanı mimarisi (PostgreSQL) · 3. Uygulama adaptasyonu (roller, URL’ler) · 4. Adım adım uygulama planı (Faz 1–5) · 5. Teknik notlar

---

## 1. Özet: Hedefler ve Mevcut Uygulama ile Eşleştirme

| icsp.txt hedefi | Uygulamadaki karşılık / eklenecek |
|-----------------|-----------------------------------|
| Personel – Şantiye eşleşmesi (tarih bazlı) | Yeni: `personel_atama` tablosu |
| Harcama kategorileri (Cost Codes) | Yeni: `harcama_kategorileri` + mevcut `work_reports.expenses` ile ilişki veya ayrı `islemler` tablosu |
| Puantaj onay mekanizması (şef girer → merkez onaylar) | Yeni: `puantaj` tablosu + `durum` (taslak/onaylı) + kilitleme |
| Özlük belge hatırlatıcı (sertifika, İSG, sağlık) | Yeni: `personel_belgeleri` + `gecerlilik_tarihi` + dashboard uyarıları |
| Avans ve kesinti | Yeni: `personel_avans_kesinti` veya puantaj/maaş modülünde alanlar |
| Şantiye kasa vs Merkez ödemeleri | Yeni: `islemler.odeme_kaynagi` (Şantiye_Kasa / Merkez_Banka) |
| Harcama girişine fotoğraf/fiş | Yeni: `islemler.evrak_yolu` (dosya yolu veya base64) |
| Rol bazlı yetkilendirme (RBAC) | Mevcut: `users.role` (admin, manager, user, personel, operator) + şantiye kısıtı |
| Log kayıtları (kim ne zaman değiştirdi) | Yeni: `audit_log` tablosu (finans / puantaj için) |

**Mevcut uygulama özeti**

- **Stack:** Next.js (App Router), PostgreSQL, MUI, session (JWT benzeri cookie).
- **Var olan tablolar:** `users`, `sites`, `work_reports`, `operator_entries`, `machine_selections`, `fuel_records`, `user_projects`. `users.site_id` ile kullanıcı–şantiye ataması var.
- **Roller:** admin, manager, user, personel, operator. Admin tüm şantiyeler; user/personel sadece `site_id` şantiyesi.
- **İdari sayfa:** `/idari` şu an placeholder (“Hazırlık aşamasında”).

---

## 2. Veritabanı Mimarisi (PostgreSQL)

Mevcut yapıya **referans veren** yeni tablolar. Tüm `CREATE TABLE` ifadeleri `lib/database.ts` içindeki `initializeDatabase()` ile uyumlu şekilde (sırayla, `sites` ve `users` sonrası) çalıştırılmalıdır.

### 2.1 Personel modülü

**Not:** Uygulamadaki `users` = giriş yapan kullanıcı (şef, merkez, İK, operatör vb.). **Personel listesi** ise hem sahada çalışan işçi/kalfa/usta hem de **mühendis, operatör ve proje müdürü** gibi tüm çalışanları kapsar; bunlar `personeller` tablosunda tutulur (sistemde giriş yapan kullanıcı olmak zorunda değillerdir). Görev alanı (`gorev`) ile personel tipi ayrımı yapılır.

| Tablo | Açıklama |
|-------|----------|
| `personeller` | Ad, soyad, TC, doğum tarihi, kan grubu, acil iletişim, **gorev** (Usta, Kalfa, Mühendis, Operatör, Proje Müdürü vb.), işe giriş, sigorta, IBAN, banka, günlük yevmiye / aylık maaş vb. |
| `personel_atama` | `personel_id`, `site_id`, `baslangic_tarihi`, `bitis_tarihi`. Geçmişe dönük “hangi tarihte hangi şantiyede” bilgisi. |

**Personel listesi kapsamı:** Sahadaki işçi, kalfa, usta ile birlikte **mühendis**, **operatör** ve **proje müdürü** de personel listesinde yer alır; hepsi aynı tabloda `gorev` (veya isteğe bağlı `personel_tipi`) ile ayrıştırılır.

**Örnek SQL (PostgreSQL):**

```sql
-- Personeller (tüm çalışanlar: işçi, kalfa, usta, mühendis, operatör, proje müdürü; login yok)
CREATE TABLE IF NOT EXISTS personeller (
  id SERIAL PRIMARY KEY,
  ad VARCHAR(100) NOT NULL,
  soyad VARCHAR(100) NOT NULL,
  tc_kimlik VARCHAR(20),
  dogum_tarihi DATE,
  kan_grubu VARCHAR(10),
  acil_iletisim VARCHAR(255),
  acil_telefon VARCHAR(50),
  gorev VARCHAR(100) NOT NULL,
  ise_giris_tarihi DATE,
  sigorta_durumu VARCHAR(50),
  iban VARCHAR(34),
  banka_adi VARCHAR(255),
  gunluk_yevmiye DECIMAL(12,2),
  aylik_maas DECIMAL(12,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Personelin şantiyelere atanması (tarih bazlı)
CREATE TABLE IF NOT EXISTS personel_atama (
  id SERIAL PRIMARY KEY,
  personel_id INTEGER NOT NULL REFERENCES personeller(id) ON DELETE CASCADE,
  site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  baslangic_tarihi DATE NOT NULL,
  bitis_tarihi DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(personel_id, site_id, baslangic_tarihi)
);
```

**Görev (gorev) değerleri örneği:** Usta, Kalfa, İşçi, Mühendis, Operatör, Proje Müdürü, Şantiye Şefi, vb. (sabit liste veya serbest metin; uygulama tarafında dropdown önerilir).

### 2.2 Puantaj modülü

| Tablo | Açıklama |
|-------|----------|
| `puantaj` | `personel_id`, `site_id`, `tarih`, `carpan` (1 / 0.5 / 0), `durum_kod` (G/İ/R), `mesai_saat`, `notlar`, `durum` (taslak / onaylandi), `onaylayan_id`, `onay_tarihi`. |

**Örnek SQL:**

```sql
CREATE TABLE IF NOT EXISTS puantaj (
  id SERIAL PRIMARY KEY,
  personel_id INTEGER NOT NULL REFERENCES personeller(id) ON DELETE CASCADE,
  site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  tarih DATE NOT NULL,
  carpan DECIMAL(3,2) DEFAULT 1.0,
  durum_kod VARCHAR(5) DEFAULT 'G',
  mesai_saat DECIMAL(4,2) DEFAULT 0,
  notlar TEXT,
  durum VARCHAR(20) DEFAULT 'taslak',
  olusturan_id INTEGER REFERENCES users(id),
  onaylayan_id INTEGER REFERENCES users(id),
  onay_tarihi TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(personel_id, site_id, tarih)
);
```

- **Puantaj kilitleme:** `durum = 'onaylandi'` ve `onay_tarihi` dolu ise kayıt değiştirilemez (UI ve API’de kontrol).

### 2.3 Finans modülü

| Tablo | Açıklama |
|-------|----------|
| `harcama_kategorileri` | Kod, ad (Sarf Malzeme, Yakıt, Yemek, Taşeron, Maaş vb.). Merkez ile ortak dil. |
| `islemler` | Harcama/fatura girişi: `site_id`, `kategori_id`, `tutar`, `islem_tarihi`, `odeme_kaynagi`, `aciklama`, `evrak_yolu`, `olusturan_id`. |

**Örnek SQL:**

```sql
CREATE TABLE IF NOT EXISTS harcama_kategorileri (
  id SERIAL PRIMARY KEY,
  kod VARCHAR(50) UNIQUE NOT NULL,
  ad VARCHAR(255) NOT NULL,
  aciklama TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS islemler (
  id SERIAL PRIMARY KEY,
  site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  kategori_id INTEGER NOT NULL REFERENCES harcama_kategorileri(id),
  tutar DECIMAL(12,2) NOT NULL,
  islem_tarihi DATE NOT NULL,
  odeme_kaynagi VARCHAR(30) NOT NULL,
  aciklama TEXT,
  evrak_yolu VARCHAR(500),
  olusturan_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

- `odeme_kaynagi`: `'Santiye_Kasa'` | `'Merkez_Banka'`.
- `evrak_yolu`: sunucuda dosya yolu veya storage URL; isteğe bağlı base64 için ayrı kolon da eklenebilir.

### 2.4 Özlük belgeleri

| Tablo | Açıklama |
|-------|----------|
| `personel_belgeleri` | `personel_id`, `belge_tipi`, `dosya_yolu`, `gecerlilik_tarihi`, `yukleme_tarihi`. |

**Örnek SQL:**

```sql
CREATE TABLE IF NOT EXISTS personel_belge_tipleri (
  id SERIAL PRIMARY KEY,
  kod VARCHAR(50) UNIQUE NOT NULL,
  ad VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS personel_belgeleri (
  id SERIAL PRIMARY KEY,
  personel_id INTEGER NOT NULL REFERENCES personeller(id) ON DELETE CASCADE,
  belge_tipi VARCHAR(50) NOT NULL,
  dosya_yolu VARCHAR(500) NOT NULL,
  gecerlilik_tarihi DATE,
  yukleme_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

- Belgeler: Kimlik, İSG Eğitimi, Mesleki Yeterlilik, Sağlık Raporu, Adli Sicil vb. `personel_belge_tipleri` ile yönetilebilir.
- **Hatırlatıcı:** Dashboard’da `gecerlilik_tarihi <= bugun + 15` olan kayıtlar uyarı olarak gösterilir.

### 2.5 Avans / kesinti (isteğe bağlı)

```sql
CREATE TABLE IF NOT EXISTS personel_avans_kesinti (
  id SERIAL PRIMARY KEY,
  personel_id INTEGER NOT NULL REFERENCES personeller(id) ON DELETE CASCADE,
  site_id INTEGER REFERENCES sites(id),
  donem_ay DATE NOT NULL,
  tutar DECIMAL(12,2) NOT NULL,
  tur VARCHAR(20) NOT NULL,
  aciklama TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

- `tur`: `'avans'` | `'kesinti'`.

### 2.6 Audit log (isteğe bağlı)

Finans ve puantaj için “kim, ne zaman, ne yaptı” kaydı:

```sql
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  tablo_adi VARCHAR(100) NOT NULL,
  kayit_id INTEGER,
  islem VARCHAR(20) NOT NULL,
  user_id INTEGER REFERENCES users(id),
  eski_deger JSONB,
  yeni_deger JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 3. Uygulama Adaptasyonu

### 3.1 Yetki ayrımı: Puantaj vs diğer idari birimler

İki farklı yetki kategorisi vardır:

1. **Puantaj girişi**  
   Sadece **personelin çalıştığı şantiyenin sorumlu kişisi** puantaj girişi yapabilir. Yani bir personel X şantiyesinde atanmışsa, o şantiye için yetkili kullanıcı (`users.site_id = X` veya şantiye bazında tanımlı sorumlu) sadece o şantiyedeki personelin puantajını girer. Merkez ofisteki İK/idari kullanıcı puantaj **girişi** yapmaz; sadece onay tarafında yer alabilir (puantaj onaylama ayrı yetkidir).

2. **Diğer idari birimler (personel bilgisi, finans, belgeler)**  
   **İK**, **idari** veya **idari / finans ve personel sorumlusu** (merkez rolü) bu alanlara giriş yapar. Yani personel kartı oluşturma/düzenleme, özlük bilgileri, harcama/finans girişi, belge yükleme vb. işlemler merkez idari/İK yetkisi ile yapılır. İstenirse şantiye sorumlusuna da kendi şantiyesi personeli için sadece görüntüleme verilebilir; giriş yetkisi merkezde kalır.

**Özet:**

| İşlem | Kim yapar? |
|-------|------------|
| Puantaj girişi (geldi/gelmedi, mesai) | Sadece o şantiyenin sorumlu kişisi (personelin çalıştığı şantiye) |
| Puantaj onaylama (kilitleme) | Merkez (admin / manager veya idari sorumlu) |
| Personel bilgisi / özlük / atama CRUD | İK veya idari veya idari/finans ve personel sorumlusu (merkez) |
| Harcama / finans girişi, belgeler | İK veya idari veya idari/finans ve personel sorumlusu (merkez) |

Uygulamada “merkez idari” için mevcut **manager** rolü kullanılabilir veya yeni bir rol (örn. `idari`, `ik`) tanımlanabilir.

### 3.2 Rol ve yetki matrisi

| Özellik | admin | manager / idari / İK (merkez) | Şantiye sorumlusu (user/personel) |
|---------|-------|-------------------------------|-----------------------------------|
| Tüm şantiyeleri görme | ✓ | ✓ | Sadece atandığı site |
| Personel CRUD (bilgi, özlük, atama) | ✓ | ✓ | Hayır (sadece merkez girer) |
| Puantaj girişi | ✓ (tümü) | Hayır* | ✓ (sadece kendi şantiyesi) |
| Puantaj onaylama | ✓ | ✓ | Hayır |
| Harcama / finans girişi | ✓ | ✓ | Hayır (sadece merkez girer) |
| Harcama kategorileri yönetimi | ✓ | ✓ | Hayır |
| Belgeleri görme/yükleme | ✓ | ✓ | İsteğe bağlı (sadece görüntüleme kendi şantiyesi) |
| İdari dashboard (bütçe, iş gücü) | ✓ | ✓ | Sadece kendi şantiyesi özeti (okuma) |

\* Puantaj girişi yalnızca personelin çalıştığı şantiyenin sorumlusu tarafından yapılır; merkez (manager/İK) sadece onaylar. Admin tüm şantiyeler için puantaj girebilir (istisna).

- **Operator (sistem kullanıcısı):** İdari modüle erişim verilmez (sadece makine girişi).
- Mevcut `canViewAllSites`, `canAccessAdmin` gibi fonksiyonlara ek olarak `canEnterTimesheet(session, siteId)`, `canApproveTimesheet(role)`, `canManageIdariCentral(role)` eklenebilir.

### 3.3 URL ve sayfa yapısı

Önerilen yapı (layout altında alt sayfalar):

```
/idari                    → Dashboard (özet, uyarılar, kısa istatistikler)
/idari/personel           → Personel listesi + CRUD + atama geçmişi
/idari/puantaj           → Puantaj girişi (tarih, şantiye, toplu tablo)
/idari/puantaj-onay      → Merkez onay listesi (sadece onay yetkisi olanlar)
/idari/harcamalar        → Harcama kategorileri + işlem listesi + giriş formu
/idari/belgeler          → Personel belgeleri (liste, yükleme, geçerlilik uyarıları)
/idari/raporlar          → Bütçe takibi, iş gücü analizi, günlük durum (basit raporlar)
```

- Menü: `TopNav` veya `/idari` layout’unda “İdari” linki; rol kontrolü ile sadece admin/manager/user/personel görür, operator görmez.

### 3.4 Mevcut yapı ile entegrasyon

- **Şantiyeler:** Zaten `sites` tablosu var; `personel_atama`, `puantaj`, `islemler` hep `site_id` ile bağlanır.
- **Kullanıcılar:** `users` tablosu; `olusturan_id`, `onaylayan_id` gibi alanlar `users(id)` referans alır.
- **Raporlar:** `work_reports` ile idari modül ayrı kalır; ileride “Günlük Durum” raporu hem work_reports hem puantaj verisini kullanabilir.

---

## 4. Adım Adım Uygulama Planı (Step-by-Step)

### Faz 1: Veritabanı ve personel temeli

1. **DB şeması**
   - `lib/database.ts` içinde `initializeDatabase()` sonuna yukarıdaki tabloları (personeller, personel_atama, harcama_kategorileri, islemler, puantaj, personel_belge_tipleri, personel_belgeleri) ekle.
   - Migration mantığı: `CREATE TABLE IF NOT EXISTS` ve gerekirse `DO $$ ... ALTER TABLE ... END $$` ile kolon ekleme (mevcut projedeki gibi).

2. **Seed veriler**
   - `harcama_kategorileri`: Sarf Malzeme, Akaryakıt, Yemek, Taşeron, Maaş vb. birkaç satır.
   - `personel_belge_tipleri`: Kimlik, İSG Eğitimi, Sağlık Raporu, Mesleki Yeterlilik, Adli Sicil.

3. **API**
   - `GET/POST /api/idari/personel` (liste + oluştur).
   - `GET/PUT/DELETE /api/idari/personel/[id]`.
   - `GET/POST /api/idari/personel/[id]/atama` (personel_atama; şantiye + başlangıç/bitiş).

4. **UI**
   - `/idari` layout: menü (Dashboard, Personel, Puantaj, …) + rol kontrolü.
   - `/idari/personel`: personel listesi (mühendis, operatör, proje müdürü dahil tüm görevler), filtre (şantiye, görev), ekleme/düzenleme formu (temel + özlük alanları). **Personel bilgisi girişi merkez (İK/idari) yetkisi ile yapılır.**
   - Personel detayında atama geçmişi (hangi tarihte hangi şantiyede).

### Faz 2: Puantaj

1. **API**
   - `GET /api/idari/puantaj?siteId=&tarih=` → o şantiyede o tarihte atanmış personel + o günkü puantaj kayıtları.
   - `POST/PUT /api/idari/puantaj` (toplu güncelleme; durum = taslak). **Sadece o şantiyenin sorumlu kişisi (session.site_id = siteId veya admin) girebilir.**
   - `POST /api/idari/puantaj/onay` (seçilen tarih aralığı / şantiye için durum = onaylandi, onaylayan_id set).

2. **Yetki**
   - Puantaj **girişi:** Sadece personelin çalıştığı şantiyenin sorumlu kullanıcısı (ve admin). Merkez (manager/İK) puantaj girişi yapmaz.
   - Puantaj **onayı:** Sadece admin veya manager (idari/finans sorumlusu).

3. **UI**
   - `/idari/puantaj`: şantiye + tarih seçimi, tablo (personel adı, durum dropdown: Tam/Yarım/Gelmedi/İ/R, mesai saati, not). “Tümünü Geldi yap”, “Kaydet (Taslak)”.
   - `/idari/puantaj-onay`: taslak puantaj listesi, “Onayla” ile kilitleme.

### Faz 3: Finans (harcama kategorileri + işlemler)

1. **API**
   - `GET/POST /api/idari/harcama-kategorileri` (admin/manager).
   - `GET /api/idari/islemler?siteId=&baslangic=&bitis=` (filtreli liste).
   - `POST /api/idari/islemler` (tarih, kategori, tutar, ödeme kaynağı, açıklama, dosya).

2. **Dosya**
   - Fiş/fatura: `evrak_yolu` için `/api/upload` veya base64’ü JSON’da gönderip sunucuda dosya yazma; boyut sınırı (örn. 5MB) ve dosya adı: `personelID_kategori_tarih.ext`.

3. **UI**
   - `/idari/harcamalar`: kategori listesi (sadece yetkili roller), işlem listesi (tablo), “Yeni harcama” formu (tarih, kategori dropdown, tutar, Şantiye Kasası/Merkez, açıklama, dosya yükleme).

### Faz 4: Özlük belgeleri ve hatırlatıcı

1. **API**
   - `GET/POST /api/idari/personel/[id]/belgeler` (liste + yükleme).
   - `GET /api/idari/uyarilar` (geçerlilik_tarihi yaklaşan / geçmiş belgeler; dashboard için).

2. **Dosya**
   - Yükleme: boyut limiti, isim formatı `personelID_belgeTuru_tarih.ext`.

3. **UI**
   - `/idari/belgeler`: personel seçimi, belge listesi (tip, geçerlilik tarihi, indir/görüntüle).
   - `/idari` dashboard: “Süresi dolan / yaklaşan belgeler” kutusu (kırmızı ikon + liste).

### Faz 5: Dashboard ve raporlar

1. **Bütçe takibi (basit)**
   - Şantiye bazında: hedef bütçe (sites’a kolon veya ayrı tablo) vs. `islemler` toplamı. API: `GET /api/idari/raporlar/butce?siteId=`.

2. **İş gücü analizi**
   - Şantiye + tarih aralığı: puantaj toplamı (adam/gün veya saat). API: `GET /api/idari/raporlar/is-gucu?siteId=&baslangic=&bitis=`.

3. **Günlük durum**
   - Seçilen tarih için: work_reports özeti (varsa) + o günkü personel sayısı (puantaj’dan) + kısa not. İleride genişletilebilir.

4. **UI**
   - `/idari/raporlar`: bu üç rapor için filtre (şantiye, tarih) ve basit tablo/grafik.
   - `/idari` ana sayfa: yukarıdaki uyarılar + kısa özet kartları (bu ay harcama, bu hafta puantaj durumu vb.).

---

## 5. Teknik Notlar

- **RBAC:** Her idari API’de session + rol + (user/personel ise) `site_id` kısıtı uygulanmalı.
- **Log:** Finansal veya puantaj silme/güncelleme yapılırken `audit_log`’a yazılabilir (Faz 3–4 sonrası).
- **Dosya depolama:** Başlangıçta sunucu dosya sistemi (`public/uploads` veya dış bir dizin); ileride S3/benzeri eklenebilir.
- **Performans:** Personel/puantaj listeleri büyürse sayfalama (limit/offset veya cursor) ekleyin.

Bu belge, geliştirme sırasında referans alınarak her faz için ayrı task listesi (ör. GitHub issue) çıkarılabilir; önce Faz 1 ile personel ve atama canlıya alınır, sonra puantaj ve finans modülleri eklenir.
