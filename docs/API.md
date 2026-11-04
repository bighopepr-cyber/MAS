# API Documentation

## Military Attendance System (MAS)

| Metadata | Nilai |
| --- | --- |
| Versi | 1.0.0 |
| Status | Draft kontrak API |
| Base path | `/api/v1` |
| Backend | NestJS |
| Database | PostgreSQL |
| ORM | Prisma |
| Autentikasi | JWT + NRP/username + PIN |

---

## 1. Pendahuluan

Dokumen ini menjelaskan rancangan REST API untuk Military Attendance System (MAS).

API digunakan untuk mengelola:

1. Identity & Access Management
2. Military Personnel Management
3. Persit Management
4. Attendance Management
5. QR Code & Checkpoint Management
6. Location & Presence Verification
7. Security & Anomaly Detection
8. Audit & Activity Management
9. Dashboard & Reporting
10. System & Organization Management

### 1.1 Prinsip API

- Seluruh API menggunakan prefix "/api/v1".
- Format request dan response menggunakan JSON, kecuali endpoint ekspor atau unduh dokumen.
- Autentikasi menggunakan JWT Bearer Token.
- Authorization menggunakan Dynamic RBAC.
- Hak akses dan organizational scope diperiksa di backend.
- Waktu transaksi menggunakan waktu server dan disimpan dalam UTC.
- Setiap transaksi kehadiran wajib menyertakan koordinat GPS dan akurasi GPS.
- Backend menentukan jenis transaksi EXIT atau RETURN.
- QR Code bersifat statis dan hanya mengidentifikasi checkpoint.
- Prajurit dan Persit mempunyai sesi kehadiran independen.
- Perubahan data penting wajib tercatat dalam audit log.

---

## 2. Konvensi API

### 2.1 Base URL

Development:

http://localhost:3000/api/v1

Production:

https://mas.example.mil.id/api/v1

### 2.2 HTTP Methods

| Method | Fungsi |
| --- | --- |
| GET | Mengambil data |
| POST | Membuat data atau menjalankan proses |
| PATCH | Mengubah sebagian data |
| PUT | Mengganti data |
| DELETE | Menghapus atau menonaktifkan data |

### 2.3 Format Respons Sukses

{
  "success": true,
  "message": "Data berhasil diambil",
  "data": {},
  "meta": null,
  "requestId": "REQUEST-UUID"
}

### 2.4 Format Respons Error

{
  "success": false,
  "message": "Data tidak ditemukan",
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "details": {}
  },
  "timestamp": "2026-11-05T00:00:00.000Z",
  "path": "/api/v1/users/123",
  "requestId": "REQUEST-UUID"
}

### 2.5 HTTP Status Code

| Status | Keterangan |
| --- | --- |
| 200 | Berhasil |
| 201 | Data berhasil dibuat |
| 204 | Berhasil tanpa body respons |
| 400 | Request tidak valid |
| 401 | Belum terautentikasi |
| 403 | Tidak memiliki izin |
| 404 | Data tidak ditemukan |
| 409 | Konflik data atau transaksi duplikat |
| 422 | Validasi bisnis gagal |
| 429 | Terlalu banyak request |
| 500 | Kesalahan server |

### 2.6 Pagination

Endpoint list menggunakan parameter:

?page=1&limit=20&search=andi&sortBy=createdAt&sortOrder=desc

Response:

{
  "success": true,
  "message": "Data berhasil diambil",
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}

### 2.7 Authentication Header

Endpoint yang membutuhkan autentikasi menggunakan:

Authorization: Bearer <access_token>

---

## 3. Authentication & Identity API

Base path: "/auth"

### 3.1 Login

POST "/auth/login"

Mengautentikasi pengguna menggunakan NRP atau username dan PIN.

Request:

{
  "identity": "12345678",
  "pin": "123456",
  "device": {
    "deviceId": "DEVICE-001",
    "deviceName": "Samsung Galaxy A54",
    "platform": "ANDROID",
    "appVersion": "1.0.0"
  }
}

Response:

{
  "success": true,
  "message": "Login berhasil",
  "data": {
    "accessToken": "JWT_ACCESS_TOKEN",
    "refreshToken": "JWT_REFRESH_TOKEN",
    "expiresIn": 900,
    "user": {
      "id": "uuid",
      "username": "12345678",
      "accountType": "MILITARY",
      "profile": {
        "fullName": "Nama Personel",
        "nrp": "12345678"
      },
      "roles": [
        {
          "id": "uuid",
          "name": "MILITARY"
        }
      ],
      "permissions": [
        "attendance.scan",
        "attendance.view.own"
      ]
    }
  }
}

Catatan:

- "identity" dapat berupa NRP untuk akun Prajurit atau username untuk akun lainnya.
- PIN disimpan dalam bentuk hash.
- Response login tidak boleh mengembalikan PIN atau PIN hash.
- Akun yang tidak aktif harus ditolak.
- Login gagal dicatat dalam security log.

### 3.2 Refresh Token

POST "/auth/refresh"

Request:

{
  "refreshToken": "JWT_REFRESH_TOKEN"
}

Response:

{
  "success": true,
  "message": "Token berhasil diperbarui",
  "data": {
    "accessToken": "NEW_ACCESS_TOKEN",
    "refreshToken": "NEW_REFRESH_TOKEN",
    "expiresIn": 900
  }
}

