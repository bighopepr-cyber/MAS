"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { saveSession } from "./lib/session";

interface LoginResponse {
  success: boolean;
  message: string;
  data?: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    user: {
      id: string;
      username: string;
      accountType: string;
      profile: { fullName: string; nrp?: string; memberNumber?: string } | null;
      roles: { name: string }[];
      permissions: string[];
    };
  };
}

export default function HomePage() {
  const router = useRouter();
  const [identity, setIdentity] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);

    try {
      let deviceId = localStorage.getItem("mas-device-id");
      if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem("mas-device-id", deviceId);
      }

      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          identity,
          pin,
          device: {
            deviceId,
            deviceName: navigator.userAgent.slice(0, 255),
            platform: navigator.platform.slice(0, 100),
          },
        }),
      });
      const result = await response.json() as LoginResponse;
      if (!response.ok || !result.data) {
        setError(result.message || "Identitas atau PIN tidak dapat diverifikasi.");
        return;
      }

      saveSession(result.data);
      router.replace(result.data.user.accountType === "SYSTEM" ? "/admin" : "/attendance");
    } catch {
      setError("Layanan belum dapat dihubungi. Coba kembali beberapa saat lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel" aria-labelledby="page-title">
        <div className="brand-mark" aria-hidden="true">MAS</div>
        <p className="eyebrow">Military Attendance System</p>
        <h1 id="page-title">Masuk ke sistem</h1>
        <p className="intro">Gunakan NRP atau username dan PIN terdaftar.</p>
        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="identity">NRP / Username</label>
          <input
            id="identity"
            name="identity"
            autoComplete="username"
            value={identity}
            onChange={(event) => setIdentity(event.target.value)}
            required
          />
          <label htmlFor="pin">PIN</label>
          <input
            id="pin"
            name="pin"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            required
          />
          {error && <p className="form-error" role="alert">{error}</p>}
          <button type="submit" disabled={pending}>
            {pending ? "Memverifikasi..." : "Masuk"}
          </button>
        </form>
        <p className="security-note">Akses dan aktivitas sistem tercatat untuk keperluan audit.</p>
      </section>
      <aside className="status-rail" aria-label="Informasi sistem">
        <div>
          <span className="status-indicator" />
          <span>Portal operasional</span>
        </div>
        <p>Keamanan personel<br />dimulai dari data yang tepat.</p>
        <span className="rail-code">MAS / 01</span>
      </aside>
    </main>
  );
}