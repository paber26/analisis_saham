# Deploy — saham.kuydinas.id

Aplikasi ini **Nuxt 4 SSR** (butuh Node server Nitro yang jalan), bukan situs
statis, karena punya server API (`/api/*`) yang mem-proxy Yahoo Finance.

## Arsitektur produksi

```
Cloudflare (SSL edge, proxy)
    │  HTTPS :443
    ▼
nginx (origin 103.23.199.164)  ──reverse proxy──►  Node/Nitro :3200  (PM2: "saham")
  vhost: /www/server/panel/vhost/nginx/saham.kuydinas.id.conf
  cert : /www/server/panel/vhost/cert/saham.kuydinas.id/
  app  : /www/wwwroot/saham.kuydinas.id/.output
```

- Server: Ubuntu 24.04 + aaPanel, Node 18, nginx 1.24, PM2.
- Domain di belakang **Cloudflare** → origin harus melayani **port 443 (SSL)**,
  bukan cuma 80. (Kalau hanya 80, request 443 jatuh ke vhost default = halaman Laravel.)

## Update rutin (sekali perintah)

```bash
cp .deploy.env.example .deploy.env   # sekali saja, lalu isi nilainya
./deploy.sh
```

`deploy.sh` akan: `npm run build` → `rsync .output` ke server → `pm2 restart saham`.
Rahasia (host/user/password) dibaca dari **`.deploy.env` yang di-gitignore**.

> Keamanan: `.deploy.env` berisi password dan TIDAK ikut di-commit. Sangat
> disarankan **ganti password server** (sudah pernah tampil di chat) dan beralih
> ke **SSH key** lalu kosongkan `DEPLOY_PASSWORD` (script otomatis pakai key).

## Notifikasi email harian (rekomendasi)

Infrastruktur SMTP + endpoint. Isi kredensial di `.deploy.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=akun.gmail@gmail.com
SMTP_PASS=<Gmail App Password>   # Google Account → Security → 2FA → App passwords
MAIL_TO=bernaldo.stis@gmail.com
NOTIFY_TOKEN=<random>            # kosong = pakai SYNC_TOKEN
```

Lalu `./deploy.sh` (env ikut ter-inject ke PM2). Endpoint:

- `GET /api/notify/daily?token=<NOTIFY_TOKEN>` → susun digest dari snapshot screener & kirim email.
- `?dry=1` → pratinjau (JSON + HTML) tanpa mengirim. `?to=addr` override penerima. `?limit=N` jumlah pilihan.

Jadwalkan via **crontab server** (jalankan SETELAH `/api/sync` menghasilkan snapshot harian). Contoh (WIB, server UTC → +7):

```cron
# sync screener 17:30 WIB (10:30 UTC), lalu email 17:45 WIB (10:45 UTC), hari kerja
30 10 * * 1-5 curl -s "http://127.0.0.1:3200/api/sync?token=SYNC_TOKEN" >/dev/null
45 10 * * 1-5 curl -s "http://127.0.0.1:3200/api/notify/daily?token=NOTIFY_TOKEN" >/dev/null
```

## Setup awal server (sudah dilakukan — untuk referensi/recovery)

```bash
# 1. Folder app milik user deploy
sudo chown -R kuydinas:kuydinas /www/wwwroot/saham.kuydinas.id

# 2. PM2 global + auto-boot
sudo npm install -g pm2
cd /www/wwwroot/saham.kuydinas.id
PORT=3200 HOST=127.0.0.1 pm2 start .output/server/index.mjs --name saham --update-env
pm2 save
sudo env PATH=$PATH pm2 startup systemd -u kuydinas --hp /home/kuydinas

# 3. nginx vhost (reverse proxy + SSL) — file:
#    /www/server/panel/vhost/nginx/saham.kuydinas.id.conf
sudo nginx -t && sudo nginx -s reload
```

Isi vhost nginx (port 80 + 443 SSL, proxy ke :3200):

```nginx
server {
    listen 80;
    listen 443 ssl http2;
    server_name saham.kuydinas.id;

    ssl_certificate        /www/server/panel/vhost/cert/saham.kuydinas.id/fullchain.pem;
    ssl_certificate_key    /www/server/panel/vhost/cert/saham.kuydinas.id/privkey.pem;
    ssl_protocols TLSv1.1 TLSv1.2 TLSv1.3;
    error_page 497 https://$host$request_uri;

    location / {
        proxy_pass http://127.0.0.1:3200;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 60s;
    }

    access_log /www/wwwlogs/saham.kuydinas.id.log;
    error_log  /www/wwwlogs/saham.kuydinas.id.error.log;
}
```

## Troubleshooting

| Gejala | Penyebab / solusi |
|---|---|
| Muncul halaman **Laravel** | vhost saham belum `listen 443 ssl`. Tambahkan blok 443 + reload nginx. |
| **502 Bad Gateway** | Proses Node mati. `pm2 restart saham`, cek `pm2 logs saham`. |
| Perubahan tidak muncul | Cloudflare cache. Purge cache atau tunggu; API bertanda `DYNAMIC` tidak di-cache. |
| Cek status | `pm2 list`, `pm2 logs saham --lines 50` |

## Perintah cepat di server

```bash
pm2 list                 # status
pm2 logs saham           # log realtime
pm2 restart saham        # restart manual
sudo nginx -t && sudo nginx -s reload   # setelah ubah vhost
```
