# 🚀 Panduan CI/CD: Push ke AWS ECR & Auto-Deploy ke VPS

Dokumentasi ini menjelaskan alur kerja otomatisasi **CI/CD (Continuous Integration & Continuous Deployment)** untuk layanan **WhatsApp Service** menggunakan **GitHub Actions**, **Amazon Elastic Container Registry (AWS ECR)**, dan server **VPS** (seperti Hostinger / AWS EC2 / DigitalOcean).

---

## 📌 1. Diagram Alur CI/CD

```text
[Developer / Tim]
       │
       ▼ (git push origin main)
[GitHub Repository: whatsapp-service]
       │
       ▼ (Trigger GitHub Actions Runner: ubuntu-latest)
  1. Checkout kode sumber
  2. Setup AWS Credentials & login ke AWS ECR
  3. Build Docker Image (multi-stage) dengan cache GitHub Actions (type=gha)
  4. Push Docker Image ke AWS ECR (tag: latest & commit-sha)
  5. Generate Temporary Auth Token ECR (aws ecr get-login-password)
  6. SSH Remote ke VPS Server
       │
       ▼ (Eksekusi otomatis di dalam VPS via SSH)
  7. docker login ke AWS ECR menggunakan temporary token
  8. docker pull image whatsapp-service terbaru
  9. docker compose up -d (memperbarui container tanpa menghapus sesi)
 10. Health check status koneksi & membersihkan image dangling
```

---

## 🔒 2. Daftar Secrets & Variables di GitHub Repository

Masuk ke **GitHub Repo** > **Settings** > **Secrets and variables** > **Actions**:

### A. Repository Secrets (Wajib)
| Nama Secret | Deskripsi | Contoh Nilai |
| :--- | :--- | :--- |
| `AWS_ACCESS_KEY_ID` | Access Key pengguna IAM AWS | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | Secret Access Key IAM AWS | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `VPS_HOST` | IP Publik atau Hostname VPS Anda | `103.123.45.67` |
| `VPS_USERNAME` | User SSH di VPS (memiliki akses docker) | `root` atau `ubuntu` |
| `VPS_SSH_KEY` | Private SSH Key (format PEM/OpenSSH) | `-----BEGIN OPENSSH PRIVATE KEY----- ...` |
| `VPS_PORT` *(Opsional)* | Port SSH server (default: `22`) | `22` |

### B. Repository Variables *(Opsional - sudah ada default di workflow)*
| Nama Variable | Default jika kosong | Keterangan |
| :--- | :--- | :--- |
| `AWS_REGION` | `ap-southeast-2` | Region AWS tempat ECR berada |
| `ECR_REPOSITORY` | `whatsapp-service` | Nama repositori ECR di AWS |
| `VPS_DEPLOY_PATH` | `/var/www/whatsapp-service` | Lokasi folder project di VPS |

---

## ☁️ 3. Persiapan di AWS ECR

1. Masuk ke **AWS Management Console** > **Amazon ECR**.
2. Pilih Region yang sama dengan konfigurasi (misal: `ap-southeast-2` Sydney atau `ap-southeast-1` Singapore).
3. Klik **Create repository**:
   - Visibility settings: **Private**
   - Repository name: **`whatsapp-service`**
   - Tag immutability: **Mutable**
   - Klik **Create repository**.
4. Pastikan User IAM (`AWS_ACCESS_KEY_ID`) memiliki policy:
   - `AmazonEC2ContainerRegistryPowerUser` (atau izin `ecr:GetAuthorizationToken`, `ecr:BatchCheckLayerAvailability`, `ecr:PutImage`, dll).

---

## 🖥️ 4. Persiapan di VPS Server

### 1. Instalasi Docker & Compose
Pastikan VPS sudah memiliki Docker Engine dan Docker Compose:
```bash
docker --version
docker compose version
```

### 2. Buat Direktori & File Konfigurasi `.env`
Login ke VPS Anda dan buat folder deployment:
```bash
mkdir -p /var/www/whatsapp-service/sessions /var/www/whatsapp-service/uploads
cd /var/www/whatsapp-service
nano .env
```

Isi file `.env` di VPS:
```env
PORT=3000
NODE_ENV=production
API_KEY=secret_api_key_whatsapp_tsi

# Session directory di container
SESSION_DIR=/app/sessions

# Redis dihubungkan via Docker network internal
REDIS_HOST=redis
REDIS_PORT=6379

# Webhook backend Anda
WEBHOOK_URL=https://api.tsi.id/api/whatsapp/webhook
WEBHOOK_SECRET=secret_webhook_key

# Anti-ban delay
MIN_MESSAGE_DELAY_MS=2000
MAX_MESSAGE_DELAY_MS=4000
ENABLE_TYPING_SIMULATION=true
```

---

## 🛡️ 5. Catatan Penting: Persistensi Sesi WhatsApp

Saat CI/CD melakukan update kode dan me-restart container, sesi login WhatsApp **TIDAK AKAN HILANG / TIDAK LOGOUT**. 

Hal ini karena folder `/app/sessions` di dalam container dimounting secara persisten ke folder `/var/www/whatsapp-service/sessions` di VPS host:
```yaml
volumes:
  - ./sessions:/app/sessions
  - ./uploads:/app/uploads
```
Kredensial Baileys tetap tersimpan aman di host VPS selama Anda tidak menghapus folder `sessions` tersebut.

---

## 🌐 6. Konfigurasi Nginx Reverse Proxy (Domain & SSL)

Jika Anda ingin membuka Dashboard dan REST API melalui domain publik (misal: `wa.telehealthindonesia.com`), pasang Nginx di VPS:

```nginx
server {
    server_name wa.telehealthindonesia.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 90;
    }
}
```
Aktifkan SSL dengan Certbot:
```bash
sudo certbot --nginx -d wa.telehealthindonesia.com
```

---

## 🧪 7. Menjalankan CI/CD

Cukup lakukan push ke branch `main`:
```bash
git add .
git commit -m "feat: setup CI/CD pipeline AWS ECR and VPS deployment"
git push origin main
```
Atau jalankan secara manual melalui menu tab **Actions** di GitHub repository > **Deploy WhatsApp Service to AWS ECR & VPS** > **Run workflow**.