Gunakan refresh token rotation dan invalidasi token lama setelah berhasil digunakan.

### 3.3 Logout

POST "/auth/logout"

Request:

{
  "refreshToken": "JWT_REFRESH_TOKEN"
}

Response:

{
  "success": true,
  "message": "Logout berhasil",
  "data": null
}

### 3.4 Logout All Devices

POST "/auth/logout-all"

Mengakhiri seluruh sesi aktif pengguna.

Permission:

auth.session.revoke.all

### 3.5 Get Current User

GET "/users/me"

Response:

{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "12345678",
    "accountType": "MILITARY",
    "isActive": true,
    "profile": {
      "fullName": "Nama Personel",
      "nrp": "12345678"
    },
    "roles": [],
    "permissions": []
  }
}

3.6 Change PIN

PATCH "/auth/change-pin"

Request:

{
  "currentPin": "123456",
  "newPin": "654321"
}

Permission:

auth.pin.change

### 3.7 Reset PIN Pengguna

POST "/users/:id/reset-pin"

Reset PIN oleh administrator harus mengikuti kebijakan verifikasi identitas dan otorisasi. Pengguna yang ingin mengganti PIN sendiri menggunakan `PATCH /auth/change-pin`. API tidak boleh mengembalikan PIN lama atau PIN baru.

---

## 4. Dynamic RBAC API

Base path: "/roles", "/permissions", "/users"

Hanya SUPER_ADMIN yang dapat mengelola definisi role dan permission sistem.

Role awal:

- "SUPER_ADMIN"
- "MILITARY"

Role lainnya dibuat secara dinamis oleh SUPER_ADMIN.

4.1 Get Roles

GET "/roles"

Permission:

rbac.role.view

4.2 Create Role

POST "/roles"

Permission:

rbac.role.create

Request:

{
  "name": "ADMIN_SATUAN",
  "displayName": "Administrator Satuan",
  "description": "Mengelola administrasi satuan",
  "isActive": true
}

4.3 Update Role

PATCH "/roles/:id"

Permission:

rbac.role.update

Request:

{
  "displayName": "Administrator Satuan",
  "description": "Mengelola data satuan",
  "isActive": true
}

Role sistem yang dilindungi tidak boleh dihapus atau dinonaktifkan melalui mekanisme pengelolaan role biasa.

4.4 Delete Role

DELETE "/roles/:id"

Permission:

rbac.role.delete

Penghapusan role harus ditolak apabila role masih digunakan, kecuali tersedia mekanisme migrasi assignment yang aman.

4.5 Get Permissions

GET "/permissions"

Permission:

rbac.permission.view

4.6 Create Permission

POST "/permissions"

Request:

{
  "key": "attendance.monitor",
  "module": "attendance",
  "displayName": "Monitoring Kehadiran",
  "description": "Melihat monitoring kehadiran personel"
}

Contoh permission:

user.view
user.create
user.update
user.deactivate

personnel.view
personnel.create
personnel.update

persit.view
persit.create
persit.update

attendance.scan
attendance.view.own
attendance.view.all
attendance.monitor
attendance.correction.create
attendance.correction.approve

checkpoint.view
checkpoint.create
checkpoint.update
checkpoint.qr.generate
checkpoint.qr.revoke

report.view
report.export

audit.view
security.incident.manage

rbac.role.view
rbac.role.create
rbac.role.update
rbac.role.delete
rbac.permission.view
rbac.permission.assign

4.7 Assign Permissions to Role

PUT "/roles/:id/permissions"

Request:

{
  "permissionIds": [
    "permission-uuid-1",
    "permission-uuid-2"
  ]
}

Proses ini mengganti daftar permission role secara keseluruhan. Jika hanya ingin menambah atau menghapus sebagian permission, gunakan endpoint terpisah atau PATCH action yang didefinisikan secara eksplisit.

4.8 Assign Role to User

POST "/users/:id/roles"

Request:

{
  "roleId": "role-uuid",
  "scope": {
    "type": "UNIT",
    "organizationId": "organization-uuid",
    "unitId": "unit-uuid"
  }
}

4.9 Remove Role from User

DELETE "/users/:userId/roles/:roleId"

4.10 Get User Roles

GET "/users/:id/roles"

4.11 Assign Direct Permission

POST "/users/:id/permissions"

Digunakan hanya jika kebijakan Dynamic RBAC mengizinkan permission langsung pada pengguna.

Request:

{
  "permissionId": "permission-uuid",
  "effect": "ALLOW"
}

Setiap perubahan RBAC harus diaudit dan mengakibatkan invalidasi cache permission terkait.

---

## 5. User Management API

Base path: "/users"

5.1 Get Users

GET "/users"

Query:

?page=1&limit=20&search=andi&accountType=MILITARY&isActive=true

Permission:

user.view

5.2 Create User

POST "/users"

Request:

{
  "username": "12345678",
  "pin": "123456",
  "accountType": "MILITARY",
  "isActive": true
}

Catatan:

- Akun domain MILITARY harus mempunyai profil MilitaryPersonnel.
- Akun domain PERSIT harus mempunyai profil PersitMember.
- Akun SYSTEM dapat tidak mempunyai profil personel.
- Pembuatan akun dan profil terkait harus dilakukan secara transaksional.

5.3 Get User Detail

GET "/users/:id"

5.4 Update User

PATCH "/users/:id"

