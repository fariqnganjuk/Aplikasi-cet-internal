import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, CheckCircle2, Lock, Terminal, Play, Loader2 } from 'lucide-react';
import { api, getToken } from '../services/api';
import { User } from '../types/chat';

interface SecurityAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  theme: 'light' | 'dark';
}

export const SecurityAuditModal: React.FC<SecurityAuditModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  theme,
}) => {
  const [auditData, setAuditData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  const isDark = theme === 'dark';

  useEffect(() => {
    if (isOpen) {
      loadAudit();
      setTestResult(null);
    }
  }, [isOpen]);

  const loadAudit = async () => {
    try {
      setLoading(true);
      const res = await api.getSecurityAudit();
      setAuditData(res);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const runDirectApiBreachTest = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      const token = getToken();

      // Attempt to directly read a private conversation of other users: conv-rina-dimas
      const targetConvId = 'conv-rina-dimas';
      const response = await fetch(`/api/conversations/${targetConvId}/messages`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const body = await response.json();
      setTestResult({
        status: response.status,
        statusText: response.statusText,
        blocked: response.status === 403,
        url: `/api/conversations/${targetConvId}/messages`,
        responseBody: body,
      });
    } catch (err: any) {
      setTestResult({
        status: 500,
        blocked: false,
        error: err.message,
      });
    } finally {
      setTesting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs">
      <div
        className={`w-full max-w-xl rounded-2xl shadow-2xl border flex flex-col max-h-[90vh] overflow-hidden ${
          isDark
            ? 'bg-zinc-900 border-zinc-800 text-white'
            : 'bg-white border-zinc-200 text-zinc-900'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-b ${
            isDark ? 'border-zinc-800' : 'border-zinc-100'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Verifikasi Keamanan Akses Data</h2>
              <p className="text-xs text-zinc-400">Pengujian Syarat Wajib #5 (Isolasi Database & API)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`text-sm px-3 py-1 rounded-md transition-colors ${
              isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-zinc-500 hover:text-black hover:bg-zinc-100'
            }`}
          >
            Tutup
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* Requirement info card */}
          <div
            className={`p-4 rounded-xl border ${
              isDark ? 'bg-zinc-800/50 border-zinc-700/60' : 'bg-zinc-50 border-zinc-200'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Bunyi Aturan Wajib #5
                </h4>
                <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                  &ldquo;Satu akun hanya bisa membaca percakapan miliknya sendiri. Ini berlaku juga bila data diakses langsung lewat API atau database, bukan hanya disembunyikan di tampilan.&rdquo;
                </p>
              </div>
            </div>
          </div>

          {/* Current user session audit */}
          {auditData && (
            <div className="grid grid-cols-2 gap-3">
              <div
                className={`p-3.5 rounded-xl border ${
                  isDark ? 'bg-zinc-800/30 border-zinc-800' : 'bg-zinc-50/70 border-zinc-200'
                }`}
              >
                <div className="text-xs text-zinc-400 font-medium">Percakapan Berhak Diakses</div>
                <div className="text-2xl font-black mt-1 text-emerald-500">
                  {auditData.accessibleCount}
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5">
                  Akun: {currentUser?.name}
                </div>
              </div>
              <div
                className={`p-3.5 rounded-xl border ${
                  isDark ? 'bg-zinc-800/30 border-zinc-800' : 'bg-zinc-50/70 border-zinc-200'
                }`}
              >
                <div className="text-xs text-zinc-400 font-medium">Percakapan Akun Lain (Terisolasi)</div>
                <div className="text-2xl font-black mt-1 text-amber-500">
                  {auditData.blockedInaccessibleCount}
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5">
                  Otomatis diblokir server
                </div>
              </div>
            </div>
          )}

          {/* Interactive API Breach Simulation */}
          <div
            className={`p-4 rounded-xl border ${
              isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-900 border-zinc-900 text-white'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span className="font-mono text-xs font-semibold text-emerald-400">
                  Simulasi Pengujian Direct API Bypass
                </span>
              </div>
              <button
                onClick={runDirectApiBreachTest}
                disabled={testing}
                className="px-3 py-1.5 rounded-lg bg-emerald-500 text-black font-bold text-xs flex items-center gap-1.5 hover:bg-emerald-400 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-black" />}
                Jalankan Tes API
              </button>
            </div>
            <p className="text-xs text-zinc-400 mb-3">
              Mencoba melakukan request langsung ke endpoint chat rahasia pengguna lain (<code className="text-zinc-200">/api/conversations/conv-rina-dimas/messages</code>) menggunakan token akun Anda yang sedang login saat ini.
            </p>

            {testResult ? (
              <div className="font-mono text-xs p-3 rounded-lg bg-black/80 border border-zinc-800 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500">HTTP Status:</span>
                  <span
                    className={`px-2 py-0.5 rounded font-bold ${
                      testResult.status === 403
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    {testResult.status} {testResult.statusText || 'Forbidden'}
                  </span>
                  {testResult.status === 403 && (
                    <span className="text-emerald-400 text-[11px] font-sans flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Berhasil dicegah di Backend!
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-zinc-500">Response Body:</span>
                  <pre className="text-zinc-300 mt-1 whitespace-pre-wrap break-all text-[11px] bg-zinc-900/90 p-2 rounded">
                    {JSON.stringify(testResult.responseBody, null, 2)}
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

        {/* Footer */}
        <div
          className={`px-6 py-3.5 border-t flex justify-end ${
            isDark ? 'border-zinc-800' : 'border-zinc-100'
          }`}
        >
          <button
            onClick={onClose}
            className={`px-5 py-2 text-xs font-bold rounded-xl ${
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
