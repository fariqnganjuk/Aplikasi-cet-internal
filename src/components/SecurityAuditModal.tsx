import React, { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle2, Lock, Terminal, Play, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { User } from '../types/chat';

interface SecurityAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  theme: 'light' | 'dark';
}

interface TestResult {
  status: number;
  statusText?: string;
  blocked: boolean;
  url: string;
  responseBody?: unknown;
  error?: string;
}

export const SecurityAuditModal: React.FC<SecurityAuditModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  theme,
}) => {
  const [accessibleCount, setAccessibleCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);

  const isDark = theme === 'dark';

  useEffect(() => {
    if (isOpen) {
      setTestResult(null);
      loadAudit();
    }
  }, [isOpen]);

  const loadAudit = async () => {
    try {
      setLoading(true);
      const res = (await api.getSecurityAudit()) as { accessibleCount?: number };
      setAccessibleCount(typeof res.accessibleCount === 'number' ? res.accessibleCount : null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const runDirectApiBreachTest = async () => {
    try {
      setTesting(true);
      setTestResult(null);

      // Coba baca langsung percakapan milik pengguna lain (conv-rina-dimas).
      // Cookie sesi otomatis terkirim; server harus menolak dengan 403.
      const targetConvId = 'conv-rina-dimas';
      const response = await fetch(`/api/conversations/${targetConvId}/messages`, {
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
      });

      const body = await response.json().catch(() => ({}));
      setTestResult({
        status: response.status,
        statusText: response.statusText,
        blocked: response.status === 403,
        url: `/api/conversations/${targetConvId}/messages`,
        responseBody: body,
      });
    } catch (err: unknown) {
      setTestResult({
        status: 500,
        blocked: false,
        url: '/api/conversations/conv-rina-dimas/messages',
        error: err instanceof Error ? err.message : 'Gagal menjalankan tes.',
      });
    } finally {
      setTesting(false);
    }
  };

  if (!isOpen) return null;

  const panelClass = isDark
    ? 'bg-zinc-950 border-zinc-800 text-white'
    : 'bg-white border-zinc-200 text-black';
  const cardClass = isDark
    ? 'bg-zinc-900 border-zinc-800'
    : 'bg-zinc-50 border-zinc-200';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div
        className={`w-full max-w-xl rounded-2xl border flex flex-col max-h-[90vh] overflow-hidden ${panelClass}`}
        role="dialog"
        aria-label="Verifikasi keamanan akses data"
      >
        <div
          className={`flex items-center justify-between px-6 py-4 border-b ${
            isDark ? 'border-zinc-800' : 'border-zinc-100'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-lg border ${
                isDark ? 'border-zinc-700 text-white' : 'border-zinc-300 text-black'
              }`}
            >
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Verifikasi Keamanan Akses Data</h2>
              <p className="text-xs text-zinc-500">Pengujian Syarat Wajib #5 (Isolasi Database & API)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`text-sm px-3 py-1 rounded-md transition-colors cursor-pointer ${
              isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-900' : 'text-zinc-500 hover:text-black hover:bg-zinc-100'
            }`}
          >
            Tutup
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          <div className={`p-4 rounded-xl border ${cardClass}`}>
            <div className="flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider">
                  Bunyi Aturan Wajib #5
                </h4>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                  &ldquo;Satu akun hanya bisa membaca percakapan miliknya sendiri. Ini berlaku juga bila data diakses langsung lewat API atau database, bukan hanya disembunyikan di tampilan.&rdquo;
                </p>
              </div>
            </div>
          </div>

          <div className={`p-3.5 rounded-xl border ${cardClass}`}>
            <div className="text-xs text-zinc-500 font-medium">
              Percakapan Berhak Diakses Akun Ini
            </div>
            <div className="text-2xl font-black mt-1">
              {loading ? '…' : accessibleCount ?? '–'}
            </div>
            <div className="text-[11px] text-zinc-500 mt-0.5">
              Akun: {currentUser?.name}. Server tidak mengembalikan jumlah percakapan milik
              akun lain.
            </div>
          </div>

          <div
            className={`p-4 rounded-xl border ${
              isDark ? 'bg-black border-zinc-800 text-white' : 'bg-black border-black text-white'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-zinc-400" />
                <span className="font-mono text-xs font-semibold text-zinc-200">
                  Simulasi Pengujian Direct API Bypass
                </span>
              </div>
              <button
                onClick={runDirectApiBreachTest}
                disabled={testing}
                className="px-3 py-1.5 rounded-lg bg-white text-black font-bold text-xs flex items-center gap-1.5 hover:bg-zinc-200 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                Jalankan Tes API
              </button>
            </div>
            <p className="text-xs text-zinc-400 mb-3">
              Mencoba request langsung ke endpoint chat milik pengguna lain (<code className="text-zinc-200">/api/conversations/conv-rina-dimas/messages</code>) menggunakan sesi akun Anda saat ini.
            </p>

            {testResult ? (
              <div className="font-mono text-xs p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-zinc-500">HTTP Status:</span>
                  <span
                    className={`px-2 py-0.5 rounded font-bold border ${
                      testResult.status === 403
                        ? 'bg-zinc-900 text-white border-white'
                        : 'bg-zinc-900 text-zinc-300 border-zinc-700'
                    }`}
                  >
                    {testResult.status} {testResult.statusText || 'Forbidden'}
                  </span>
                  {testResult.status === 403 && (
                    <span className="text-[11px] font-sans flex items-center gap-1 text-zinc-200">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Berhasil dicegah di Backend!
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-zinc-500">Response Body:</span>
                  <pre className="text-zinc-300 mt-1 whitespace-pre-wrap break-all text-[11px] bg-black p-2 rounded">
                    {JSON.stringify(testResult.responseBody ?? { error: testResult.error }, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-xs text-zinc-500 font-mono border border-dashed border-zinc-800 rounded-lg">
                Klik tombol &ldquo;Jalankan Tes API&rdquo; untuk membuktikan proteksi backend secara live.
              </div>
            )}
          </div>
        </div>

        <div
          className={`px-6 py-3.5 border-t flex justify-end ${
            isDark ? 'border-zinc-800' : 'border-zinc-100'
          }`}
        >
          <button
            onClick={onClose}
            className={`px-5 py-2 text-xs font-bold rounded-xl cursor-pointer ${
              isDark ? 'bg-white text-black hover:bg-zinc-200' : 'bg-black text-white hover:bg-zinc-800'
            }`}
          >
            Mengerti & Tutup
          </button>
        </div>
      </div>
    </div>
  );
};