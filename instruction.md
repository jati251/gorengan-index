# 📊 The Gorengan Index (Gorengan Bloomberg Terminal)

An extreme local-wisdom financial technology (FinTech) parody built to measure the true purchasing power of Jakartans using the **Standardisasi Internasional Gorengan (SIG)**.

Built with Next.js 14/15, Tailwind CSS, and Chart.js. **Zero Database Required.**

---

## 📑 1. Background & Philosophical Thesis

### The Problem

Indikator makroekonomi tradisional seperti IHSG, Inflasi BPS, atau Nilai Tukar Rupiah (IDR) terhadap USD sering kali terlalu abstrak untuk dipahami oleh masyarakat akar rumput. Masyarakat tidak merasakan dampak langsung ketika Rupiah melemah dari Rp16.200 ke Rp16.500, tetapi mereka langsung merasakan krisis ketika **Bakwan seharga Rp3.000 ukurannya menyusut menjadi seukuran korek api**, atau ketika beli tahu isi tidak lagi diberikan cabai rawit secara gratis.

### The Solution

**The Gorengan Index** berfungsi sebagai _Single Source of Truth_ untuk mengukur daya beli nyata (Purchasing Power) masyarakat Jakarta. Aplikasi ini mengawinkan data riil dari API Publik (Cuaca & Kurs Valas) dengan data parodi untuk menghasilkan metrik finansial absurd secara _real-time_ tanpa memerlukan _database_ fisik.

---

## 🏗️ 2. Architecture & Data Flow (Zero-DB Approach)

Sistem ini didesain menggunakan **Next.js (App Router)** yang berjalan secara _hybrid_. Data makro akan di-_cache_ menggunakan mekanisme **Incremental Static Regeneration (ISR)** agar server tidak terkena _rate limit_ dari API publik, sekaligus bertindak sebagai tempat penyimpanan data sementara (_In-Memory Cache_).

+-----------------------------------------------------------------------+
| DATA SOURCES (REAL PUBLIC API) |
| 1. Frankfurter API (Kurs USD) |
+-----------------------------------------------------------------------+
|
v (fetch with ISR / revalidate: 3600)
+-----------------------------------------------------------------------+
| NEXT.JS CORE ENGINE (Server Side) |
| - Route Handlers (/api/gorengan-engine) |
| - Data Normalization & Pseudo-Random Volatility Layer |
+-----------------------------------------------------------------------+
|
v (JSON Response Data)
+-----------------------------------------------------------------------+
| FRONTEND DASHBOARD (Client Side) |
| - Tailwind CSS (Bloomberg Dark Mode Aesthetic) |
| - Chart.js (Interactive Historic & Volatility Analytics) |
| - State Management (Regional Switcher & PPP Calculator) |
+-----------------------------------------------------------------------+

### Real Data to Parody Logic Mapping:

- **Kurs USD/IDR:** Menentukan _Gorengan Purchasing Power Parity_. Jika USD menguat, harga impor gandum dianggap naik $\rightarrow$ Bakwan SCBD mengalami inflasi.
- **Cuaca Jakarta:** Menentukan _Demand Shock_. Jika status `Rain` (Hujan), _Demand_ naik $300\%$, grafik tren akan dipaksa melonjak (_Bullish_). Jika `Clear/Hot`, sentimen pasar menjadi _Bearish_.
- **Time-Based Seeded Randomization:** Menggunakan timestamp menit saat ini (`new Date().getMinutes()`) untuk mengacak fluktuasi harga harian agar grafik _live_ bergerak terus tanpa perlu DB.

---

## 💾 3. Core Data Structure & Formulas

### File Base Mocking (`src/data/gorenganData.ts`)

```typescript
export interface RegionalIndex {
  region: string;
  bakwanPrice: number;
  tahuPrice: number;
  tempePrice: number;
  chiliRatio: number;      // Jumlah cabe rawit gratis per 1 gorengan
  sizePercentage: number;  // 100% = ukuran normal, <100% = menyusut
  inflationRate: number;
  sentiment: 'BULLISH' | 'BEARISH' | 'STAGNANT';
}

export const historicalGorenganIndex = [
  { year: "2021", averagePrice: 1000, size: 100, note: "Era keemasan gorengan seribu perak" },
  { year: "2022", averagePrice: 1500, size: 95, note: "Minyak goreng langka shock" },
  { year: "2023", averagePrice: 2000, size: 90, note: "Penyesuaian pasca-pandemi" },
  { year: "2024", averagePrice: 2500, size: 85, note: "Cabai rawit meroket" },
  { year: "2025", averagePrice: 3000, size: 80, note: "Gorengan avonturir SCBD mulai muncul" },
  { year: "2026", averagePrice: 3500, size: 75, note: "Krisis Ukuran Bakwan Nasional (Juni 2026)" }
];

Mathematical Formulas1. Gorengan Shrinkflation IndexMenghitung kerugian volume kunyahan akibat ukuran gorengan yang mengecil (dipengaruhi oleh kurs USD makro).$$\text{Shrinkage } (\%) = \max\left(50, \, 100 - \left(\frac{\text{Kurs IDR} - 15000}{100}\right)\right)$$2. Purchasing Power Parity (PPP) Gorengan$$\text{Gorengan Net Worth} = \frac{\text{Gaji Bulanan}}{\text{Harga Regional Bakwan}}$$🧱 4. Component Blueprints1. <HeaderTicker/> (The Panic Marquee)UI Spec: Background bg-black, teks text-yellow-400, font font-mono. Menggunakan animasi marquee bawaan Tailwind.Content: "LIVE: Sentimen pasar Bakwan Jaksel menguat akibat krisis minyak goreng // Warga Rawamangun laporkan tahu isi sekarang dominan isi angin daripada tauge..."2. <TerminalChart/> (The Bloomberg Chart)Tech Spec: react-chartjs-2 (Line Chart). Gridlines samar, garis tren utama berwarna hijau stabilo (#00ff66) atau merah cerah (#ff3333).Data: Menggabungkan historicalGorenganIndex dengan data fluktuasi menit berjalan dari API.3. <GorenganCalculator/> (The Reality Check)UI Spec: Form input interaktif dengan dropdown wilayah Jakarta.Output Teks Dinamis:$> 3.000\text{ Bakwan}$: "Gorengan Whale / Konglomerat Tepung"$1.000 - 3.000\text{ Bakwan}$: "Gorengan Middle Class / Aman dari Maag"$< 1.000\text{ Bakwan}$: "Rentan Miskin Karbohidrat / Segera Cari Promosi"📝 5. Step-by-Step Development InstructionsSetup Project:

```
