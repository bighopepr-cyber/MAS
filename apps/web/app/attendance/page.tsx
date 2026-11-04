"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { useRouter } from "next/navigation";
import { apiFetch, clearSession, MasSession, readSession } from "../lib/session";

interface AttendanceStatus {
  profileType: string;
  sessionStatus: string | null;
  presenceStatus: "INSIDE" | "OUTSIDE" | "OVERDUE";
  exitAt?: string;
  deadlineAt?: string | null;
}

interface AttendanceHistory {
  sessionId: string;
  exitAt: string;
  returnAt: string | null;
  sessionStatus: string;
  events: { eventType: string; checkpointName: string }[];
}

export default function AttendancePage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [session, setSession] = useState<MasSession | null>(null);
  const [status, setStatus] = useState<AttendanceStatus | null>(null);
  const [history, setHistory] = useState<AttendanceHistory[]>([]);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const currentSession = readSession();
    if (!currentSession) {
      router.replace("/");
      return;
    }
    setSession(currentSession);
    void loadAttendance();
  }, [router]);

  useEffect(() => {
    if (!scanning || !videoRef.current) return;

    const reader = new BrowserMultiFormatReader();
    let controls: IScannerControls | undefined;
    let disposed = false;

    reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
      if (result && !disposed) {
        disposed = true;
        controls?.stop();
        setScanning(false);
        void submitScan(result.getText());
      }
    }).then((activeControls) => {
      controls = activeControls;
      if (disposed) controls.stop();
    }).catch(() => {
      setError("Kamera tidak dapat dibuka. Periksa izin kamera dan koneksi HTTPS.");
      setScanning(false);
    });

    return () => {
      disposed = true;
      controls?.stop();
    };
  }, [scanning]);

  async function loadAttendance() {
    try {
      const [statusResponse, historyResponse] = await Promise.all([
        apiFetch("/attendance/my-status"),
        apiFetch("/attendance/my-history?page=1&limit=10"),
      ]);
      if (statusResponse.status === 401 || historyResponse.status === 401) {
        clearSession();
        router.replace("/");
        return;
      }
      if (statusResponse.ok) {
        const result = await statusResponse.json();
        setStatus(result.data);
      }
      if (historyResponse.ok) {
        const result = await historyResponse.json();
        setHistory(result.data);
      }
    } catch {
      setError("Data kehadiran belum dapat dimuat.");
    }
  }

  async function submitScan(qrToken: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15_000,
          maximumAge: 0,
        });
      });
      const deviceId = localStorage.getItem("mas-device-id") ?? undefined;
      const response = await apiFetch("/attendance/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          qrToken,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          deviceId,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.message ?? "Transaksi kehadiran tidak dapat diproses.");
        return;
      }
      setNotice(`${result.message} · ${result.data.checkpoint.name}`);
      await loadAttendance();
    } catch (scanError) {
      setError(scanError instanceof GeolocationPositionError
        ? "Lokasi tidak tersedia. Aktifkan GPS dan coba kembali."
        : "Pemindaian tidak dapat diproses. Coba kembali.");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
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

  if (!session) return <main className="attendance-loading" aria-live="polite">Memuat sesi...</main>;

  return (
    <main className="attendance-shell">
      <header className="app-header">
        <a className="app-brand" href="/attendance"><span>MAS</span> Kehadiran</a>
        <div className="user-menu">
          <span>{session.user.profile?.fullName ?? session.user.username}</span>
          <span className="account-type">{session.user.accountType}</span>
          <button type="button" className="text-button" onClick={handleLogout}>Keluar</button>
        </div>
      </header>

      <section className="attendance-content" aria-labelledby="attendance-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Kehadiran personel</p>
            <h1 id="attendance-title">Status saya</h1>
          </div>
          <span className={`presence-badge presence-${status?.presenceStatus.toLowerCase() ?? "loading"}`}>
            {status?.presenceStatus ?? "Memuat"}
          </span>
        </div>

        <div className="attendance-layout">
          <section className="status-panel" aria-label="Status kehadiran saat ini">
            <div className="status-panel-top">
              <span className="status-label">Status operasional</span>
              <span className="profile-chip">{status?.profileType ?? session.user.accountType}</span>
            </div>
            <strong className="status-value">{status?.presenceStatus ?? "—"}</strong>
            <dl className="status-details">
              <div><dt>Waktu keluar</dt><dd>{status?.exitAt ? new Date(status.exitAt).toLocaleString("id-ID") : "Tidak ada sesi aktif"}</dd></div>
              <div><dt>Batas kembali</dt><dd>{status?.deadlineAt ? new Date(status.deadlineAt).toLocaleString("id-ID") : "—"}</dd></div>
            </dl>
            <button type="button" className="scan-button" disabled={busy || scanning} onClick={() => { setError(""); setScanning(true); }}>
              {busy ? "Memproses..." : "Pindai QR checkpoint"}
            </button>
            {scanning && (
              <div className="scanner-frame">
                <video ref={videoRef} muted playsInline aria-label="Pratinjau kamera pemindai QR" />
                <button type="button" className="text-button" onClick={() => setScanning(false)}>Tutup pemindai</button>
              </div>
            )}
            {notice && <p className="notice" role="status">{notice}</p>}
            {error && <p className="form-error" role="alert">{error}</p>}
          </section>

          <section className="history-panel" aria-labelledby="history-title">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Aktivitas terbaru</p>
                <h2 id="history-title">Riwayat kehadiran</h2>
              </div>
              <button type="button" className="text-button" onClick={() => void loadAttendance()}>Muat ulang</button>
            </div>
            {history.length === 0 ? (
              <p className="empty-state">Belum ada transaksi kehadiran.</p>
            ) : (
              <ol className="history-list">
                {history.map((item) => (
                  <li key={item.sessionId}>
                    <span className={`history-marker ${item.sessionStatus === "OPEN" ? "is-open" : ""}`} />
                    <div className="history-copy">
                      <strong>{item.events.map((event) => event.eventType).join(" / ")}</strong>
                      <span>{item.events[0]?.checkpointName ?? "Checkpoint"}</span>
                      <time dateTime={item.exitAt}>{new Date(item.exitAt).toLocaleString("id-ID")}</time>
                    </div>
                    <span className="history-state">{item.sessionStatus}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}