5.5 Deactivate User

PATCH "/users/:id/deactivate"

5.6 Activate User

PATCH "/users/:id/activate"

SUPER_ADMIN tidak boleh dinonaktifkan melalui endpoint biasa. Perubahan akun SUPER_ADMIN harus mempunyai prosedur keamanan khusus dan audit.

---

## 6. Military Personnel API

Base path: "/personnel"

6.1 Get Personnel

GET "/personnel"

Query:

?page=1&limit=20&search=12345678&unitId=uuid&status=ACTIVE

Permission:

personnel.view

6.2 Create Personnel

POST "/personnel"

Request:

{
  "user": {
    "username": "12345678",
    "pin": "123456"
  },
  "personnel": {
    "nrp": "12345678",
    "fullName": "Nama Personel",
    "rank": "SERDA",
    "position": "Jabatan",
    "unitId": "unit-uuid",
    "status": "ACTIVE"
  }
}

Backend harus membuat User dan MilitaryPersonnel dalam satu transaksi.

6.3 Get Personnel Detail

GET "/personnel/:id"

6.4 Update Personnel

PATCH "/personnel/:id"

6.5 Get Personnel History

GET "/personnel/:id/history"

6.6 Change Personnel Organization

POST "/personnel/:id/organization-assignment"

Request:

{
  "organizationId": "organization-uuid",
  "unitId": "unit-uuid",
  "barracksId": "barracks-uuid",
  "effectiveAt": "2026-11-05T00:00:00.000Z",
  "reason": "Mutasi satuan"
}

Perubahan organisasi harus mempertahankan riwayat penempatan sebelumnya.

---

## 7. Persit Management API

Base path: "/persit"

Persit merupakan pengguna independen dengan akun dan PIN sendiri.

7.1 Get Persit Members

GET "/persit"

7.2 Create Persit Member

POST "/persit"

Request:

{
  "user": {
    "username": "PERSIT-0001",
    "pin": "123456"
  },
  "persit": {
    "memberNumber": "PERSIT-0001",
    "fullName": "Nama Anggota Persit",
    "membershipStatus": "ACTIVE"
  },
  "familyRelationship": {
    "militaryPersonnelId": "personnel-uuid",
    "relationshipType": "SPOUSE"
  }
}

7.3 Get Persit Detail

GET "/persit/:id"

7.4 Update Persit

PATCH "/persit/:id"

7.5 Get Persit History

GET "/persit/:id/history"

7.6 Link Persit to Military Personnel

POST "/persit/:id/family-relationships"

Request:

{
  "militaryPersonnelId": "personnel-uuid",
  "relationshipType": "SPOUSE"
}

7.7 Remove Family Relationship

DELETE "/persit/:id/family-relationships/:relationshipId"

Penghapusan hubungan keluarga tidak menghapus akun atau riwayat kehadiran Persit.

---

## 8. Organization Management API

Base path: "/organizations"

8.1 Organizations

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| GET | `/organizations` | Daftar organisasi |
POST| "/organizations"| Membuat organisasi
GET| "/organizations/:id"| Detail organisasi
PATCH| "/organizations/:id"| Update organisasi
DELETE| "/organizations/:id"| Menonaktifkan organisasi

8.2 Units

Base path: "/units"

| Method | Endpoint | Fungsi |
| --- | --- | --- |
GET| "/units"| Daftar satuan
POST| "/units"| Membuat satuan
GET| "/units/:id"| Detail satuan
PATCH| "/units/:id"| Update satuan
DELETE| "/units/:id"| Menonaktifkan satuan

8.3 Barracks

Base path: "/barracks"

| Method | Endpoint | Fungsi |
| --- | --- | --- |
GET| "/barracks"| Daftar barak
POST| "/barracks"| Membuat barak
GET| "/barracks/:id"| Detail barak
PATCH| "/barracks/:id"| Update barak
DELETE| "/barracks/:id"| Menonaktifkan barak

Semua endpoint organisasi wajib menerapkan organizational scope sesuai role pengguna.

---

## 9. Checkpoint Management API

Base path: "/checkpoints"

9.1 Get Checkpoints

GET "/checkpoints"

9.2 Create Checkpoint

POST "/checkpoints"

Request:

{
  "code": "POS-001",
  "name": "Pos Jaga Utama",
  "latitude": -7.4240000,
  "longitude": 109.2300000,
  "radiusMeter": 50,
  "accuracyLimitMeter": 20,
  "organizationId": "organization-uuid",
  "unitId": "unit-uuid",
  "status": "ACTIVE"
}

Nilai radius dan akurasi di atas hanya contoh konfigurasi, bukan nilai baku sistem.

9.3 Get Checkpoint Detail

GET "/checkpoints/:id"

9.4 Update Checkpoint

PATCH "/checkpoints/:id"

Request:

{
  "name": "Pos Jaga Utama",
  "latitude": -7.4241000,
  "longitude": 109.2301000,
  "radiusMeter": 60,
  "accuracyLimitMeter": 20
}

Perubahan koordinat atau geofence tidak memerlukan regenerasi QR.

9.5 Deactivate Checkpoint

PATCH "/checkpoints/:id/deactivate"

9.6 Get Checkpoint QR

GET "/checkpoints/:id/qr"

Mengambil informasi QR aktif tanpa mengembalikan token mentah.

---

## 10. QR Code Management API

Base path: "/checkpoints/:id/qr"

