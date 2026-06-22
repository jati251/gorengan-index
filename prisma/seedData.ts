export interface ProvinceUMP {
  id: string;
  name: string;
  ump2026: number;
}

// Data UMP 2026 (Real data for 20 provinces, 6.5% projection for the rest based on 2024/2025 baseline)
export const indonesiaUMP: ProvinceUMP[] = [
  // Sumatra
  { id: "aceh", name: "Aceh", ump2026: 3685615 }, // Projected
  { id: "sumut", name: "Sumatera Utara", ump2026: 3228949 }, // Real
  { id: "sumbar", name: "Sumatera Barat", ump2026: 3182955 }, // Real
  { id: "riau", name: "Riau", ump2026: 3780495 }, // Real
  { id: "jambi", name: "Jambi", ump2026: 3234533 }, // Projected
  { id: "sumsel", name: "Sumatera Selatan", ump2026: 3942963 }, // Real
  { id: "bengkulu", name: "Bengkulu", ump2026: 2670039 }, // Projected
  { id: "lampung", name: "Lampung", ump2026: 2893069 }, // Projected
  { id: "babel", name: "Kep. Bangka Belitung", ump2026: 4035000 }, // Real
  { id: "kepri", name: "Kepulauan Riau", ump2026: 3879520 }, // Real

  // Jawa & Bali & Nusa Tenggara
  { id: "jakarta", name: "DKI Jakarta", ump2026: 5729876 }, // Real
  { id: "jabar", name: "Jawa Barat", ump2026: 2191232 }, // Projected
  { id: "jateng", name: "Jawa Tengah", ump2026: 2169348 }, // Projected
  { id: "diy", name: "DI Yogyakarta", ump2026: 2264080 }, // Projected
  { id: "jatim", name: "Jawa Timur", ump2026: 2305984 }, // Projected
  { id: "banten", name: "Banten", ump2026: 3100881 }, // Real
  { id: "bali", name: "Bali", ump2026: 3207459 }, // Real
  { id: "ntb", name: "Nusa Tenggara Barat", ump2026: 2602931 }, // Projected
  { id: "ntt", name: "Nusa Tenggara Timur", ump2026: 2329000 }, // Projected

  // Kalimantan
  { id: "kalbar", name: "Kalimantan Barat", ump2026: 3054552 }, // Real
  { id: "kalteng", name: "Kalimantan Tengah", ump2026: 3473621 }, // Projected
  { id: "kalsel", name: "Kalimantan Selatan", ump2026: 3686138 }, // Real
  { id: "kaltim", name: "Kalimantan Timur", ump2026: 3759313 }, // Real
  { id: "kalut", name: "Kalimantan Utara", ump2026: 3770000 }, // Real

  // Sulawesi
  { id: "sulut", name: "Sulawesi Utara", ump2026: 4002630 }, // Real
  { id: "sulteng", name: "Sulawesi Tengah", ump2026: 2914583 }, // Projected
  { id: "sulsel", name: "Sulawesi Selatan", ump2026: 3657527 }, // Projected
  { id: "sultra", name: "Sulawesi Tenggara", ump2026: 3073551 }, // Projected
  { id: "gorontalo", name: "Gorontalo", ump2026: 3221731 }, // Projected
  { id: "sulbar", name: "Sulawesi Barat", ump2026: 3315934 }, // Real

  // Maluku & Papua
  { id: "maluku", name: "Maluku", ump2026: 3334490 }, // Real
  { id: "malut", name: "Maluku Utara", ump2026: 3408000 }, // Projected
  { id: "papua", name: "Papua", ump2026: 4436283 }, // Real
  { id: "papuabarat", name: "Papua Barat", ump2026: 3840947 }, // Real
  { id: "papuaselatan", name: "Papua Selatan", ump2026: 4508850 }, // Real
  { id: "papuatengah", name: "Papua Tengah", ump2026: 4295848 }, // Real
  { id: "papuapegunungan", name: "Papua Pegunungan", ump2026: 4436283 }, // Real (Proxied)
  { id: "papuabaratdaya", name: "Papua Barat Daya", ump2026: 3840947 } // Real (Proxied)
];
