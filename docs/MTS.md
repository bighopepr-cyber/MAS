# Master Technical Specification (MTS)

## Military Attendance System (MAS)

| Metadata | Nilai |
| --- | --- |
| Versi dokumen | 1.0.0 |
| Status | Baseline teknis rancangan |
| Platform | Web application / Progressive Web Application (PWA) |
| Arsitektur | Modular monolith, monorepo |
| Bahasa dokumen | Bahasa Indonesia |
| Zona waktu operasional | Asia/Jakarta |
| Database | PostgreSQL |
| Backend | NestJS |
| Frontend | Next.js 14 |
| ORM | Prisma |
| Cache | Redis |
| Realtime | Socket.IO |
| Containerization | Docker |
| Sistem operasi | Ubuntu Server |

---

1. PENDAHULUAN

1.1 Deskripsi Sistem

Military Attendance System (MAS) adalah sistem informasi terintegrasi untuk mengelola identitas pengguna, data personel militer, data anggota Persit, aktivitas keluar-masuk, checkpoint, validasi lokasi, monitoring kehadiran, keamanan, audit aktivitas, serta pelaporan dalam lingkungan organisasi militer.

MAS menggunakan QR Code statis pada setiap checkpoint yang dipadukan dengan validasi GPS dan geofence untuk mencatat transaksi EXIT dan RETURN.

Sistem mendukung dua jenis profil operasional:

1. MILITARY: Prajurit.
2. PERSIT: Anggota Persit.

Setiap pengguna memiliki akun autentikasi dan riwayat kehadiran independen. Prajurit dan Persit tidak berbagi sesi absensi meskipun memiliki hubungan keluarga.

Sistem menyediakan Dynamic Role-Based Access Control (Dynamic RBAC) sehingga administrator utama dapat menentukan role, permission, dan organizational scope sesuai kebutuhan organisasi tanpa memerlukan perubahan kode program.

1.2 Tujuan Sistem

MAS wajib memenuhi tujuan berikut:

1. Mendigitalisasi pencatatan keluar-masuk lingkungan satuan.
2. Memastikan identitas setiap pengguna yang melakukan transaksi.
3. Memvalidasi lokasi transaksi berdasarkan checkpoint.
4. Mencegah transaksi absensi ganda.
5. Menyediakan status kehadiran secara real-time.
6. Mengelola data Prajurit dan Persit secara terpisah dan terintegrasi.
7. Mengimplementasikan pengelolaan hak akses dinamis.
8. Menyediakan riwayat transaksi yang dapat diaudit.
9. Menyediakan monitoring dan pelaporan operasional.
10. Menjamin keamanan, konsistensi, dan integritas data.

1.3 Ruang Lingkup

Sistem terdiri dari sepuluh domain utama:

1. Identity & Access Management.
2. Military Personnel Management.
3. Persit Management.
4. Attendance Management.
5. QR Code & Checkpoint Management.
6. Location & Presence Verification.
7. Security & Anomaly Detection.
8. Audit & Activity Management.
9. Dashboard & Reporting.
10. System & Organization Management.

1.4 Prinsip Sistem

Seluruh implementasi wajib mengikuti prinsip:

- Security by Design.
- Privacy by Design.
- Least Privilege.
- Dynamic RBAC.
- Server-side Authorization.
- Data Integrity.
- Transaction Consistency.
- Auditability.
- High Availability sesuai kapasitas infrastruktur.
- Separation of Concerns.
- Secure-by-Default Configuration.

---

2. KETENTUAN FUNGSIONAL UTAMA

Ketentuan berikut merupakan aturan bisnis wajib dan tidak boleh diubah oleh implementasi frontend.

2.1 Identitas Pengguna

Terdapat dua jenis profil operasional:

- MILITARY.
- PERSIT.

User merupakan akun autentikasi, sedangkan MilitaryPersonnel dan PersitMember merupakan profil domain.

Ketentuan:

1. Prajurit mempunyai akun sendiri.
2. Persit mempunyai akun sendiri.
3. Prajurit menggunakan NRP sebagai identitas utama sesuai kebijakan autentikasi.
4. Persit mempunyai identitas keanggotaan tersendiri.
5. Persit memiliki PIN sendiri.
6. NRP suami hanya digunakan sebagai referensi hubungan keluarga.
7. Satu pengguna tidak boleh menggunakan akun pengguna lain.
8. Satu akun tidak boleh mempunyai dua profil operasional yang bertentangan.
9. Akun administratif dapat menggunakan tipe akun SYSTEM tanpa profil personel.
10. Validasi hubungan keluarga dilakukan berdasarkan data yang terverifikasi.

2.2 QR Code

Ketentuan QR:

1. Setiap checkpoint memiliki satu QR aktif.
2. Prajurit dan Persit menggunakan QR yang sama.
3. QR bersifat statis.
4. QR tidak berubah berdasarkan tanggal.
5. QR tidak berubah berdasarkan transaksi.
6. QR hanya mengidentifikasi checkpoint.
7. QR tidak menyimpan NRP, PIN, atau informasi pribadi.
8. QR menggunakan token acak dengan entropi tinggi.
9. Database menyimpan hash token, bukan token mentah.
10. QR dapat dicabut dan dibuat ulang jika hilang, rusak, atau terindikasi kompromi.
11. Satu checkpoint hanya boleh mempunyai satu QR berstatus ACTIVE.
12. QR yang telah dicabut tidak dapat digunakan kembali.

Perubahan koordinat atau radius checkpoint tidak mengharuskan QR dibuat ulang.

2.3 Geofence

Setiap checkpoint mempunyai:

- Latitude.
- Longitude.
- Radius geofence.
- Batas maksimum GPS accuracy.
- Status checkpoint.
- Konfigurasi kebijakan lokasi.

Setiap transaksi EXIT dan RETURN wajib merekam lokasi.

Validasi dilakukan menggunakan jarak Haversine.

Transaksi dinyatakan memenuhi geofence jika:

Distance <= Checkpoint Radius

Dan:

GPS Accuracy <= Configured Accuracy Limit

Jika GPS tidak tersedia, koordinat tidak valid, atau akurasi tidak memenuhi batas, transaksi tidak dapat dinyatakan berhasil.

Nilai radius dan batas akurasi ditentukan melalui konfigurasi checkpoint, bukan hardcoded pada aplikasi.

GPS browser tidak dianggap sebagai bukti anti-spoofing mutlak. Sistem wajib menyimpan metadata validasi dan indikator risiko untuk mendukung pemeriksaan lanjutan.

2.4 Attendance Resolver

Backend menentukan jenis transaksi secara otomatis.

Aturan:

- Tidak terdapat sesi OPEN: transaksi EXIT.
- Terdapat sesi OPEN: transaksi RETURN.
- Sesi OPEN melewati batas waktu: status OVERDUE, tetapi pengguna tetap dapat melakukan RETURN.

Frontend tidak diperbolehkan menentukan event type sebagai sumber kebenaran.

2.5 Status Kehadiran

Status operasional merupakan hasil evaluasi sesi dan policy.

| Status | Definisi |
| --- | --- |
| INSIDE | Tidak memiliki sesi OPEN |
| OUTSIDE | Memiliki sesi OPEN dan belum melewati batas waktu |
| OVERDUE | Memiliki sesi OPEN dan melewati batas waktu |

Status sesi disimpan terpisah:

| Status sesi | Definisi |
| --- | --- |
| OPEN | Sesi keluar belum ditutup |
| CLOSED | Sesi telah ditutup melalui RETURN |

OVERDUE merupakan status turunan, bukan status transaksi atau status sesi.

2.6 Independensi Prajurit dan Persit

Setiap user mempunyai sesi absensi masing-masing.

Ketentuan:

- EXIT Prajurit tidak membuat Persit menjadi OUTSIDE.
- RETURN Prajurit tidak mengubah status Persit.
- EXIT Persit tidak mengubah status Prajurit.
- RETURN Persit tidak mengubah status Prajurit.
- Relasi keluarga hanya digunakan untuk informasi dan kebutuhan pelaporan yang memiliki otorisasi.

---

3. ARSITEKTUR TEKNOLOGI

3.1 Technology Stack

| Komponen | Teknologi |
| --- | --- |
| Monorepo | Turborepo |
| Frontend | Next.js 14 App Router |
| Backend | NestJS |
| Bahasa | TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Cache | Redis |
| Realtime | Socket.IO |
| Authentication | JWT + PIN |
| Password hashing | Argon2id |
| QR generation | QR Code library |
| PDF generation | PDF generator |
| Location | Browser Geolocation API |
| Scanner | Browser Camera API |
| Container | Docker |
| Reverse proxy | Nginx |
| Sistem operasi | Ubuntu Server |
| Dokumentasi API | OpenAPI / Swagger |
| Testing | Jest / Supertest / E2E testing |

Versi dependency harus dikunci menggunakan lockfile dan diuji kompatibilitasnya sebelum deployment. Versi framework yang digunakan wajib mendapatkan dukungan keamanan yang masih berlaku.

3.2 Arsitektur Aplikasi

MAS menggunakan Modular Monolith dengan satu backend NestJS dan domain terpisah.

Komponen utama:

1. Presentation Layer.
2. API Layer.
3. Authentication & Authorization Layer.
4. Business Logic Layer.
5. Domain Service Layer.
6. Data Access Layer.
7. Infrastructure Layer.

Setiap domain harus mempunyai tanggung jawab yang terdefinisi dan tidak boleh mengakses database domain lain melalui implementasi yang tersebar tanpa kontrak layanan yang jelas.

3.3 Struktur Monorepo

mas/
├── apps/
│   ├── web/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── stores/
│   │   ├── lib/
│   │   └── public/
│   │
│   └── api/
│       └── src/
│           ├── common/
│           ├── config/
│           ├── database/
│           ├── infrastructure/
│           ├── modules/
│           │   ├── identity-access/
│           │   ├── military-personnel/
│           │   ├── persit/
│           │   ├── organization/
│           │   ├── attendance/
│           │   ├── qr-checkpoint/
│           │   ├── location-verification/
│           │   ├── security/
│           │   ├── audit/
│           │   ├── reporting/
│           │   ├── notifications/
│           │   └── system/
│           └── main.ts
│
├── packages/
│   ├── database/
│   │   ├── prisma/
│   │   └── src/
│   ├── shared-types/
│   ├── validation/
│   ├── eslint-config/
│   └── tsconfig/
│
├── infrastructure/
│   ├── docker/
│   ├── nginx/
│   ├── monitoring/
│   └── scripts/
│
├── docs/
│   ├── MTS.md
│   ├── ERD.md
│   ├── API.md
│   ├── SECURITY.md
│   └── DEPLOYMENT.md
│
├── docker-compose.yml
├── turbo.json
├── package.json
└── README.md

---

## 4. Modul 01 — Identity & Access Management

4.1 Fungsi

Modul ini bertanggung jawab atas seluruh proses autentikasi, identitas akun, pengelolaan role, permission, sesi, dan batas kewenangan.

4.2 Authentication

Sistem menyediakan:

- Login.
- Logout.
- Refresh token.
- Pengelolaan sesi pengguna.
- Reset PIN.
- Aktivasi akun.
- Penonaktifan akun.
- Pembatasan percobaan login.
- Pencatatan login gagal.
- Pengelolaan perangkat.

Autentikasi utama menggunakan username/NRP dan PIN sesuai tipe akun.

PIN harus di-hash menggunakan Argon2id atau mekanisme password hashing yang aman. PIN tidak boleh disimpan sebagai plaintext atau dienkripsi menggunakan reversible encryption.

4.3 Dynamic RBAC

Role bawaan hanya:

1. SUPER_ADMIN.
2. MILITARY.

Role lainnya dibuat secara dinamis oleh SUPER_ADMIN.

Contoh role custom:

- ADMIN_SATUAN.
- ADMIN_PERSONEL.
- PETUGAS_POS.
- KOMANDAN.
- PERSIT_MEMBER.
- AUDITOR.

Nama tersebut bukan role sistem yang wajib tersedia sejak instalasi.

4.4 Entitas RBAC

- User.
- Role.
- Permission.
- UserRole.
- RolePermission.
- UserPermission.
- RoleScope.
- AccessAuditLog.

Satu user dapat memiliki lebih dari satu role.

Permission dapat diberikan melalui role dan, jika diaktifkan oleh kebijakan sistem, secara langsung kepada user.

Efektif permission merupakan hasil gabungan role dan direct permission yang masih aktif, dikurangi pembatasan akses yang berlaku.

4.5 Organizational Scope

Setiap role dapat dibatasi berdasarkan:

- Organisasi.
- Satuan.
- Unit.
- Batalion.
- Asrama.
- Checkpoint.

Backend wajib memvalidasi scope pada setiap permintaan yang mengakses data organisasi.

4.6 Perlindungan SUPER_ADMIN

SUPER_ADMIN:

- Dibuat melalui proses bootstrap.
- Tidak dapat dihapus melalui operasi CRUD biasa.
- Tidak dapat dinonaktifkan melalui role management biasa.
- Tidak dapat kehilangan seluruh akses akibat perubahan permission yang tidak disengaja.
- Seluruh perubahan administratif harus diaudit.
- Operasi sensitif harus mempunyai kontrol tambahan.

---

## 5. Modul 02 — Military Personnel Management

Modul mengelola data Prajurit.

Data utama:

- NRP.
- Nama lengkap.
- Pangkat.
- Jabatan.
- Satuan.
- Unit.
- Batalion.
- Asrama.
- Status personel.
- Tanggal bergabung.
- Riwayat mutasi.
- User account reference.

Fungsi:

- Registrasi personel.
- Pembaruan data.
- Validasi NRP.
- Pengelolaan status aktif.
- Riwayat perubahan.
- Penempatan organisasi.
- Relasi dengan akun pengguna.
- Pencarian dan filter.

NRP harus unik dan tidak boleh digunakan oleh dua profil Prajurit aktif.

Perubahan data sensitif harus dicatat dalam audit log.

---

## 6. Modul 03 — Persit Management

Modul mengelola data keanggotaan Persit secara independen.

Data utama:

- Nomor anggota.
- Nama lengkap.
- Identitas keanggotaan.
- Status keanggotaan.
- User account reference.
- Relasi Prajurit.
- Riwayat keanggotaan.

Fungsi:

- Registrasi Persit.
- Pengelolaan profil.
- Aktivasi dan penonaktifan keanggotaan.
- Pengelolaan akun.
- Pengelolaan PIN.
- Verifikasi hubungan keluarga.
- Riwayat hubungan.
- Monitoring absensi.

Persit dapat melakukan transaksi EXIT dan RETURN berdasarkan permission yang diberikan.

Persit tidak otomatis mendapatkan permission hanya karena mempunyai profil Persit.

---

## 7. Modul 04 — Attendance Management

7.1 Fungsi

- EXIT.
- RETURN.
- Attendance Resolver.
- Attendance Session.
- Attendance Event.
- Presence Status.
- Overdue Evaluation.
- Attendance History.
- Attendance Correction.
- Attendance Monitoring.

7.2 Workflow EXIT

1. User melakukan autentikasi.
2. User melakukan scan QR.
3. Backend memvalidasi QR.
4. Browser meminta GPS.
5. Backend memvalidasi koordinat dan accuracy.
6. Backend memvalidasi permission.
7. Backend memeriksa sesi aktif.
8. Jika tidak terdapat sesi OPEN, backend membuat sesi baru.
9. Backend mencatat event EXIT.
10. Backend menulis audit log.
11. Backend mengirim event realtime.
12. Frontend menampilkan hasil transaksi.

7.3 Workflow RETURN

1. User melakukan autentikasi.
2. User melakukan scan QR.
3. Backend memvalidasi QR.
4. Backend memvalidasi GPS.
5. Backend menemukan sesi OPEN milik user.
6. Backend membuat event RETURN.
7. Backend mengubah sesi menjadi CLOSED.
8. Backend mencatat return_at.
9. Backend menulis audit log.
10. Backend mengirim pembaruan realtime.
11. Frontend menampilkan hasil transaksi.

7.4 Attendance Resolver

IF user has no OPEN session:
    EVENT = EXIT
ELSE:
    EVENT = RETURN

Sesi yang telah melewati batas waktu tetap dapat ditutup melalui RETURN.

7.5 Attendance Session

Setiap sesi menyimpan:

- User ID.
- Profile Type.
- Exit At.
- Return At.
- Session Status.
- Created At.
- Updated At.

Status sesi:

- OPEN.
- CLOSED.