QR bersifat statis dan satu QR aktif digunakan bersama oleh Prajurit dan Persit pada checkpoint yang sama.

10.1 Generate QR

POST "/checkpoints/:id/qr"

Permission:

checkpoint.qr.generate

Request:

{
  "reason": "Pembuatan QR checkpoint baru"
}

Response:

{
  "success": true,
  "message": "QR berhasil dibuat",
  "data": {
    "qrId": "uuid",
    "checkpointId": "checkpoint-uuid",
    "version": 1,
    "status": "ACTIVE",
    "pdfUrl": "/api/v1/checkpoints/checkpoint-uuid/qr/pdf"
  }
}

Token QR harus dihasilkan menggunakan random cryptographically secure generator dengan entropi tinggi. Database menyimpan hash token, bukan token mentah.

QR yang dicetak memuat token checkpoint, bukan NRP, PIN, atau data pribadi.

10.2 Download QR PDF

GET "/checkpoints/:id/qr/pdf"

Response:

Content-Type: application/pdf
Content-Disposition: attachment; filename="checkpoint-POS-001.pdf"

PDF berisi:

- Nama checkpoint
- Kode checkpoint
- QR Code
- Instruksi penggunaan
- Informasi identifikasi versi QR

10.3 Revoke QR

POST "/checkpoints/:id/qr/revoke"

Request:

{
  "reason": "QR rusak atau terindikasi bocor"
}

10.4 Regenerate QR

POST "/checkpoints/:id/qr/regenerate"

Proses harus dilakukan secara transaksional:

1. Validasi izin administrator.
2. Revoke QR aktif sebelumnya.
3. Generate token baru.
4. Simpan hash token baru.
5. Aktifkan QR baru.
6. Catat audit log.

Harus selalu terdapat maksimal satu QR aktif per checkpoint.

10.5 Validate QR

GET "/checkpoints/qr/:token"

Endpoint ini dapat diakses tanpa login untuk menampilkan informasi checkpoint yang aman.

Response:

{
  "success": true,
  "data": {
    "checkpoint": {
      "id": "checkpoint-uuid",
      "code": "POS-001",
      "name": "Pos Jaga Utama",
      "status": "ACTIVE"
    },
    "qrStatus": "ACTIVE"
  }
}

Jangan mengembalikan koordinat internal, token hash, atau informasi sensitif checkpoint melalui endpoint publik ini.

---

## 11. Attendance Management API

Base path: "/attendance"

11.1 Scan QR dan Catat Kehadiran

POST "/attendance/scan"

<mark>Endpoint utama sistem.</mark>

Digunakan oleh Prajurit dan Persit untuk melakukan transaksi EXIT atau RETURN.

Permission:

attendance.scan

Request:

{
  "qrToken": "RANDOM_CHECKPOINT_TOKEN",
  "latitude": -7.4240000,
  "longitude": 109.2300000,
  "accuracy": 8,
  "deviceId": "DEVICE-001",
  "idempotencyKey": "UNIQUE-REQUEST-ID"
}

Backend menjalankan proses:

1. Validasi JWT dan status akun.
2. Validasi permission "attendance.scan".
3. Validasi QR dan status checkpoint.
4. Ambil lokasi GPS yang dikirim perangkat.
5. Validasi rentang koordinat dan akurasi GPS.
6. Hitung jarak antara GPS pengguna dan koordinat checkpoint menggunakan Haversine.
7. Validasi "distance <= radiusMeter".
8. Validasi akurasi GPS terhadap "accuracyLimitMeter".
9. Periksa device dan kebijakan keamanan.
10. Periksa apakah pengguna mempunyai sesi OPEN.
11. Jika tidak ada sesi OPEN, tentukan event EXIT.
12. Jika ada sesi OPEN, tentukan event RETURN.
13. Simpan AttendanceEvent dan update AttendanceSession dalam satu transaksi database.
14. Catat audit dan metadata risiko.
15. Kirim event realtime untuk dashboard.

Frontend tidak boleh menentukan sendiri jenis transaksi.

Response EXIT:

{
  "success": true,
  "message": "Berhasil melakukan EXIT",
  "data": {
    "eventId": "event-uuid",
    "sessionId": "session-uuid",
    "eventType": "EXIT",
    "profileType": "MILITARY",
    "presenceStatus": "OUTSIDE",
    "recordedAt": "2026-11-05T00:15:32.000Z",
    "checkpoint": {
      "id": "checkpoint-uuid",
      "code": "POS-001",
      "name": "Pos Jaga Utama"
    },
    "locationValidation": {
      "valid": true,
      "distanceMeter": 12.5,
      "accuracy": 8
    }
  }
}

Response RETURN:

{
  "success": true,
  "message": "Berhasil melakukan RETURN",
  "data": {
    "eventId": "event-uuid",
    "sessionId": "session-uuid",
    "eventType": "RETURN",
    "profileType": "PERSIT",
    "presenceStatus": "INSIDE",
    "recordedAt": "2026-11-05T10:15:32.000Z",
    "checkpoint": {
      "id": "checkpoint-uuid",
      "code": "POS-001",
      "name": "Pos Jaga Utama"
    },
    "locationValidation": {
      "valid": true,
      "distanceMeter": 9.2,
      "accuracy": 7
    }
  }
}

Aturan penting:

