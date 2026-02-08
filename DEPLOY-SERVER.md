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

## Nginx ile 80/443’e alma (isteğe bağlı)

Başka siten yanında bu uygulamayı da domain ile vermek istersen Nginx’te örnek sunucu bloğu:

```nginx
server {
    listen 80;
    server_name rapor.example.com;
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

SSL için `certbot --nginx` kullanabilirsin.