Event EXIT dan RETURN direlasikan melalui session_id. Tidak diperlukan foreign key melingkar dari session ke event.

7.6 Attendance Event

Setiap event menyimpan:

- User ID.
- Session ID.
- Profile Type snapshot.
- Checkpoint ID.
- Event Type.
- Server Timestamp.
- Latitude.
- Longitude.
- Accuracy.
- Distance Meter.
- Device ID.
- Validation Status.
- Idempotency Key.
- Risk Metadata.
- Created At.

Event merupakan catatan historis yang tidak boleh diubah secara langsung setelah commit.

7.7 Concurrency Control

Backend wajib menggunakan:

- Database transaction.
- Row locking atau mekanisme locking yang sesuai.
- Unique partial index.
- Idempotency key.
- Atomic state transition.

Satu user hanya boleh memiliki satu session OPEN.

---

## 8. Modul 05 — QR Code & Checkpoint Management

8.1 Checkpoint

Setiap checkpoint memiliki:

- Code.
- Name.
- Description.
- Latitude.
- Longitude.
- Radius Meter.
- Accuracy Limit Meter.
- Status.
- Organization Reference.
- Created At.
- Updated At.

8.2 QR Generation

Token QR harus:

- Menggunakan cryptographically secure random generator.
- Memiliki entropi tinggi.
- Tidak mengandung identitas pengguna.
- Tidak mengandung koordinat pribadi.
- Tidak dapat ditebak.
- Disimpan dalam database sebagai hash.
- Mempunyai status ACTIVE atau REVOKED.

Token mentah hanya ditampilkan saat pembuatan atau proses pencetakan yang terotorisasi. Sistem tidak menyimpan token mentah dalam database atau log aplikasi.

8.3 QR PDF

Fitur cetak harus menghasilkan:

- Nama satuan.
- Nama checkpoint.
- Kode checkpoint.
- QR Code.
- Petunjuk penggunaan.
- Tanggal penerbitan.
- Informasi identifikasi dokumen.

PDF hanya boleh dihasilkan oleh pengguna dengan permission yang sesuai.

---

## 9. Modul 06 — Location & Presence Verification

9.1 Geofence Engine

Backend menghitung jarak antara koordinat user dan koordinat checkpoint menggunakan Haversine.

Parameter:

- User Latitude.
- User Longitude.
- Checkpoint Latitude.
- Checkpoint Longitude.
- Geofence Radius.
- GPS Accuracy Limit.

Validasi wajib dilakukan pada backend.

9.2 Location Validation

Status validasi:

- PENDING.
- VALID.
- REJECTED.
- REVIEW_REQUIRED.

Sistem wajib menolak koordinat di luar rentang geografis yang sah.

Latitude: -90 sampai 90.

Longitude: -180 sampai 180.

Accuracy tidak boleh bernilai negatif, NaN, atau tidak terhingga.

9.3 Privacy

Sistem hanya mengambil lokasi saat transaksi absensi.

Sistem tidak melakukan continuous tracking ketika pengguna berada di luar lingkungan satuan.

Lokasi hanya digunakan untuk validasi transaksi, investigasi yang berwenang, dan kebutuhan audit sesuai kebijakan retensi.

---

## 10. Modul 07 — Security & Anomaly Detection

Fungsi:

- Login failure detection.
- QR abuse detection.
- Repeated scan detection.
- Location anomaly detection.
- Device anomaly detection.
- Token abuse detection.
- Rate limiting.
- Risk scoring.
- Security incident management.

Setiap indikator risiko harus mempunyai kategori dan tingkat keparahan.

Severity:

- LOW.
- MEDIUM.
- HIGH.
- CRITICAL.

Sistem membedakan:

1. Penolakan transaksi.
2. Transaksi yang memerlukan pemeriksaan.
3. Aktivitas yang hanya dicatat sebagai indikator risiko.

Keputusan tersebut ditentukan berdasarkan policy yang dapat diaudit.

---

## 11. Modul 08 — Audit & Activity Management

Semua tindakan kritis harus dicatat.

Aktivitas yang wajib diaudit:

- Login.
- Logout.
- Login gagal.
- Pembuatan akun.
- Perubahan akun.
- Reset PIN.
- Pembuatan role.
- Perubahan permission.
- Assignment role.
- Pencabutan role.
- Pembuatan checkpoint.
- Perubahan koordinat checkpoint.
- Generate QR.
- Revoke QR.
- Transaksi EXIT.
- Transaksi RETURN.
- Pengajuan koreksi.
- Persetujuan koreksi.
- Perubahan policy.
- Ekspor laporan.
- Perubahan konfigurasi sistem.

Audit log harus menyimpan actor, action, entity, waktu server, request ID, dan metadata relevan.

Audit log penting harus dilindungi dari modifikasi dan penghapusan oleh akun operasional biasa.

---

## 12. Modul 09 — Dashboard & Reporting

12.1 Dashboard

Dashboard menampilkan:

- Total personel.
- Total Persit.
- Total INSIDE.
- Total OUTSIDE.
- Total OVERDUE.
- Aktivitas EXIT.
- Aktivitas RETURN.
- Statistik checkpoint.
- Statistik satuan.
- Grafik kehadiran.
- Aktivitas terbaru.
- Security alerts sesuai kewenangan.

12.2 Reporting

Laporan tersedia berdasarkan:

- Tanggal.
- Rentang waktu.
- NRP.
- Nama.
- Jenis profil.
- Pangkat.
- Satuan.
- Unit.
- Checkpoint.
- Status kehadiran.
- Status validasi.

Format ekspor:

- PDF.
- XLSX.
- CSV.