- Prajurit dan Persit mempunyai sesi independen.
- Persit tidak otomatis mengikuti status kehadiran suami.
- Setiap EXIT dan RETURN harus mempunyai validasi GPS sendiri.
- RETURN tetap diperbolehkan walaupun sesi sudah OVERDUE.
- Timestamp dibuat oleh server.
- Semua event yang berhasil dicatat bersifat immutable.
- Request duplikat dengan idempotency key yang sama tidak boleh menghasilkan transaksi kedua.
- Dua request EXIT bersamaan harus dilindungi transaction handling dan unique partial index untuk sesi OPEN.
- Bila GPS tidak akurat, transaksi ditolak atau pengguna diminta mengambil lokasi kembali.
- Browser GPS bukan bukti mutlak terhadap spoofing; sistem tetap mencatat metadata risiko dan anomali.

11.2 Get My Attendance Status

GET "/attendance/my-status"

Response:

{
  "success": true,
  "data": {
    "profileType": "MILITARY",
    "sessionStatus": "OPEN",
    "presenceStatus": "OUTSIDE",
    "exitAt": "2026-11-05T00:15:32.000Z",
    "returnAt": null,
    "deadlineAt": "2026-11-05T10:00:00.000Z"
  }
}

Presence status dihitung dari sesi dan kebijakan:

Kondisi| Presence Status
Tidak ada sesi OPEN| INSIDE
Ada sesi OPEN dan belum melewati deadline| OUTSIDE
Ada sesi OPEN dan melewati deadline| OVERDUE

Session status hanya menggunakan:

OPEN
CLOSED

11.3 Get My Attendance History

GET "/attendance/my-history"

Query:

?page=1&limit=20&startDate=2026-11-01&endDate=2026-11-30

Response:

