# Military Attendance System

Monorepo untuk Military Attendance System (MAS), menggunakan NestJS, Next.js 14, PostgreSQL, Prisma, Redis, dan Turborepo.

## Menjalankan Secara Lokal

1. Salin `.env.example` menjadi `.env`.
2. Ganti `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, dan `BOOTSTRAP_ADMIN_PIN` dengan nilai khusus lingkungan lokal. PIN bootstrap harus berupa 4-12 digit.
3. Pasang dependency dengan `npm install`.
4. Jalankan PostgreSQL dan Redis dengan `docker compose up -d`.
5. Terapkan skema database dengan `npm run db:deploy`.
6. Buat role, permission, dan akun SUPER_ADMIN awal dengan `npm run db:seed`.
7. Jalankan aplikasi dengan `npm run dev`.

Web tersedia di `http://localhost:3000`, API di `http://localhost:3001/api/v1`, dokumentasi OpenAPI di `http://localhost:3001/api/v1/docs`, dan health probe di `http://localhost:3001/health`.

Seed tidak mengganti PIN akun yang sudah ada. Perubahan kredensial dilakukan melalui alur administrasi, bukan dengan mengulang seed.

## Validasi

- `npm run build` membangun seluruh workspace.
- `npm test --workspace=@mas/api` menjalankan unit test API.
- `DATABASE_URL=... npx prisma validate --schema packages/database/prisma/schema.prisma` memvalidasi Prisma schema.

## Implementasi Saat Ini

Fondasi monorepo, health probe, autentikasi PIN/JWT dengan rotasi refresh token, Dynamic RBAC, pengelolaan akun/organisasi/checkpoint/QR, attendance EXIT/RETURN, validasi geofence, idempotency, riwayat sesi, dan konfigurasi attendance policy tersedia. Modul lain dalam MTS seperti reporting, audit lengkap, notifikasi, dashboard operasional, dan realtime masih menjadi pekerjaan lanjutan.