Seluruh ekspor harus tunduk pada permission dan organization scope.

12.3 Realtime

Dashboard menggunakan Socket.IO.

Setiap koneksi wajib terautentikasi dan hanya menerima data sesuai permission dan scope.

---

## 13. Modul 10 — System & Organization Management

Data organisasi meliputi:

- Organizations.
- Units.
- Battalions jika digunakan.
- Barracks.
- Checkpoints.
- Organization Assignments.
- Attendance Policies.
- System Settings.

Struktur organisasi harus mendukung penambahan tingkat organisasi tanpa mengharuskan perubahan kode aplikasi untuk setiap satuan baru.

Attendance policy dapat diatur berdasarkan organisasi, unit, atau kelompok pengguna sesuai aturan yang berlaku.

Konfigurasi yang memengaruhi status OVERDUE harus mempunyai masa berlaku dan histori perubahan.

---

## 14. Database Specification

14.1 Database Standards

| Parameter | Ketentuan |
| --- | --- |
Database| PostgreSQL
Primary Key| UUID
ORM| Prisma
Naming| snake_case
Time| TIMESTAMPTZ UTC
Coordinate| DECIMAL(10,7)
Metadata| JSONB
Relations| Foreign Key
Migration| Version-controlled
Integrity| Database constraints

14.2 Core Tables

Identity

- users.
- user_sessions.
- user_devices.

RBAC

- roles.
- permissions.
- user_roles.
- role_permissions.
- user_permissions.
- role_scopes.

Personnel

- military_personnel.
- personnel_histories.

Persit

- persit_members.
- persit_membership_histories.
- family_relationships.

Organization

- organizations.
- units.
- barracks.
- organization_assignments.

Checkpoint

- checkpoints.
- checkpoint_qrs.

Attendance

- attendance_sessions.
- attendance_events.
- attendance_policies.
- attendance_corrections.
- attendance_event_reviews.

Security

- security_events.
- security_incidents.
- security_incident_actions.

Audit

- audit_logs.
- access_audit_logs.

Supporting

- notifications.
- notification_templates.
- system_settings.

14.3 Database Constraints

Wajib tersedia:

- Unique username.
- Unique NRP.
- Unique token hash.
- Unique idempotency key.
- Unique active QR per checkpoint.
- Unique open attendance session per user.
- Unique EXIT event per session.
- Unique RETURN event per session.
- Foreign key integrity.
- Valid latitude and longitude.
- Positive checkpoint radius.
- Nonnegative GPS accuracy.
- Valid session state transitions.

Partial unique indexes dibuat melalui SQL migration karena tidak semua constraint tersebut dapat dideklarasikan langsung melalui Prisma Schema.

14.4 Attendance Integrity

Sistem wajib menjamin:

1. Satu session memiliki satu EXIT.
2. Session CLOSED memiliki satu RETURN.
3. RETURN terjadi setelah EXIT.
4. Event EXIT dan RETURN merujuk session yang sama.
5. Event tidak dapat dimiliki oleh user lain.
6. Event dan session mempunyai profile type yang konsisten.
7. User tidak memiliki lebih dari satu session OPEN.
8. Koreksi tidak mengubah event asli.

---

## 15. API Specification

15.1 API Standard

Base URL:

/api/v1

Semua API menggunakan HTTPS dan JSON.

Autentikasi menggunakan Bearer access token.

API wajib menerapkan:

- DTO validation.
- Authentication Guard.
- Permission Guard.
- Organization Scope Guard.
- Rate Limiting.
- Request ID.
- Structured Error Response.
- Pagination.
- Idempotency untuk transaksi absensi.

15.2 Authentication API

| Method | Endpoint |
| --- | --- |
POST| /auth/login
POST| /auth/refresh
POST| /auth/logout
GET| /users/me
POST| /users
GET| /users
GET| /users/:id
PATCH| /users/:id
POST| /users/:id/reset-pin

15.3 RBAC API

| Method | Endpoint |
| --- | --- |
GET| /roles
POST| /roles
PATCH| /roles/:id
DELETE| /roles/:id
GET| /permissions
POST| /roles/:id/permissions
POST| /users/:id/roles
DELETE| /users/:id/roles/:roleId

Penghapusan role yang sedang digunakan harus diblokir atau melalui prosedur pencabutan assignment yang tervalidasi.

SUPER_ADMIN protected role tidak dapat dihapus melalui operasi biasa.

15.4 Personnel API

| Method | Endpoint |
| --- | --- |
GET| /personnel
POST| /personnel
GET| /personnel/:id
PATCH| /personnel/:id
GET| /personnel/:id/history
GET| /persit
POST| /persit
GET| /persit/:id
PATCH| /persit/:id
GET| /persit/:id/history

15.5 Checkpoint API

| Method | Endpoint |
| --- | --- |
GET| /checkpoints
POST| /checkpoints
GET| /checkpoints/:id
PATCH| /checkpoints/:id
POST| /checkpoints/:id/qr
POST| /checkpoints/:id/qr/revoke
GET| /checkpoints/:id/qr/pdf

15.6 Attendance API

| Method | Endpoint |
| --- | --- |
POST| /attendance/scan
GET| /attendance/my-status
GET| /attendance/my-history
GET| /attendance/monitoring
GET| /attendance/sessions/:id
POST| /attendance/corrections
GET| /attendance/corrections
POST| /attendance/corrections/:id/approve
POST| /attendance/corrections/:id/reject

15.7 Reporting API

| Method | Endpoint |
| --- | --- |
GET| /reports/attendance
GET| /reports/overdue
GET| /reports/personnel
GET| /reports/checkpoints
GET| /reports/export