{
  "success": true,
  "data": [
    {
      "sessionId": "session-uuid",
      "exitAt": "2026-11-05T00:15:32.000Z",
      "returnAt": "2026-11-05T10:15:32.000Z",
      "sessionStatus": "CLOSED",
      "events": [
        {
          "eventType": "EXIT",
          "checkpointName": "Pos Jaga Utama"
        },
        {
          "eventType": "RETURN",
          "checkpointName": "Pos Jaga Utama"
        }
      ]
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}

11.4 Get Attendance Detail

GET "/attendance/sessions/:sessionId"

Pengguna hanya dapat melihat sesi sendiri kecuali memiliki permission monitoring yang sesuai.

11.5 Get Attendance Monitoring

GET "/attendance/monitoring"

Permission:

attendance.monitor

Query:

?unitId=uuid&presenceStatus=OUTSIDE&profileType=MILITARY&page=1&limit=20

11.6 Get Attendance Events

GET "/attendance/events"

Permission:

attendance.view.all

Query:

?startDate=2026-11-01&endDate=2026-11-30&eventType=EXIT&checkpointId=uuid

11.7 Attendance Summary

GET "/attendance/summary"

Permission:

attendance.view.all

Query:

?date=2026-11-05&unitId=uuid

---

## 12. Attendance Correction API

Data event kehadiran tidak boleh diubah langsung.

Koreksi harus disimpan sebagai record terpisah.

12.1 Create Correction Request

POST "/attendance/corrections"

Permission:

attendance.correction.create

Request:

{
  "attendanceEventId": "event-uuid",
  "requestedValue": {
    "eventType": "RETURN",
    "recordedAt": "2026-11-05T10:30:00.000Z"
  },
  "reason": "Kesalahan pencatatan waktu"
}

12.2 Get Correction Requests

GET "/attendance/corrections"

Permission:

attendance.correction.view

12.3 Approve Correction

POST "/attendance/corrections/:id/approve"

Permission:

attendance.correction.approve

Request:

{
  "decision": "APPROVE",
  "notes": "Disetujui berdasarkan bukti pendukung"
}

12.4 Reject Correction

POST "/attendance/corrections/:id/reject"

Request:

{
  "reason": "Bukti pendukung tidak mencukupi"
}

Approval harus dilakukan oleh pengguna yang berwenang dan tidak boleh dilakukan oleh pemohon sendiri apabila kebijakan separation of duties diterapkan.

---

## 13. Attendance Policy API

Base path: "/attendance-policies"

13.1 Get Policies

GET "/attendance-policies"

13.2 Create Policy

POST "/attendance-policies"

Request:

{
  "name": "Kebijakan Kehadiran Satuan",
  "organizationId": "organization-uuid",
  "unitId": "unit-uuid",
  "profileType": "MILITARY",
  "allowedExitTime": "05:00",
  "returnDeadline": "17:00",
  "isActive": true
}

13.3 Update Policy

PATCH "/attendance-policies/:id"

13.4 Get Effective Policy

GET "/attendance-policies/effective"

Query:

?profileType=MILITARY

Kebijakan dapat berbeda berdasarkan organisasi, satuan, atau tipe profil. Aturan prioritas ketika beberapa policy berlaku harus ditetapkan secara eksplisit.

---

## 14. User Device API

Base path: "/devices"

14.1 Register Device

POST "/devices"

Request:

{
  "deviceId": "DEVICE-001",
  "deviceName": "Samsung Galaxy A54",
  "platform": "ANDROID",
  "appVersion": "1.0.0"
}

14.2 Get My Devices

GET "/devices/my"

14.3 Revoke Device

DELETE "/devices/:id"

14.4 Get User Devices

GET "/users/:id/devices"

Permission:

device.view

Device ID yang dikirim frontend bukan bukti identitas perangkat yang tidak dapat dipalsukan. Kebijakan perangkat harus mempertimbangkan tingkat kepercayaan perangkat dan metadata risiko.

---

## 15. Dashboard API

Base path: "/dashboard"

15.1 Dashboard Overview

GET "/dashboard/overview"

Permission:

dashboard.view

Response:

{
  "success": true,
  "data": {
    "totalMilitary": 500,
    "totalPersit": 300,
    "inside": 650,
    "outside": 100,
    "overdue": 50,
    "todayExit": 120,
    "todayReturn": 100
  }
}

Angka di atas merupakan data contoh.

15.2 Attendance by Unit

GET "/dashboard/attendance-by-unit"

15.3 Attendance Trend

GET "/dashboard/attendance-trend"

Query:

?period=7d

15.4 Checkpoint Activity

GET "/dashboard/checkpoint-activity"

15.5 Security Overview

GET "/dashboard/security-overview"

---

## 16. Reporting API

Base path: "/reports"

16.1 Attendance Report

GET "/reports/attendance"

Query:

?startDate=2026-11-01&endDate=2026-11-30&unitId=uuid

16.2 Personnel Report

GET "/reports/personnel"

16.3 Persit Report

GET "/reports/persit"

16.4 Overdue Report

GET "/reports/overdue"

16.5 Checkpoint Activity Report

GET "/reports/checkpoint-activity"

16.6 Export Report

GET "/reports/attendance/export"

Query:

?format=xlsx&startDate=2026-11-01&endDate=2026-11-30

Format yang dapat disediakan:

xlsx
csv
pdf

Export wajib mengikuti organizational scope dan permission pengguna.

---

## 17. Security & Anomaly Detection API

Base path: "/security"

17.1 Get Security Events

GET "/security/events"

Permission:

security.event.view

17.2 Get Security Incidents

GET "/security/incidents"

17.3 Get Incident Detail

GET "/security/incidents/:id"

17.4 Update Incident Status

PATCH "/security/incidents/:id"

Request:

{
  "status": "INVESTIGATING",
  "notes": "Sedang dilakukan pemeriksaan"
}

17.5 Add Incident Action

POST "/security/incidents/:id/actions"

Request:

{
  "action": "ACCOUNT_REVIEW",
  "description": "Pemeriksaan aktivitas akun"
}

Contoh kondisi yang dapat memicu security event:

- QR tidak aktif atau token tidak valid.
- GPS berada di luar geofence.
- GPS accuracy melebihi batas.
- Duplikasi transaksi.
- Banyak percobaan login gagal.
- Perubahan lokasi perangkat yang tidak wajar.
- Pola transaksi yang tidak biasa.
- Indikasi GPS spoofing.

Sinyal tersebut merupakan indikator risiko, bukan bukti otomatis adanya pelanggaran.

---

## 18. Audit API

Base path: "/audit"

18.1 Get Audit Logs

GET "/audit/logs"

Permission:

audit.view

Query:

?actorId=uuid&module=attendance&startDate=2026-11-01&endDate=2026-11-30

18.2 Get Audit Detail

GET "/audit/logs/:id"

Audit log harus melindungi integritas data dan tidak dapat diedit melalui API biasa.

18.3 Get Access Audit Logs

GET "/audit/access-logs"

Digunakan untuk melihat aktivitas login, logout, kegagalan autentikasi, dan perubahan akses.

---

## 19. Notification API

Base path: "/notifications"

19.1 Get My Notifications

GET "/notifications/my"

19.2 Mark Notification as Read

PATCH "/notifications/:id/read"

19.3 Mark All as Read

PATCH "/notifications/read-all"

19.4 Create Notification

POST "/notifications"

Permission:

notification.create

19.5 Manage Notification Templates

| Method | Endpoint | Fungsi |
| --- | --- | --- |
GET| "/notification-templates"| Daftar template
POST| "/notification-templates"| Membuat template
PATCH| "/notification-templates/:id"| Update template
DELETE| "/notification-templates/:id"| Menonaktifkan template

---

## 20. System Settings API

Base path: "/system-settings"

20.1 Get Settings

GET "/system-settings"

Permission:

system.settings.view

20.2 Update Setting

PATCH "/system-settings/:key"

Request:

{
  "value": "Asia/Jakarta"
}

20.3 Get System Health

GET "/system/health"

Response:

{
  "success": true,
  "data": {
    "status": "UP",
    "database": "UP",
    "redis": "UP",
    "timestamp": "2026-11-05T00:00:00.000Z"
  }
}

Endpoint health detail sebaiknya dibatasi untuk administrator dan monitoring internal.

---

## 21. Realtime API - Socket.IO

Selain REST API, MAS menggunakan Socket.IO untuk memperbarui dashboard secara realtime.

Namespace:

/

21.1 Authentication

Client mengirim JWT ketika melakukan koneksi:

const socket = io(API_URL, {
  auth: {
    token: accessToken
  }
});

Server harus memvalidasi token, status akun, permission, dan scope sebelum mengizinkan subscription.

21.2 Event dari Server

| Event | Keterangan |
| --- | --- |
| `attendance:exit` | Transaksi EXIT tercatat |
| `attendance:return` | Transaksi RETURN tercatat |
| `attendance:status-updated` | Status kehadiran berubah |
| `attendance:overdue` | Pengguna melewati deadline |
| `attendance:correction-submitted` | Koreksi kehadiran diajukan |
| `attendance:correction-approved` | Koreksi kehadiran disetujui |
| `checkpoint:created` | Checkpoint dibuat |
| `checkpoint:updated` | Checkpoint diperbarui |
| `checkpoint:qr-revoked` | QR checkpoint dicabut |
| `security:alert-created` | Peringatan keamanan tercatat |
| `security:incident-updated` | Insiden keamanan diperbarui |
| `notification:new` | Notifikasi baru |

21.3 Contoh Payload

{
  "eventId": "event-uuid",
  "profileType": "MILITARY",
  "eventType": "EXIT",
  "presenceStatus": "OUTSIDE",
  "checkpoint": {
    "id": "checkpoint-uuid",
    "name": "Pos Jaga Utama"
  },
  "recordedAt": "2026-11-05T00:15:32.000Z"
}

Client hanya boleh menerima event yang sesuai dengan organizational scope dan permission-nya.

---

22. Idempotency dan Transaction Safety

Endpoint berikut wajib mendukung idempotency:

POST /attendance/scan
POST /checkpoints/:id/qr
POST /attendance/corrections

Untuk transaksi kehadiran, client mengirim `idempotencyKey` di request body. Backend menyimpan dan memvalidasi key tersebut bersama transaksi.

Aturan:

1. Key unik untuk setiap operasi baru.
2. Retry dengan key yang sama tidak boleh membuat event baru.
3. Key yang sama dengan payload berbeda harus ditolak sebagai konflik.
4. Pemeriksaan idempotency dan penyimpanan transaksi harus aman terhadap request bersamaan.
5. Database menjadi sumber kebenaran untuk konsistensi transaksi.

Untuk attendance scan, gunakan database transaction dan partial unique index:

CREATE UNIQUE INDEX uq_attendance_one_open_session
ON attendance_sessions (user_id)
WHERE status = 'OPEN';

---

## 23. Geofence Validation Rules

Setiap transaksi EXIT dan RETURN wajib menjalankan validasi lokasi.

23.1 Required Data

{
  "latitude": -7.4240000,
  "longitude": 109.2300000,
  "accuracy": 8
}

23.2 Validation

- Latitude berada pada rentang -90 sampai 90.
- Longitude berada pada rentang -180 sampai 180.
- Accuracy tidak boleh negatif.
- Checkpoint harus ACTIVE.
- QR harus ACTIVE.
- GPS harus berada dalam radius checkpoint.
- Accuracy harus memenuhi konfigurasi checkpoint.

23.3 Distance Calculation

Backend menggunakan Haversine untuk menghitung jarak:

distance = haversine(
  userLatitude,
  userLongitude,
  checkpointLatitude,
  checkpointLongitude
)

Validasi:

distance <= checkpoint.radiusMeter
accuracy <= checkpoint.accuracyLimitMeter

Jangan mempercayai hasil jarak dari frontend. Perhitungan dilakukan ulang di backend.

---

## 24. Attendance Resolver Rules

Backend menentukan event berdasarkan sesi OPEN pengguna.

IF no OPEN session:
    CREATE EXIT event
    CREATE OPEN session
    presenceStatus = OUTSIDE

ELSE IF OPEN session exists:
    CREATE RETURN event
    UPDATE session to CLOSED
    presenceStatus = INSIDE

OVERDUE bukan status sesi tersendiri. OVERDUE merupakan status kehadiran turunan berdasarkan deadline kebijakan.

Contoh:

Waktu| Event| Session| Presence
07:00| EXIT| OPEN| OUTSIDE
17:00| -| OPEN| OVERDUE
18:15| RETURN| CLOSED| INSIDE

Aturan ini berlaku secara independen untuk setiap akun Prajurit dan Persit.

---

## 25. Kode Error

| Code | HTTP | Keterangan |
| --- | --- | --- |
| `AUTH_INVALID_CREDENTIALS` | 401 | Login gagal |
| `ACCOUNT_INACTIVE` | 403 | Akun tidak aktif |
| `TOKEN_EXPIRED` | 401 | JWT kedaluwarsa |
| `PERMISSION_DENIED` | 403 | Tidak memiliki permission |
| `ORGANIZATION_SCOPE_DENIED` | 403 | Di luar organizational scope |
| `RESOURCE_NOT_FOUND` | 404 | Data tidak ditemukan |
| `QR_INVALID` | 422 | QR tidak valid |
| `QR_REVOKED` | 422 | QR telah dicabut |
| `CHECKPOINT_INACTIVE` | 422 | Checkpoint tidak aktif |
| `GPS_UNAVAILABLE` | 422 | Lokasi tidak tersedia |
| `GPS_INVALID` | 422 | Koordinat tidak valid |
| `GPS_ACCURACY_INSUFFICIENT` | 422 | Akurasi GPS tidak memenuhi batas |
| `LOCATION_OUTSIDE_GEOFENCE` | 422 | Di luar radius checkpoint |
| `DUPLICATE_REQUEST` | 409 | Request duplikat |
| `ATTENDANCE_SESSION_ALREADY_OPEN` | 409 | Sesi keluar sudah terbuka |
| `ATTENDANCE_SESSION_NOT_OPEN` | 409 | Tidak ada sesi yang dapat ditutup |
| `CORRECTION_NOT_ALLOWED` | 422 | Koreksi tidak diperbolehkan |
| `VALIDATION_ERROR` | 400 | Validasi request gagal |
| `RATE_LIMIT_EXCEEDED` | 429 | Batas request terlampaui |
| `INTERNAL_SERVER_ERROR` | 500 | Kesalahan internal |

---

## 26. Security Requirements

Implementasi API wajib menerapkan:

1. JWT access token dengan masa berlaku terbatas.
2. Refresh token rotation.
3. PIN hashing menggunakan algoritma password hashing yang sesuai.
4. Rate limiting untuk login, PIN, dan scan.
5. Lockout atau throttling untuk percobaan login berulang.
6. Validasi input menggunakan DTO dan class-validator.
7. Authorization guard berdasarkan Dynamic RBAC.
8. Organizational scope guard.
9. Audit untuk perubahan permission, role, akun, dan konfigurasi.
10. QR token menggunakan random cryptographically secure generator.
11. Database menyimpan hash token QR, bukan token mentah.
12. HTTPS wajib pada production.
13. Secrets dan private keys tidak disimpan dalam source code.
14. Sensitive fields tidak boleh masuk ke log.
15. Attendance events tidak dapat diubah langsung.
16. Security events digunakan untuk mendeteksi anomali.
17. Backup dan pemulihan database harus diuji secara berkala.

---

## 27. NestJS Module Mapping

Struktur implementasi API yang direkomendasikan:

apps/api/src/
├── modules/
│   ├── auth/
│   ├── users/
│   ├── roles/
│   ├── permissions/
│   ├── user-devices/
│   ├── personnel/
│   ├── persit/
│   ├── family-relationships/
│   ├── organizations/
│   ├── units/
│   ├── barracks/
│   ├── checkpoints/
│   ├── checkpoint-qr/
│   ├── attendance/
│   ├── attendance-policies/
│   ├── attendance-corrections/
│   ├── location-verification/
│   ├── security/
│   ├── audit/
│   ├── dashboard/
│   ├── reports/
│   ├── notifications/
│   └── system-settings/
├── common/
│   ├── decorators/
│   ├── guards/
│   ├── interceptors/
│   ├── filters/
│   ├── pipes/
│   ├── dto/
│   └── utils/
├── database/
│   ├── prisma/
│   └── migrations/
└── main.ts

---

## 28. API Implementation Priority

Urutan pengembangan yang direkomendasikan:

Tahap| Modul| Prioritas
1| Authentication & User| Critical
2| Dynamic RBAC| Critical
3| Personnel & Persit| High
4| Organization Management| High
5| Checkpoint & QR| Critical
6| Attendance & Geofence| Critical
7| Attendance Monitoring| High
8| Attendance Correction| High
9| Dashboard & Reporting| Medium
10| Security & Audit| High
11| Notification & Realtime| Medium
12| System Settings| Medium

---

## 29. Acceptance Criteria

API dianggap memenuhi rancangan awal apabila:

- [ ] SUPER_ADMIN dapat membuat role dan permission secara dinamis.
- [ ] Role awal hanya SUPER_ADMIN dan MILITARY.
- [ ] Akun Prajurit dan Persit memiliki autentikasi independen.
- [ ] Persit dapat melakukan transaksi EXIT dan RETURN sendiri.
- [ ] Satu checkpoint memiliki maksimal satu QR aktif.
- [ ] QR tidak berubah untuk setiap transaksi.
- [ ] QR tidak memuat informasi pribadi.
- [ ] Setiap transaksi memerlukan GPS.
- [ ] Backend memvalidasi geofence dan GPS accuracy.
- [ ] Backend menentukan EXIT atau RETURN secara otomatis.
- [ ] Satu pengguna tidak dapat memiliki lebih dari satu sesi OPEN.
- [ ] Request duplikat tidak menghasilkan transaksi ganda.
- [ ] RETURN dapat dilakukan pada sesi OVERDUE.
- [ ] Attendance event bersifat immutable.
- [ ] Koreksi mempunyai alur persetujuan dan audit.
- [ ] Semua endpoint menerapkan permission dan organizational scope.
- [ ] Dashboard dapat menerima pembaruan realtime.
- [ ] Audit log merekam perubahan penting.
- [ ] Endpoint sensitif menerapkan rate limiting dan validasi keamanan.

---

## 30. Catatan Keputusan Implementasi

Dokumentasi ini merupakan kontrak API awal. Sebelum implementasi production, beberapa detail perlu ditetapkan lebih lanjut:

1. Masa berlaku access token dan refresh token.
2. Kebijakan maksimal percobaan PIN dan mekanisme lockout.
3. Nilai radius geofence dan batas GPS accuracy per checkpoint.
4. Aturan deadline dan prioritas attendance policy.
5. Apakah akun boleh mempunyai beberapa role dengan scope berbeda.
6. Format pagination dan standar sorting global.
7. Mekanisme penyimpanan serta retensi metadata lokasi.
8. Kebijakan approval untuk koreksi dan perubahan akses kritis.
9. Apakah endpoint publik validasi QR diaktifkan atau hanya endpoint internal.
10. Standar API versioning dan dokumentasi OpenAPI/Swagger.

Dokumen ini menjadi acuan kontrak REST API MAS antara frontend Next.js dan backend NestJS.
