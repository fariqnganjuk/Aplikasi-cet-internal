# Akselera.Tech - Aplikasi Chat Internal

Aplikasi Web Chat Internal 1-on-1 berbasis **Next.js (App Router)** yang dibangun sebagai fondasi messaging CRM internal **Akselera.Tech**. Dirancang dengan fokus pada keamanan isolasi data (fitur wajib #5), performa tinggi, realtime sync, serta kepatuhan brand identity (monokrom, font Nunito, light & dark mode).

---

## 1. Akun Uji Coba (Demo Evaluator)

Sistem sudah dilengkapi dengan akun sampel aktif yang saling terhubung dan memiliki riwayat chat realistis:

| Nama Pengguna | Email | Password Default | Keterangan |
| :--- | :--- | :--- | :--- |
| **Andi Pratama** | `andi@contoh.id` | `password123` | Akun utama pengujian |
| **Rina Kartika** | `rina@contoh.id` | `password123` | Lawan bicara aktif |
| **Dimas Prasetyo** | `dimas@contoh.id` | `password123` | Memiliki unread messages |
| **Maya Handayani** | `maya@contoh.id` | `password123` | Kontak baru untuk dites |
| **Tim Support** | `support@contoh.id` | `password123` | Akun helpdesk internal |

> *Catatan: Pada halaman login, tersedia tombol "Quick Login" 1-klik untuk memudahkan reviewer berganti antar akun secara instan.*

---

## 2. Stack & Infrastruktur Beserta Alasan Pemilihan

Sesuai ketentuan teknis rekrutmen: **Framework wajib: Next.js**:

| Layer | Teknologi | Alasan Pemilihan |
| :--- | :--- | :--- |
| **Framework** | **Next.js 15 (App Router)** | Memenuhi ketentuan wajib task rekrutmen. Memberikan ekosistem fullstack terpadu antara UI (React 19) dan Route Handlers (`app/api/*`) yang siap di-deploy langsung ke **Vercel** atau platform hosting lainnya. |
| **Language** | TypeScript | Menjamin keamanan tipe data (type-safety) ketat di level API contracts dan komponen UI. |
| **Styling** | Tailwind CSS + Google Font Nunito | Mengikuti brand guidelines monokrom Akselera.Tech (`#000000` & `#FFFFFF`), zero-runtime CSS footprint, serta tipografi Nunito yang konsisten. |
| **Otentikasi & Keamanan** | JSON Web Tokens (JWT) + SHA-256 Hashing | Otentikasi stateless yang aman, mempermudah validasi otorisasi di setiap request level API/Database tanpa kebocoran session. |
| **Penyimpanan Data** | Atomic Persistent JSON Storage (`data/database.json`) | Ringan, portable, tanpa dependensi eksternal yang rumit, data tersimpan persisten bahkan setelah refresh, restart, maupun deploy ulang. |

---

## 3. Struktur Direktori Proyek (Next.js App Router)

```text
├── app/
│   ├── layout.tsx                     # Next.js Root Layout (Font Nunito & Metadata)
│   ├── page.tsx                       # Next.js Main Chat Page (Client Component)
│   ├── globals.css                    # Tailwind CSS imports & theme definitions
│   └── api/
│       ├── auth/
│       │   ├── login/route.ts         # Route Handler: Login & JWT Issuer
│       │   ├── register/route.ts      # Route Handler: Registrasi mandiri
│       │   ├── me/route.ts            # Route Handler: Profil user aktif
│       │   └── logout/route.ts        # Route Handler: Logout & update status online
│       ├── users/route.ts             # Route Handler: List pengguna (tanpa user aktif)
│       ├── conversations/
│       │   ├── route.ts               # Route Handler: List chat & buat chat baru
│       │   └── [id]/
│       │       ├── messages/route.ts  # Route Handler: Pesan (proteksi 403 Forbidden)
│       │       └── read/route.ts      # Route Handler: Tandai pesan sudah dibaca
│       └── security-audit/route.ts    # Route Handler: Verifikasi isolasi data
├── lib/
│   └── db.ts                          # Database helper, auth utilities & data storage
├── src/
│   ├── components/
│   │   ├── AkseleraLogo.tsx           # Logo SVG Akselera.Tech (Light & Dark)
│   │   ├── AuthScreen.tsx             # Halaman Login & Register
│   │   ├── ChatSidebar.tsx            # Panel kiri: search, unread badge, list chat
│   │   ├── ChatWindow.tsx             # Panel kanan: percakapan aktif & empty state
│   │   ├── NewChatModal.tsx           # Modal + Chat baru (memilih user terdaftar)
│   │   ├── SecurityAuditModal.tsx     # Modal verifikasi live pengujian aturan #5
│   │   └── ThemeToggle.tsx            # Switcher Light / Dark mode
│   ├── types/
│   │   └── chat.ts                    # TypeScript types & interfaces
│   └── services/
│       └── api.ts                     # Client API layer & realtime listener
├── data/
│   └── database.json                  # File database persisten lokal
├── next.config.mjs                    # Konfigurasi Next.js
├── README.md                          # Dokumentasi proyek
└── package.json
```

---

## 4. Keamanan Akses Data (Fitur Wajib #5)

> **Aturan Wajib:** *"Satu akun hanya bisa membaca percakapan miliknya sendiri. Ini berlaku juga bila data diakses langsung lewat API atau database, bukan hanya disembunyikan di tampilan."*

### Implementasi Perlindungan:
1. **Otorisasi Server-Side di Next.js Route Handler**:
   Setiap request wajib menyertakan Bearer Token JWT yang diverifikasi menggunakan helper otentikasi di `lib/db.ts`.
2. **Endpoint `GET /app/api/conversations/route.ts`**:
   Hanya mengembalikan percakapan di mana `participantIds.includes(currentUser.id)`. User A tidak pernah menerima metadata percakapan User B dan User C.
3. **Endpoint `GET /app/api/conversations/[id]/messages/route.ts`**:
   Server secara aktif memeriksa kepesertaan:
   ```typescript
   if (!conversation.participantIds.includes(currentUser.id)) {
     return NextResponse.json(
       {
         error: 'Akses Ditolak: Anda tidak memiliki izin untuk melihat percakapan ini.',
         code: 'FORBIDDEN_CONVERSATION_ACCESS',
       },
       { status: 403 }
     );
   }
   ```
4. **Fitur Live Audit untuk Reviewer**:
   Tersedia tombol **"Verifikasi Keamanan"** di pojok kanan atas aplikasi. Reviewer dapat mengklik tombol **"Jalankan Tes API"** untuk mencoba bypass membaca chat privat orang lain secara langsung dan membuktikan bahwa server merespons dengan **HTTP 403 Forbidden**.

---

## 5. Cara Menjalankan Secara Lokal & Deployment

### Menjalankan dengan Next.js:
1. **Clone repository**:
   ```bash
   git clone <URL_REPOSITORY>
   cd <NAMA_FOLDER>
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Jalankan development server**:
   ```bash
   npm run dev:next
   ```
   Buka `http://localhost:3000` di browser.

4. **Build untuk production (Next.js)**:
   ```bash
   npm run build:next
   npm run start:next
   ```

### Deployment ke Vercel:
Aplikasi ini sudah 100% kompatibel dengan **Vercel**:
1. Push repository ini ke GitHub pribadi Anda.
2. Tambahkan `tec.akselera@gmail.com` sebagai collaborator di repository GitHub sesuai instruksi rekrutmen.
3. Hubungkan repository ke akun Vercel Anda, lalu klik **Deploy**. Vercel akan otomatis mengenali framework Next.js dan menjalankan `npm run build:next`.

---

## 6. AI Tools yang Dipakai

* **Google Gemini (AI Studio)**: Digunakan untuk menganalisis dokumen gambar technical brief, mengonstruksi arsitektur Next.js App Router, serta merumuskan tata kelola keamanan otorisasi backend.

---

## 7. Hal yang Belum Selesai & Rencana Pengembangan Lanjutan

* Integrasi WhatsApp Business Cloud API (sesuai arahan dokumen brief: di luar cakupan task ini dan akan dihubungkan pada fase CRM berikutnya).
* Pengiriman media/attachment file (gambar, dokumen PDF, pesan suara).
* Web Push Notifications browser ketika tab aplikasi sedang di latar belakang.