15.8 Attendance Request

{
  "qrToken": "RANDOM_CHECKPOINT_TOKEN",
  "latitude": -7.4240000,
  "longitude": 109.2300000,
  "accuracy": 8,
  "deviceId": "DEVICE-UUID",
  "idempotencyKey": "UNIQUE-REQUEST-UUID"
}

Backend menentukan EXIT atau RETURN.

Timestamp resmi diambil dari server, bukan dari request client.

15.9 Attendance Response

{
  "success": true,
  "data": {
    "eventType": "EXIT",
    "profileType": "MILITARY",
    "presenceStatus": "OUTSIDE",
    "recordedAt": "2026-11-05T00:15:32.000Z",
    "checkpoint": {
      "code": "POS-001",
      "name": "Pos Jaga Utama"
    },
    "locationValidation": {
      "valid": true,
      "distanceMeter": 12.5,
      "accuracy": 8
    }
  },
  "requestId": "REQUEST-UUID"
}

---

## 16. Frontend Specification

16.1 Framework

Frontend menggunakan Next.js 14 App Router dengan TypeScript.

16.2 User Interface

Halaman utama:

- Login.
- Dashboard.
- QR Scanner.
- Attendance Status.
- Attendance History.
- Personnel Management.
- Persit Management.
- Checkpoint Management.
- Role Management.
- Permission Management.
- Organization Management.
- Attendance Monitoring.
- Security Monitoring.
- Audit Log.
- Reporting.
- System Settings.

Navigasi ditampilkan berdasarkan permission pengguna.

Namun, penyembunyian menu bukan pengganti authorization backend.

16.3 Scanner

Scanner wajib:

- Meminta akses kamera.
- Membaca QR.
- Meminta akses lokasi.
- Menampilkan GPS accuracy.
- Menampilkan status proses.
- Mencegah pengiriman ganda.
- Menggunakan idempotency key.
- Menampilkan hasil EXIT atau RETURN.
- Menampilkan pesan kegagalan yang jelas.

16.4 PWA

PWA menyediakan:

- Web App Manifest.
- Service Worker.
- Installability.
- Responsive Layout.
- Static Asset Caching.
- Offline Status Indicator.

Transaksi absensi hanya dianggap berhasil setelah server mengonfirmasi commit.

Transaksi tidak boleh dinyatakan berhasil hanya karena tersimpan secara lokal.

---

## 17. Security Specification

17.1 Authentication Security

- HTTPS wajib.
- PIN menggunakan Argon2id.
- Access token memiliki masa berlaku terbatas.
- Refresh token dikelola dengan aman.
- Logout mencabut sesi atau refresh token.
- Login dibatasi menggunakan rate limiting.
- Akun nonaktif ditolak.
- Secret tidak boleh disimpan di repository.

17.2 Authorization Security

Setiap endpoint wajib memvalidasi:

1. Identitas pengguna.
2. Status akun.
3. Permission.
4. Organizational scope.
5. Kepemilikan resource jika diperlukan.
6. Profile type jika diperlukan.

17.3 Application Security

Sistem wajib menerapkan:

- Input validation.
- Output encoding.
- SQL injection protection.
- XSS protection.
- CSRF protection sesuai mekanisme autentikasi.
- Secure CORS.
- Security headers.
- Rate limiting.
- Request size limits.
- Secret management.
- Dependency vulnerability scanning.

17.4 QR Security

- Token acak dengan entropi tinggi.
- Hash token di database.
- QR dapat dicabut.
- Token tidak boleh tampil dalam application log.
- Validasi QR dilakukan di backend.
- Satu QR aktif per checkpoint.

17.5 Audit Security

Audit log untuk aktivitas penting harus terlindung dari perubahan tidak sah.

Operasi kritis harus menyimpan actor, waktu, target, alasan, dan hasil.

---

## 18. Realtime Specification

Socket.IO digunakan untuk pembaruan dashboard.

Event Socket.IO menggunakan nama yang sama dengan katalog pada dokumen API:

- `attendance:exit`
- `attendance:return`
- `attendance:status-updated`
- `attendance:overdue`
- `attendance:correction-submitted`
- `attendance:correction-approved`
- `checkpoint:created`
- `checkpoint:updated`
- `checkpoint:qr-revoked`
- `security:alert-created`
- `security:incident-updated`
- `notification:new`

Setiap koneksi harus terautentikasi dan memiliki authorization untuk room yang diakses.

Redis digunakan sebagai adapter apabila deployment menggunakan beberapa instance backend.

---

## 19. Performance & Non-functional Requirements

Target penerimaan awal:

| Kategori | Ketentuan |
| --- | --- |
API latency| p95 <= 2 detik untuk API normal
Attendance scan| p95 <= 3 detik setelah GPS tersedia
Availability| Target 99,5% per bulan
Database| ACID transaction
Security| HTTPS dan access control
UI| Responsive dan mobile-first
Compatibility| Browser modern
Realtime| Pembaruan status setelah commit
Audit| Aktivitas kritis dapat ditelusuri
Privacy| Tidak ada continuous GPS tracking

Target tersebut wajib dibuktikan melalui pengujian pada kapasitas dan lingkungan produksi yang disepakati.

---

## 20. Infrastructure & Deployment Specification

20.1 Production Components

- Ubuntu Server.
- Docker Engine.
- Docker Compose atau orchestrator yang disetujui.
- Nginx.
- Next.js.
- NestJS.
- PostgreSQL.
- Redis.
- TLS Certificate.
- Backup Storage.
- Monitoring.
- Centralized Logging.

20.2 Environment

