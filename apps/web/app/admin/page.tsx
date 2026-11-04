"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, clearSession, MasSession, readSession } from "../lib/session";

interface Organization { id: string; code: string; name: string; organizationType: string; }
interface UserRecord { id: string; username: string; accountType: string; isActive: boolean; }
interface Checkpoint { id: string; code: string; name: string; status: string; }
interface Role { id: string; code: string; name: string; isSystem: boolean; }
interface Permission { id: string; code: string; module: string; description?: string | null; }

export default function AdminPage() {
  const router = useRouter();
  const [session, setSession] = useState<MasSession | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [qrToken, setQrToken] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const current = readSession();
    if (!current) {
      router.replace("/");
      return;
    }
    if (current.user.accountType !== "SYSTEM") {
      router.replace("/attendance");
      return;
    }
    setSession(current);
    void loadData();
  }, [router]);

  async function loadData() {
    setError("");
    try {
      const responses = await Promise.all([
        apiFetch("/organizations"),
        apiFetch("/users?page=1&limit=50"),
        apiFetch("/checkpoints"),
        apiFetch("/roles"),
        apiFetch("/permissions"),
      ]);
      const results = await Promise.all(responses.map((response) => response.json()));
      const unauthorized = responses.some((response) => response.status === 401);
      if (unauthorized) {
        clearSession();
        router.replace("/");
        return;
      }
      if (responses.some((response) => !response.ok)) {
        setError("Sebagian data administrasi tidak dapat dimuat.");
        return;
      }
      setOrganizations(results[0].data);
      setUsers(results[1].data);
      setCheckpoints(results[2].data);
      setRoles(results[3].data);
      setPermissions(results[4].data);
    } catch {
      setError("Layanan administrasi belum dapat dihubungi.");
    }
  }

  async function submitForm(event: FormEvent<HTMLFormElement>, path: string, method = "POST") {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    setQrToken("");
    const form = event.currentTarget;
    const values = new FormData(form);
    let body: Record<string, unknown>;

    if (path === "/users") {
      const accountType = String(values.get("accountType"));
      const profile: Record<string, string> = { fullName: String(values.get("fullName")) };
      if (accountType === "MILITARY") profile.nrp = String(values.get("nrp"));
      if (accountType === "PERSIT") profile.memberNumber = String(values.get("memberNumber"));
      body = {
        username: values.get("username"),
        pin: values.get("pin"),
        accountType,
        ...(accountType === "SYSTEM" ? {} : { profile }),
      };
    } else if (path === "/checkpoints") {
      body = {
        organizationId: values.get("organizationId"),
        code: values.get("code"),
        name: values.get("name"),
        latitude: Number(values.get("latitude")),
        longitude: Number(values.get("longitude")),
        radiusMeter: Number(values.get("radiusMeter")),
        accuracyLimitMeter: Number(values.get("accuracyLimitMeter")),
      };
    } else if (path === "/organizations") {
      body = {
        code: values.get("code"),
        name: values.get("name"),
        organizationType: values.get("organizationType"),
      };
    } else {
      body = { name: values.get("name"), displayName: values.get("displayName") };
    }

    try {
      const response = await apiFetch(path, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.message ?? "Perubahan tidak dapat disimpan.");
        return;
      }
      setNotice("Perubahan berhasil disimpan.");
      form.reset();
      await loadData();
    } catch {
      setError("Perubahan tidak dapat disimpan.");
    } finally {
      setBusy(false);
    }
  }

  async function createRoleWithPermissions(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const select = form.elements.namedItem("permissionIds") as HTMLSelectElement;
    const permissionIds = Array.from(select.selectedOptions, (option) => option.value);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const roleResponse = await apiFetch("/roles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: formData.get("name"), displayName: formData.get("displayName") }),
      });
      const roleResult = await roleResponse.json();
      if (!roleResponse.ok) throw new Error(roleResult.message ?? "Role tidak dapat dibuat.");
      const permissionResponse = await apiFetch(`/roles/${roleResult.data.id}/permissions`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ permissionIds }),
      });
      if (!permissionResponse.ok) throw new Error("Permission role tidak dapat disimpan.");
      setNotice("Role dan permission berhasil disimpan.");
      form.reset();
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Role tidak dapat disimpan.");
    } finally {
      setBusy(false);
    }
  }

  async function assignRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await apiFetch(`/users/${values.get("userId")}/roles`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roleId: values.get("roleId") }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Role tidak dapat ditetapkan.");
      setNotice("Role berhasil ditetapkan.");
      form.reset();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Role tidak dapat ditetapkan.");
    } finally {
      setBusy(false);
    }
  }

  async function generateQr(checkpointId: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await apiFetch(`/checkpoints/${checkpointId}/qr`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "QR tidak dapat dibuat.");
      setQrToken(result.data.token);
      setNotice("Token QR ditampilkan satu kali. Simpan atau cetak melalui proses resmi.");
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "QR tidak dapat dibuat.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    const current = readSession();
    if (current?.refreshToken) {
      await fetch("/api/v1/auth/logout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      }).catch(() => undefined);
    }
    clearSession();
    router.replace("/");
  }

  if (!session) return <main className="attendance-loading">Memuat sesi...</main>;

  return (
    <main className="admin-shell">
      <header className="app-header">
        <a className="app-brand" href="/admin"><span>MAS</span> Administrasi</a>
        <div className="user-menu">
          <span>{session.user.username}</span>
          <button type="button" className="text-button" onClick={logout}>Keluar</button>
        </div>
      </header>
      <section className="admin-content">
        <div className="section-heading">
          <div><p className="eyebrow">Konfigurasi sistem</p><h1>Administrasi</h1></div>
          <button type="button" className="text-button" onClick={() => void loadData()}>Muat ulang</button>
        </div>
        <div className="admin-summary" aria-label="Ringkasan data">
          <div><strong>{organizations.length}</strong><span>Organisasi</span></div>
          <div><strong>{users.length}</strong><span>Pengguna</span></div>
          <div><strong>{checkpoints.length}</strong><span>Checkpoint</span></div>
          <div><strong>{roles.length}</strong><span>Role</span></div>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="notice" role="status">{notice}</p>}
        <div className="admin-grid">
          <section className="admin-section">
            <div className="panel-heading"><div><p className="eyebrow">Struktur</p><h2>Organisasi</h2></div></div>
            <form className="admin-form" onSubmit={(event) => void submitForm(event, "/organizations")}>
              <label>Kode<input name="code" required maxLength={100} /></label>
              <label>Nama<input name="name" required maxLength={200} /></label>
              <label>Tipe<input name="organizationType" required maxLength={100} /></label>
              <button disabled={busy}>Buat organisasi</button>
            </form>
            <ul className="compact-list">{organizations.map((item) => <li key={item.id}><strong>{item.name}</strong><span>{item.code} · {item.organizationType}</span></li>)}</ul>
          </section>

          <section className="admin-section">
            <div className="panel-heading"><div><p className="eyebrow">Identitas</p><h2>Pengguna</h2></div></div>
            <form className="admin-form" onSubmit={(event) => void submitForm(event, "/users")}>
              <label>Tipe akun<select name="accountType" defaultValue="MILITARY"><option value="MILITARY">MILITARY</option><option value="PERSIT">PERSIT</option><option value="SYSTEM">SYSTEM</option></select></label>
              <label>NRP / Username<input name="username" required maxLength={100} /></label>
              <label>PIN<input name="pin" required minLength={4} maxLength={12} inputMode="numeric" /></label>
              <label>Nama lengkap<input name="fullName" maxLength={200} /></label>
              <label>NRP<input name="nrp" maxLength={50} /></label>
              <label>Nomor anggota Persit<input name="memberNumber" maxLength={50} /></label>
              <button disabled={busy}>Buat akun</button>
            </form>
            <ul className="compact-list">{users.map((item) => <li key={item.id}><strong>{item.username}</strong><span>{item.accountType} · {item.isActive ? "Aktif" : "Nonaktif"}</span></li>)}</ul>
          </section>

          <section className="admin-section">
            <div className="panel-heading"><div><p className="eyebrow">Lokasi</p><h2>Checkpoint</h2></div></div>
            <form className="admin-form" onSubmit={(event) => void submitForm(event, "/checkpoints")}>
              <label>Organisasi<select name="organizationId" required defaultValue=""><option value="" disabled>Pilih organisasi</option>{organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label>Kode<input name="code" required maxLength={100} /></label>
              <label>Nama<input name="name" required maxLength={200} /></label>
              <div className="numeric-fields">
                <label>Latitude<input name="latitude" type="number" step="any" min="-90" max="90" required /></label>
                <label>Longitude<input name="longitude" type="number" step="any" min="-180" max="180" required /></label>
                <label>Radius (m)<input name="radiusMeter" type="number" min="0.01" step="any" required /></label>
                <label>Akurasi maks. (m)<input name="accuracyLimitMeter" type="number" min="0.01" step="any" required /></label>
              </div>
              <button disabled={busy || organizations.length === 0}>Buat checkpoint</button>
            </form>
            <ul className="compact-list">{checkpoints.map((item) => <li key={item.id}><strong>{item.name}</strong><span>{item.code} · {item.status}</span><button type="button" className="text-button" disabled={busy} onClick={() => void generateQr(item.id)}>Buat QR</button></li>)}</ul>
            {qrToken && <div className="qr-token"><span>Token QR baru</span><code>{qrToken}</code><button type="button" className="text-button" onClick={() => navigator.clipboard.writeText(qrToken)}>Salin token</button></div>}
          </section>

          <section className="admin-section">
            <div className="panel-heading"><div><p className="eyebrow">Akses</p><h2>Role dan permission</h2></div></div>
            <form className="admin-form" onSubmit={(event) => void createRoleWithPermissions(event)}>
              <label>Kode role<input name="name" required maxLength={100} /></label>
              <label>Nama role<input name="displayName" required maxLength={150} /></label>
              <label>Permission<select name="permissionIds" multiple size={5}>{permissions.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}</select></label>
              <button disabled={busy}>Buat role</button>
            </form>
            <form className="admin-form assign-form" onSubmit={(event) => void assignRole(event)}>
              <label>Pengguna<select name="userId" required defaultValue=""><option value="" disabled>Pilih pengguna</option>{users.map((item) => <option key={item.id} value={item.id}>{item.username} · {item.accountType}</option>)}</select></label>
              <label>Role<select name="roleId" required defaultValue=""><option value="" disabled>Pilih role</option>{roles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <button disabled={busy}>Tetapkan role</button>
            </form>
            <ul className="compact-list">{roles.map((item) => <li key={item.id}><strong>{item.name}</strong><span>{item.code}{item.isSystem ? " · Sistem" : " · Custom"}</span></li>)}</ul>
          </section>
        </div>
      </section>
    </main>
  );
}