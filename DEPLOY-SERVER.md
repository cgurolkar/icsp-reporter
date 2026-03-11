# Hetzner Sunucuda Kurulum

Sunucuya SSH ile bağlandıktan sonra aşağıdaki komutları sırayla çalıştır.

## 0. Docker kurulumu (kurulu değilse)

Sunucuda Docker yoksa önce bunu kur. **Ubuntu / Debian** için:

```bash
# Eski sürüm varsa kaldır
sudo apt remove -y docker docker-engine docker.io containerd runc 2>/dev/null

# Gerekli paketler
sudo apt update
sudo apt install -y ca-certificates curl gnupg

# Docker’ın resmi GPG anahtarı ve repo
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Debian kullanıyorsan yukarıdaki echo yerine:
# echo "deb [arch=... signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Mevcut kullanıcıyı docker grubuna ekle (sudo olmadan docker çalışsın)
sudo usermod -aG docker $USER
```

**Önemli:** `usermod` sonrası oturumu kapatıp tekrar SSH ile bağlan (veya `newgrp docker` yaz). Yoksa `docker` komutu “permission denied” verebilir.

Kurulumu kontrol et:

```bash
docker --version
docker compose version
```

## 1. Klasör oluştur ve repoyu çek

```bash
# İstediğin dizine git (örn. ev dizini veya /var/www)
cd ~

# icsp-reporter klasörünü oluştur
mkdir -p icsp-reporter
cd icsp-reporter

# GitHub'dan projeyi klonla (branch: main+)
git clone -b main+ git@github.com:cgurolkar/icsp-reporter.git .

# Veya HTTPS ile:
# git clone -b main+ https://github.com/cgurolkar/icsp-reporter.git .
```

Not: `git clone ... .` sonundaki nokta, mevcut klasöre (icsp-reporter) dosyaları indirir; ayrı bir alt klasör oluşturmaz.

## 2. Ortam dosyasını hazırla

```bash
cp env.example .env
nano .env   # veya vi .env
```

`.env` içinde en azından şunları düzenle:

- `POSTGRES_PASSWORD` – güçlü bir şifre belirle
- İsteğe bağlı: e-posta için `ENABLE_EMAIL_SEND`, `SMTP_*` değerleri

Kaydet ve çık (nano: Ctrl+O, Enter, Ctrl+X).

## 3. Docker ile çalıştır

```bash
docker compose up -d --build
```

İlk build birkaç dakika sürebilir. Bittikten sonra uygulama **http://SUNUCU_IP:3001** adresinde açılır.

## 4. Yararlı komutlar

```bash
# Logları izle
docker compose logs -f

# Durdur
docker compose down

# Yeniden başlat (kod çekildikten sonra)
git pull
docker compose up -d --build
```

## Nginx ile alan adına yönlendirme

### report.icspiling.com → http://46.225.110.180:3001

Tarayıcıda **report.icspiling.com** yazıldığında sunucudaki 3001 portundaki uygulamanın açılması için:

**1. Sunucuda Nginx site dosyası oluştur**

```bash
sudo nano /etc/nginx/sites-available/report-icspiling
```

**2. Aşağıdaki bloğu yapıştır, kaydet (nano: Ctrl+O, Enter, Ctrl+X)**

```nginx
server {
    listen 80;
    server_name report.icspiling.com;
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**3. Site’ı etkinleştir**

```bash
sudo ln -s /etc/nginx/sites-available/report-icspiling /etc/nginx/sites-enabled/
```

**4. Nginx’i test et ve yeniden yükle**

```bash
sudo nginx -t
sudo systemctl reload nginx
```

**5. DNS:** `report.icspiling.com` için A kaydı sunucu IP’sine işaret etmeli: **46.225.110.180**

**6. HTTPS (isteğe bağlı):** `sudo certbot --nginx -d report.icspiling.com`

---

### İki uygulama (genel)

Sunucuda iki ayrı klasörde iki uygulama varsa, her biri için ayrı bir **server** bloğu ve (isteğe bağlı) ayrı alan adı kullanılır.

### 1. Bu uygulama (work-report / icsp-reporter) hangi portta?

- Docker ile çalışıyorsa varsayılan **3001** (docker-compose’ta `ports: "3001:3000"` gibi).
- İkinci uygulama farklı bir portta olmalı (örn. 3002).

### 2. Nginx site dosyası oluştur

Mevcut Nginx yapısına göre iki yol var:

**A) `sites-available` / `sites-enabled` kullanıyorsan (Ubuntu/Debian tarzı):**

```bash
sudo nano /etc/nginx/sites-available/rapor-siteniz
```

**B) `conf.d` kullanıyorsan:**

```bash
sudo nano /etc/nginx/conf.d/rapor-siteniz.conf
```

İçeriği (alan adını ve portu kendinize göre değiştirin):

```nginx
# Bu uygulama (work-report / icsp-reporter) – örn. rapor.sirket.com
server {
    listen 80;
    server_name rapor.sirket.com;   # Kendi alan adınız
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

İkinci uygulama için ayrı bir dosya açıp farklı `server_name` ve `proxy_pass` portu (örn. 3002) kullanın.

### 3. Site’ı etkinleştir (sadece sites-available kullandıysan)

```bash
sudo ln -s /etc/nginx/sites-available/rapor-siteniz /etc/nginx/sites-enabled/
```

### 4. Nginx’i test et ve yeniden yükle

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 5. DNS

Alan adının A kaydını sunucu IP’nize yönlendirin (örn. `rapor.sirket.com` → `46.225.110.180`).

### 6. SSL (HTTPS)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d rapor.sirket.com
```

Certbot, Nginx yapılandırmasına otomatik SSL ekler ve yenilemeyi ayarlar.

---

**Özet:** İki uygulama = iki ayrı Nginx server bloğu (iki dosya veya aynı dosyada iki `server { ... }`). Her biri kendi `server_name` ve `proxy_pass` portuna sahip olmalı.