Konfigurasi production wajib terpisah dari development.

Secret disediakan melalui environment secret management atau mekanisme secret store yang aman.

Environment minimum:

- DATABASE_URL.
- REDIS_URL.
- JWT_ACCESS_SECRET atau signing key.
- JWT_REFRESH_SECRET atau signing key.
- APP_BASE_URL.
- CORS_ORIGINS.
- TIMEZONE.
- QR_TOKEN_HASH_SECRET jika diperlukan.
- STORAGE_CONFIGURATION.

Secret harus mempunyai kebijakan rotasi dan tidak boleh dikomit ke repository.

20.3 Production Deployment Requirements

Sebelum sistem dinyatakan siap produksi:

- Docker image menggunakan versi dependency terkunci.
- Database migration sudah tervalidasi.
- Bootstrap SUPER_ADMIN telah tersedia.
- Default credential telah diganti.
- HTTPS aktif.
- Database tidak terbuka langsung ke internet.
- Redis tidak terbuka langsung ke internet.
- Backup telah diuji.
- Health check tersedia.
- Logging dan monitoring aktif.
- Error handling aktif.
- Rate limiting aktif.
- Firewall dan network policy telah diterapkan.
- Deployment rollback tersedia.
- Recovery procedure terdokumentasi.

20.4 Database Backup

Sistem wajib mendukung:

- Backup terjadwal.
- Backup terenkripsi.
- Penyimpanan terpisah.
- Retensi sesuai kebijakan.
- Restore test.
- Point-in-time recovery apabila konfigurasi PostgreSQL mendukungnya.

RPO dan RTO wajib ditentukan dalam dokumen operasional dan diuji.

20.5 Health Checks

Endpoint operasional:

GET /health
GET /health/live
GET /health/ready

Health readiness harus memeriksa dependency penting seperti database dan Redis sesuai kebutuhan layanan.

---

## 21. Data Governance & Privacy

Data yang diproses:

- Data identitas akun.
- Data personel.
- Data Persit.
- Data organisasi.
- Data transaksi absensi.
- Data koordinat transaksi.
- Data perangkat.
- Data keamanan.
- Data audit.

Ketentuan:

1. Data hanya dapat diakses berdasarkan kewenangan.
2. Data lokasi digunakan sesuai tujuan absensi dan keamanan.
3. Akses data pribadi dicatat jika termasuk aktivitas sensitif.
4. Data historis tidak boleh dimodifikasi tanpa prosedur.
5. Retensi mengikuti kebijakan organisasi dan ketentuan hukum.
6. Backup harus dilindungi.
7. Ekspor data harus dibatasi permission.
8. Data sensitif tidak boleh dimasukkan ke log umum.
9. Penghapusan data harus mengikuti kebijakan retensi dan legal hold.
10. Data produksi tidak boleh digunakan untuk testing tanpa proses masking atau kontrol yang sesuai.

---

22. ERROR HANDLING

Format error response:

{
  "success": false,
  "error": {
    "code": "LOCATION_OUTSIDE_GEOFENCE",
    "message": "Lokasi berada di luar radius checkpoint.",
    "details": {
      "distanceMeter": 85.4,
      "radiusMeter": 50
    }
  },
  "requestId": "REQUEST-UUID"
}

Kode error standar mengikuti katalog pada dokumen API:

- AUTH_INVALID_CREDENTIALS.
- ACCOUNT_INACTIVE.
- TOKEN_EXPIRED.
- PERMISSION_DENIED.
- ORGANIZATION_SCOPE_DENIED.
- QR_INVALID.
- QR_REVOKED.
- CHECKPOINT_INACTIVE.
- GPS_UNAVAILABLE.
- GPS_INVALID.
- GPS_ACCURACY_INSUFFICIENT.
- LOCATION_OUTSIDE_GEOFENCE.
- ATTENDANCE_SESSION_ALREADY_OPEN.
- ATTENDANCE_SESSION_NOT_OPEN.
- DUPLICATE_REQUEST.
- VALIDATION_ERROR.
- INTERNAL_SERVER_ERROR.

Detail internal, stack trace, secret, dan informasi sensitif tidak boleh dikirim ke client.

---

## 23. Data Correction & Record Immutability

Attendance Event bersifat immutable setelah berhasil disimpan.

Jika terdapat kesalahan:

1. Pengguna mengajukan koreksi.
2. Sistem mencatat nilai asli.
3. Sistem menyimpan nilai yang diusulkan.
4. Pengguna memberikan alasan.
5. Pihak berwenang melakukan pemeriksaan.
6. Sistem memeriksa konflik kepentingan.
7. Jika disetujui, sistem menyimpan correction record.
8. Data asli tetap tersedia.
9. Seluruh tindakan dicatat dalam audit log.

Koreksi tidak boleh menghapus jejak transaksi awal.

---

## 24. Testing & Acceptance Requirements

Sebelum release produksi, seluruh persyaratan berikut harus lulus.

24.1 Functional Testing

- Login Prajurit.
- Login Persit.
- Dynamic RBAC.
- Permission assignment.
- Organization scope.
- QR generation.
- QR revocation.
- GPS validation.
- Geofence validation.
- EXIT.
- RETURN.
- OVERDUE.
- Attendance history.
- Attendance correction.
- Audit.
- Reporting.
- Realtime dashboard.

24.2 Data Integrity Testing

- Tidak ada dua session OPEN untuk satu user.
- Tidak ada dua QR ACTIVE untuk satu checkpoint.
- Tidak ada EXIT ganda dalam satu session.
- Tidak ada RETURN ganda dalam satu session.
- Tidak ada RETURN tanpa EXIT.
- Tidak ada transaksi yang berpindah pemilik.
- Tidak ada event dengan koordinat tidak valid.
- Tidak ada perubahan event asli melalui correction.

