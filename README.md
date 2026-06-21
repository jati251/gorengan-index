# Gorengan Index 🇮🇩🥟

Gorengan Index adalah platform terminal *trading* fiktif namun berbasis makroekonomi nyata yang melacak daya beli (*purchasing power parity*) masyarakat Indonesia melalui metrik komoditas paling merakyat: **Gorengan** (Bakwan, Tahu Isi, Tempe Mendoan).

## Fitur Utama 🚀
- **Terminal Candlestick Real-Time**: Visualisasi data historis dan pergerakan harga gorengan menggunakan antarmuka layaknya terminal bursa efek sungguhan.
- **Engine Makroekonomi**: Mesin indeks secara algoritmik menghitung harga gorengan berdasarkan *real-time* Kurs USD/IDR, indeks harga gandum global, indeks CPO (Minyak Kelapa Sawit), serta kondisi iklim/cuaca di Indonesia.
- **Regional Spot Prices**: Pemetaan harga secara dinamis ke-38 Provinsi Indonesia dengan standar deviasi berdasarkan Upah Minimum Provinsi (UMP) 2024-2026.
- **Gorengan Net Worth Calculator**: Hitung kekayaan riil dan kasta sosial Anda berdasarkan jumlah gorengan yang bisa Anda beli setiap bulannya.
- **Crowdsource Market Reporter**: Sistem desentralisasi bagi warga untuk melaporkan harga gorengan lokal dan mendeteksi adanya *Shrinkflation* (ukuran gorengan mengecil).

## Cara Menjalankan Secara Lokal 💻

### 1. Prasyarat
- Node.js (versi 18+)
- PostgreSQL Database

### 2. Instalasi
```bash
git clone https://github.com/jati251/gorengan-index.git
cd gorengan-index
npm install
```

### 3. Konfigurasi Database (.env)
Buat file `.env` di *root* direktori dan masukkan konfigurasi PostgreSQL Anda:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/gorengan_index?schema=public"
```

### 4. Migrasi & Injeksi Data Sejarah
Untuk menjalankan aplikasi dengan akurasi grafik historis (sejak 1980 hingga era Krisis Moneter 1998, dan Krisis Minyak Goreng 2022), Anda harus melakukan sinkronisasi *database* dan menyuntikkan data *seed*:
```bash
npx prisma generate
npx prisma db push
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
```

### 5. Jalankan Server Development
```bash
npm run dev
```
Buka [http://localhost:3000](http://localhost:3000) di *browser* Anda untuk mengakses Terminal Gorengan.

## Infrastruktur (Deployment) 🌐
Aplikasi ini sudah dipaketkan dalam kontainer (Docker) dan didistribusikan menggunakan prinsip GitOps (ArgoCD) pada klaster Kubernetes.
- `ghcr.io/jati251/gorengan-index:latest`
- Kube Manifests: `/k8s/deployment.yaml`

---
*Di-build dengan Next.js 14, TailwindCSS, Lightweight Charts, dan Prisma ORM.*
