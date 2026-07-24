# Extension: Sinkron Token Stockbit → saham.kuydinas.id

Menjaga data **bandar** selalu segar. Saat kamu browsing Stockbit, extension ini
menangkap token akses Stockbit (`Authorization: Bearer …`) dan mengirimkannya ke
server kamu setiap kali berubah — jadi tidak perlu lagi refresh `STOCKBIT_TOKEN`
manual tiap ~24 jam.

## Cara kerja

```
Kamu buka stockbit.com (login)
        │  request ke exodus.stockbit.com membawa Authorization: Bearer <jwt>
        ▼
Extension (service worker)  ── token berubah? ──►  POST /api/stockbit-token
        │                                          header: x-push-secret
        ▼                                                   │
  simpan lastToken (dedupe)                                 ▼
                                     server simpan ke .data-store/stockbit-token.json
                                     → /api/bandar memakai token terbaru ini
```

Tidak ada rahasia di dalam kode extension. **Server URL** dan **push secret**
kamu isi lewat popup dan disimpan di `chrome.storage.local`.

## Install (Chrome/Edge, mode unpacked)

1. Buka `chrome://extensions`
2. Aktifkan **Developer mode** (kanan atas)
3. Klik **Load unpacked** → pilih folder `extension/` ini
4. Klik ikon extension → **popup**:
   - **Server URL**: `https://saham.kuydinas.id` (sudah terisi)
   - **Push secret**: nilai `STOCKBIT_PUSH_SECRET` (sama dengan yang di server)
   - Klik **Simpan**
5. Buka **stockbit.com** dan pastikan sudah login. Token akan otomatis terkirim;
   status "✓ Token terkirim ke server" muncul di popup.

## Verifikasi

- Popup menampilkan status pengiriman terakhir + waktunya.
- Di aplikasi, `GET /api/stockbit-token` (owner-only) menunjukkan
  `{ hasToken, source: "extension", updatedAt }`.
- Buka `saham.kuydinas.id/analisa/BBCA` → kartu Bandarmology terisi.

## Keamanan

- Extension hanya berjalan di `exodus.stockbit.com` (baca header) dan mengirim ke
  host `saham.kuydinas.id` (host_permissions terbatas).
- Endpoint push dijaga `x-push-secret`; token disimpan server-side (tidak pernah
  tampil di UI).
- Untuk pemakaian pribadi. Jangan sebarkan push secret.

## Kalau token tidak tertangkap

Jika status tak pernah "terkirim", kemungkinan Stockbit mengubah cara auth.
Kabari — fallback: membaca token dari `localStorage` Stockbit lewat content
script. Versi ini memakai jalur header `Authorization` yang paling andal.