24.3 Security Testing

- Authentication testing.
- Authorization testing.
- Privilege escalation testing.
- IDOR testing.
- SQL injection testing.
- XSS testing.
- CSRF testing.
- Token replay testing.
- Rate limit testing.
- QR token abuse testing.
- GPS anomaly testing.
- Secret exposure testing.
- Dependency vulnerability testing.

24.4 Concurrency Testing

Sistem wajib diuji dengan permintaan bersamaan untuk user yang sama.

Hasil yang diharapkan:

- Tidak ada sesi EXIT ganda.
- Tidak ada dua RETURN untuk sesi yang sama.
- Tidak ada status session yang saling bertentangan.
- Duplicate request ditangani berdasarkan idempotency key.
- Database tetap konsisten.

24.5 Backup & Recovery Testing

- Backup berhasil.
- Restore berhasil.
- Data hasil restore konsisten.
- Recovery procedure terdokumentasi.
- Akses backup terlindungi.

---

## 25. Production Acceptance Criteria

Produk MAS hanya dapat dinyatakan siap deployment dan siap operasional apabila seluruh ketentuan berikut terpenuhi:

1. Seluruh modul wajib telah diimplementasikan.
2. Dynamic RBAC berjalan pada backend.
3. SUPER_ADMIN bootstrap telah tersedia.
4. Akun Prajurit dan Persit berjalan secara independen.
5. QR statis berfungsi sesuai ketentuan.
6. Geofence berjalan menggunakan konfigurasi checkpoint.
7. GPS accuracy divalidasi.
8. Attendance Resolver berjalan pada backend.
9. EXIT dan RETURN menggunakan transaksi database.
10. Concurrency control aktif.
11. Attendance Event immutable.
12. Correction workflow berjalan.
13. Audit trail tersedia.
14. Dashboard dan reporting berjalan.
15. Socket.IO hanya mengirim data yang diotorisasi.
16. HTTPS dan konfigurasi keamanan aktif.
17. Database migration berhasil.
18. Backup dan restore telah diuji.
19. Monitoring dan logging aktif.
20. Functional testing, security testing, integration testing, dan load testing memenuhi kriteria penerimaan.
21. Dokumentasi API dan deployment tersedia.
22. Tidak terdapat vulnerability kritis atau tinggi yang belum dimitigasi tanpa persetujuan risiko tertulis.
23. Prosedur operasional dan pemulihan tersedia.
24. Pengujian penerimaan pengguna telah disetujui pihak berwenang.

---

## 26. System Configuration

Parameter berikut wajib dikelola melalui konfigurasi sistem, bukan nilai hardcoded:

- Checkpoint geofence radius.
- GPS accuracy limit.
- Attendance deadline.
- Overdue policy.
- Account lockout policy.
- JWT expiration.
- Refresh token expiration.
- Session expiration.
- Rate limit.
- QR token lifecycle.
- Data retention.
- Notification settings.
- Organization scope.
- Reporting access.
- Security risk threshold.

Setiap perubahan konfigurasi kritis harus dicatat dalam audit log dan memiliki informasi waktu berlaku.

---

## 27. Glossary

Istilah| Definisi
MAS| Military Attendance System
NRP| Nomor Registrasi Prajurit
MILITARY| Jenis profil Prajurit
PERSIT| Jenis profil anggota Persit
RBAC| Role-Based Access Control
Dynamic RBAC| Role dan permission yang dapat dikonfigurasi
Permission| Hak menjalankan fungsi
Organization Scope| Batas akses organisasi
Checkpoint| Pos atau lokasi absensi
Static QR| QR permanen untuk identifikasi checkpoint
Geofence| Radius geografis checkpoint
EXIT| Transaksi keluar
RETURN| Transaksi kembali
Attendance Session| Sesi antara EXIT dan RETURN
Attendance Event| Catatan transaksi individual
INSIDE| Tidak memiliki sesi keluar aktif
OUTSIDE| Memiliki sesi keluar aktif
OVERDUE| Sesi keluar melewati batas waktu
Idempotency| Mekanisme pencegah pemrosesan ganda
Audit Trail| Riwayat tindakan yang dapat ditelusuri
SoD| Separation of Duties
PWA| Progressive Web Application

---

## 28. Final Technical Declaration

Dokumen Master Technical Specification ini merupakan baseline rancangan teknis untuk implementasi Military Attendance System. Status siap produksi hanya dapat ditetapkan setelah seluruh kriteria pengujian dan penerimaan pada dokumen ini terpenuhi.

Seluruh komponen aplikasi, database, API, keamanan, workflow, dan infrastruktur wajib mengikuti ketentuan yang tercantum dalam dokumen ini.

Tidak diperbolehkan melakukan perubahan terhadap aturan bisnis utama, khususnya:

- Identitas dan independensi Prajurit serta Persit.
- Dynamic RBAC.
- QR statis per checkpoint.
- Validasi GPS dan geofence.
- Attendance Resolver.
- Independensi sesi EXIT dan RETURN.
- Pencegahan sesi ganda.
- Immutability Attendance Event.
- Audit trail.
- Authorization berbasis permission dan organizational scope.

Setiap perubahan yang berdampak terhadap aturan tersebut harus melalui pengendalian perubahan spesifikasi dan persetujuan pihak berwenang.

Dokumen ini menjadi acuan utama pengembangan, pengujian, deployment, dan pemeliharaan Military Attendance System.

END OF DOCUMENT
