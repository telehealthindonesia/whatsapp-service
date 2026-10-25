# TSI WhatsApp Gateway Service

Microservice WhatsApp berbasis **`@whiskeysockets/baileys`** dengan antrean pesan **BullMQ + Redis**, proteksi anti-ban, auto-reconnect, webhook inbound, dan dashboard visual modern.

---

## 🚀 Fitur Utama

- **Koneksi Stabil**: Menggunakan `@whiskeysockets/baileys` versi terbaru dengan `useMultiFileAuthState`.
- **Dua Metode Otentikasi**:
  - Scan **QR Code** (via web dashboard atau REST API base64/image).
  - **Pairing Code** (kode 8-digit tanpa perlu kamera scanner).
- **Antrean Pesan & Anti-Ban**:
  - Dikelola oleh **BullMQ & Redis** dengan konkurensi teratur.
  - Simulasi jeda kehadiran (*typing presence* composing).
  - Jeda acak (*delay jitter*) antar pesan untuk meniru kebiasaan manusia.
- **Dukungan Format Pesan Lengkap**:
  - Teks
  - Media: Gambar, Dokumen (PDF/Docx), Video, Audio
  - Lokasi (Latitude & Longitude)
- **Webhook Notifikasi**:
  - Meneruskan pesan masuk (*inbound*) dan status pengiriman pesan (*ack status*) langsung ke sistem backend Anda (misal Laravel TSI).
- **Live Dashboard**:
  - Antarmuka visual glassmorphic modern di `http://localhost:3000` untuk memantau status, scan QR, memonitor antrean, dan menguji pengiriman pesan.

---

## 🛠️ Menjalankan Layanan

### 1. Prasyarat
- Node.js (v18+ atau v20+)
- Redis (Sudah disediakan file `docker-compose.yml`)

### 2. Menjalankan Redis
Jika belum memiliki Redis lokal, jalankan via Docker:
```bash
docker compose up -d redis
```

### 3. Konfigurasi `.env`
Sesuaikan file `.env` jika diperlukan:
```env
PORT=3000
API_KEY=secret_api_key_whatsapp_tsi
SESSION_DIR=./sessions

REDIS_HOST=127.0.0.1
REDIS_PORT=6379

WEBHOOK_URL=http://localhost:8000/api/whatsapp/webhook
WEBHOOK_SECRET=secret_webhook_key
```

### 4. Menjalankan Server
Mode Development (Live Reload):
```bash
npm run dev
```

Mode Produksi:
```bash
npm run build
npm start
```

Buka browser Anda di `http://localhost:3000` untuk mengakses Dashboard.

---

## 📡 Dokumentasi Endpoint REST API

Semua endpoint pengiriman pesan dan administrasi dilindungi oleh header:
`x-api-key: secret_api_key_whatsapp_tsi` atau `Authorization: Bearer secret_api_key_whatsapp_tsi`.

### 1. Status Sesi
- **Endpoint**: `GET /api/session/status`
- **Response**:
```json
{
  "success": true,
  "data": {
    "status": "connected",
    "isReady": true,
    "user": {
      "id": "628123456789:0@s.whatsapp.net",
      "name": "Admin TSI"
    },
    "lastConnectedAt": "2026-10-25T09:30:00.000Z",
    "hasQrCode": false
  }
}
```

### 2. Mengambil QR Code
- **Endpoint**: `GET /api/session/qr` atau `GET /api/session/qr?format=image`

### 3. Meminta Pairing Code (Tanpa Scan QR)
- **Endpoint**: `POST /api/session/pairing-code`
- **Body**:
```json
{
  "phoneNumber": "6281234567890"
}
```

### 4. Kirim Pesan Teks
- **Endpoint**: `POST /api/messages/send-text`
- **Body**:
```json
{
  "to": "081234567890",
  "message": "Halo dari TSI WhatsApp Gateway!",
  "delayMs": 2500
}
```

### 5. Kirim Media (Gambar / Dokumen / PDF)
- **Endpoint**: `POST /api/messages/send-media` (JSON dengan URL atau `multipart/form-data` dengan file upload):
```json
{
  "to": "081234567890",
  "type": "image",
  "mediaUrl": "https://example.com/invoice.jpg",
  "caption": "Berikut invoice transaksi Anda"
}
```

### 6. Cek Status Antrean Pesan (BullMQ)
- **Endpoint**: `GET /api/messages/queue-status`
- **Response**:
```json
{
  "success": true,
  "data": {
    "waiting": 0,
    "active": 0,
    "completed": 15,
    "failed": 0
  }
}
```

---

## 🔔 Format Payload Webhook

Ketika WhatsApp menerima pesan dari pengguna lain, service akan mengirimkan HTTP POST ke `WEBHOOK_URL` Anda:
```json
{
  "event": "message.received",
  "timestamp": 1729848600000,
  "data": {
    "id": "3EB0ABC123456789",
    "from": "6281234567890@s.whatsapp.net",
    "pushName": "Budi Santoso",
    "isGroup": false,
    "type": "conversation",
    "text": "Halo, saya ingin menanyakan jadwal layanan",
    "raw": { ... }
  }
}
```
