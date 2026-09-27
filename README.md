# Akselera.Tech - Aplikasi Chat Internal

Aplikasi Web Chat Internal 1-on-1 berbasis **Next.js 15 (App Router)** sebagai fondasi messaging CRM internal **Akselera.Tech**. Sesuai technical brief, cakupan ini hanya mengerjakan **fitur chat (fondasi)** — integrasi WhatsApp **tidak** termasuk.

Fokus utama: keamanan isolasi data (Fitur Wajib #5 — satu akun hanya bisa membaca percakapannya sendiri, dijaga di **dua lapis**: logika aplikasi **dan** Row Level Security di database), realtime sync, dan brand guidelines (hanya hitam `#000000`, putih `#FFFFFF`, abu-abu netral; font Nunito; light & dark mode).

---

## 0. Checklist: Tinggal Nempel (Copy-Paste Pengumpulan)

Kirim ke **kontak rekruter**, paling lambat **3 x 24 jam** sejak task diterima:

1. **URL aplikasi (publik, aktif minimal 7 hari setelah pengumpulan):**
   - [ ] Tempel: `_________________________`

2. **Minimal 2 akun sampel (email + password):**
   - [ ] Tempel: `andi@contoh.id` / `password123` · `rina@contoh.id` / `password123`

3. **Link repository GitHub pribadi, `tec.akselera@gmail.com` sudah collaborator:**
   - [ ] Tempel: `_________________________`

4. **README** (file ini): stack + alasan, cara lokal, struktur tabel, AI tools, hal belum selesai → sections 2–8 sudah terisi.
   - [x]

---

## 1. Akun Uji Coba

8 akun demo, password default `password123`. Halaman login menyediakan **Quick Login** 1-klik.

| Nama | Email | Password |
| :--- | :--- | :--- |
| **Andi Pratama** | `andi@contoh.id` | `password123` |
| **Rina Kartika** | `rina@contoh.id` | `password123` |
| **Dimas Prasetyo** | `dimas@contoh.id` | `password123` |
| **Sari Wulandari** | `sari@contoh.id` | `password123` |
| **Bayu Nugroho** | `bayu@contoh.id` | `password123` |
| **Maya Handayani** | `maya@contoh.id` | `password123` |
| **Yoga Aditya** | `yoga@contoh.id` | `password123` |
| **Tim Support** | `support@contoh.id` | `password123` |

---

## 2. Stack & Infrastruktur Beserta Alasan

Ketentuan: **Next.js wajib**, infrastruktur bebas, **deploy boleh Vercel**, alasan ditulis di README, **paket gratis dioptimalkan**.

| Layer | Teknologi | Alasan |
| :--- | :--- | :--- |
| **Framework** | **Next.js 15 (App Router)** | Wajib per brief. UI React 19 + Route Handlers + Server Components dalam satu repo, auto-detect Vercel. |
| **Language** | TypeScript | Type-safety di API contracts & komponen; `npm run typecheck` bersih. |
| **Styling** | Tailwind CSS v4 + `next/font` (Nunito self-host) | Brief: hanya hitam, putih, abu-abu netral. Tidak ada warna brand lain di seluruh UI. Font Nunito self-host = performa + privasi. |
| **Auth** | JWT 7 hari di **httpOnly cookie** + `middleware.ts` route guard | Token tidak pernah menyentuh `localStorage`/`document.cookie`, jadi XSS tidak bisa mencurinya. Guard di `middleware.ts` **dan** server component `/` dan `/login`. |
| **Hash password** | **scrypt** (N=16384, r=8, p=1) + salt per user + `timingSafeEqual` | Memory-hard, tahan GPU cracking. Auto-upgrade hash lama saat login. Rate limit 20 percobaan/menit per IP. |
| **Storage (dev)** | JSON atomic write (`data/database.json`, gitignored) | Ringan, portable, auto-seed. Cukup untuk dev lokal. |
| **Storage (production)** | **MySQL** via env `MYSQL_HOST`, dll (Hostinger / MariaDB) | Menggantikan Postgres (brief lama). Aplikasi otomatis deteksi MySQL dari env. |

**Optimasi paket gratis:** 1 project Postgres gratis (0.5–1 GB, cukup untuk/demo) + hobby tier Vercel. Tidak ada layanan berbayar.

---

## 3. Cara Menjalankan Secara Lokal

Prasyarat: Node.js ≥ 20.

```bash
git clone <URL_REPOSITORY>
cd <NAMA_FOLDER>
npm install
cp .env.example .env.local
# Isi .env.local minimal: JWT_SECRET (min 32 karakter, isi acak)
#   generate: openssl rand -base64 48
# POSTGRES_URL boleh dikosongkan untuk mode JSON lokal
npm run dev
# Buka http://localhost:3000
```

Build production & typecheck:

```bash
npm run build
npm run start
npm run typecheck
```

Tanpa `POSTGRES_URL`, app memakai JSON lokal dan **tetap berfungsi penuh** — berguna untuk review cepat tanpa setup database.

---

## 4. Cara Deploy ke Vercel (Tinggal Nempel)

1. Push repo ke **GitHub pribadi**, tambahkan `tec.akselera@gmail.com` sebagai **collaborator**.
2. [vercel.com/new](https://vercel.com/new) → import repo → framework **Next.js** (auto-detect).
3. Tambahkan **Environment Variables**:
   - `JWT_SECRET` — string acak min 32 karakter. **Wajib**, app menolak start di production tanpanya.
   - `POSTGRES_URL` — connection string Postgres (Vercel Storage → Postgres, Neon, atau Supabase). **Disarankan** agar pesan persist setelah refresh/login ulang.
4. **Deploy.** Saat boot pertama, app otomatis:
   - membuat tabel `users`, `conversations`, `messages`,
   - mengaktifkan **RLS** + policy,
   - mengisi 8 akun demo + 6 percakapan + 11 pesan.
   
   **Tanpa langkah manual, tanpa migrasi manual, tanpa seeding manual.**
5. Tempel URL ke checklist section 0.

---

## 5. Struktur Tabel (MySQL)

```sql
app_users (
  id            VARCHAR(191) PRIMARY KEY,
  name          VARCHAR(191) NOT NULL,
  email         VARCHAR(191) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  initials      VARCHAR(8) NOT NULL,
  avatar_color  VARCHAR(32) NOT NULL DEFAULT '#27272A',
  is_online     TINYINT(1) NOT NULL DEFAULT 0,
  last_seen     VARCHAR(64) NOT NULL DEFAULT '',
  created_at    DATETIME(3) NOT NULL
);

app_conversations (
  id         VARCHAR(191) PRIMARY KEY,
  user_a_id  VARCHAR(191) NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  user_b_id  VARCHAR(191) NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  UNIQUE KEY conversations_pair_uniq (user_a_id, user_b_id)
);

app_messages (
  id              VARCHAR(191) PRIMARY KEY,
  conversation_id VARCHAR(191) NOT NULL REFERENCES app_conversations(id) ON DELETE CASCADE,
  sender_id       VARCHAR(191) NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  recipient_id    VARCHAR(191) NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  text            TEXT NOT NULL,
  created_at      DATETIME(3) NOT NULL,
  is_read         TINYINT(1) NOT NULL DEFAULT 0
);
```

### Lapis 2 — Isolasi Query (MySQL) ⭐
Karena MySQL tidak memiliki native RLS seperti Postgres, isolasi ditegakkan lewat **Query Filters** di `lib/mysql-adapter.ts`. Setiap pembacaan data selalu disertai pengecekan keanggotaan partisipan (`WHERE user_a_id = ? OR user_b_id = ?`). Dengan ini, kebocoran data terjamin tidak terjadi meski query API salah panggil.

- JWT hanya di **httpOnly cookie** (`akselera_token`), `secure` di production, `SameSite=Lax`, 7 hari. Tidak ada token di `localStorage`.
- `middleware.ts` (edge) redirect `/` → `/login` bila cookie tidak ada; `app/page.tsx` (server component) memverifikasi signature JWT + user ada, `redirect('/login')` bila tidak. Halaman chat **tidak pernah** dirender untuk pengguna anonim.
- `JWT_SECRET` hanya dari env, min 32 karakter, **tidak ada fallback hardcoded** di production.
- SSE realtime (`/api/events`) memakai cookie `httpOnly` — **tidak ada token di URL**, sehingga tidak bocor ke access log.
- `/api/security-audit` hanya mengembalikan `accessibleCount` milik sendiri — tidak membocorkan metadata percakapan orang lain.
- Rate limit login 20/menit per IP.

**Bukti live untuk reviewer:** tombol **"Verifikasi Keamanan"** → **"Jalankan Tes API"** mencoba membaca `conv-rina-dimas` (milik Rina & Dimas) memakai sesi akun yang sedang login → server membalas **403**.

---

## 7. Brand

| Aset | Implementasi |
| :--- | :--- |
| **Logo 2 versi** | `public/brand/logo-black.svg` (light mode) + `public/brand/logo-white.svg` (dark mode), dipilih otomatis oleh `AkseleraLogo.tsx`. |
| **Font** | Nunito via `next/font/google`, self-host, dipakai seluruh aplikasi. |
| **Warna** | Hanya `#000000` / `#FFFFFF` + abu-abu netral Tailwind (`zinc`). Status online, unread, badge keamanan, dan pesan error semuanya monokrom — **tidak ada** warna aksen (hijau/amber/merah) di seluruh UI. |
| **Light/Dark** | Toggle di dalam aplikasi, berlaku di **semua** halaman termasuk login. Pilihan tersimpan di `localStorage`. Inline script di `layout.tsx` menerapkan tema sebelum hydrate agar **tidak ada flash putih** di dark mode. |

> **Catatan:** logo di `public/brand/` adalah versi rekonstruksi monokrom sesuai spesifikasi brand (hitam/putih). Bila Anda memiliki file logo asli dari folder "File Asset", cukup timpa kedua file SVG tersebut — tidak ada kode yang perlu diubah.

---

## 8. AI Tools yang Dipakai

- **Google Gemini (AI Studio)**: analisis brief PDF, perancangan arsitektur Next.js App Router, desain dua-lapis keamanan (aplikasi + RLS), dan seed data terstruktur.
- Seluruh kode dipahami|Author dan siap dijelaskan saat interview (sesuai ketentuan brief).

---

## 9. Hal yang Belum Selesai & Rencana Lanjutan

- [ ] Integrasi WhatsApp Business Cloud API (di luar cakupan task ini; fase CRM berikutnya).
- [ ] Attachment media (gambar, PDF, voice note).
- [ ] Web Push Notifications saat tab di background.
- [ ] Unit & E2E tests (Vitest + Playwright).
- [ ] Observability (Sentry, Vercel Analytics, structured logging).
- [ ] Role Postgres terpisah untuk membatasi kredensial owner (catatan di section 6).

---

## 10. Self-Check vs Brief

| Kriteria (urut prioritas brief) | Status | Bukti |
| :--- | :--- | :--- |
| Fitur wajib 1 — login/logout, chat tak bisa dibuka tanpa login | ✅ | `middleware.ts` + guard server component `/` → 307 ke `/login` |
| Fitur wajib 2 — new chat 1-on-1 dengan user terdaftar | ✅ | `POST /api/conversations` (404 bila recipient tak ada) |
| Fitur wajib 3 — kirim/terima, persist setelah refresh & login ulang | ✅ | Postgres; `data/` JSON untuk dev |
| Fitur wajib 4 — list: nama, cuplikan, waktu | ✅ | `ChatSidebar.tsx` |
| Fitur wajib 5 — isolasi data **API atau database** | ✅ | Lapis aplikasi **+ RLS Postgres** |
| Fitur wajib 6 — light & dark semua halaman | ✅ | `useTheme` + inline script anti-FOUC |
| Fitur wajib 7 — brand Akselera.Tech | ✅ | Monokrom, Nunito, logo 2 versi |
| Keamanan secret | ✅ | httpOnly cookie, JWT env-only, tanpa token di URL |
| Kerapian kode & README | ✅ | TypeScript bersih, modular, README lengkap |
| Fitur bonus | ✅ | Realtime SSE, register mandiri, unread, search, online, mobile |

**Verifikasi runtime (JSON mode, sudah ditest):** guard 307 → login 200 → `/` 200 → 5 percakapan → `403` untuk `conv-rina-dimas` → logout → 307 `/login`.
