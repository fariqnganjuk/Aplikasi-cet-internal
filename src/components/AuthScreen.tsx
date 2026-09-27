'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle, LogIn, UserPlus, CheckCircle2 } from 'lucide-react';
import { AkseleraLogo } from './AkseleraLogo';
import { ThemeToggle } from './ThemeToggle';
import { api } from '../services/api';
import { useTheme } from '../hooks/useTheme';

const DEMO_ACCOUNTS = [
  { name: 'Andi Pratama', email: 'andi@contoh.id' },
  { name: 'Rina Kartika', email: 'rina@contoh.id' },
];

export default function AuthScreen() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isDark = theme === 'dark';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Email dan password wajib diisi.');
      return;
    }
    if (mode === 'register' && !name) {
      setError('Nama lengkap wajib diisi.');
      return;
    }

    try {
      setLoading(true);
      if (mode === 'login') {
        await api.login(email, password);
      } else {
        await api.register(name, email, password);
      }
      router.replace('/');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat memproses permintaan.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (demoEmail: string) => {
    setMode('login');
    setEmail(demoEmail);
    setPassword('password123');
    setError('');
  };

  const fieldClass = `w-full px-4 py-2.5 text-sm rounded-xl border outline-none transition-all ${
    isDark
      ? 'bg-zinc-900 border-zinc-800 text-white placeholder-zinc-500 focus:border-white'
      : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:border-black'
  }`;

  return (
    <div
      className={`min-h-screen w-full flex flex-col transition-colors duration-200 ${
        isDark ? 'bg-black text-white' : 'bg-white text-black'
      }`}
    >
      <header className="w-full max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <AkseleraLogo theme={theme} size="lg" />
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div
          className={`w-full max-w-md rounded-2xl p-8 border transition-all ${
            isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-200'
          }`}
        >
          <div className="mb-6">
            <h1 className="text-2xl font-black tracking-tight">
              {mode === 'login' ? 'Masuk' : 'Daftar Akun'}
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
              {mode === 'login'
                ? 'Gunakan akun Anda untuk masuk ke sistem chat internal Akselera.Tech.'
                : 'Buat akun baru untuk mulai berkomunikasi dengan tim internal.'}
            </p>
          </div>

          {error && (
            <div
              className={`mb-5 p-3.5 rounded-xl border text-xs flex items-center gap-2.5 ${
                isDark
                  ? 'bg-zinc-900 border-zinc-700 text-white'
                  : 'bg-zinc-100 border-black text-black'
              }`}
              role="alert"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-semibold">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label
                  htmlFor="name"
                  className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5"
                >
                  Nama Lengkap
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Misal: Andi Pratama"
                  autoComplete="name"
                  required
                  className={fieldClass}
                />
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="andi@contoh.id"
                autoComplete="email"
                required
                className={fieldClass}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                className={fieldClass}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50 mt-2 ${
                isDark ? 'bg-white text-black hover:bg-zinc-200' : 'bg-black text-white hover:bg-zinc-800'
              }`}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mode === 'login' ? (
                <>
                  <span>Masuk</span>
                  <LogIn className="w-4 h-4" />
                </>
              ) : (
                <>
                  <span>Daftar Akun Baru</span>
                  <UserPlus className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError('');
              }}
              className="text-xs text-zinc-500 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
            >
              {mode === 'login' ? (
                <span>
                  Belum punya akun? <strong className="underline">Daftar akun baru</strong>
                </span>
              ) : (
                <span>
                  Sudah punya akun? <strong className="underline">Masuk di sini</strong>
                </span>
              )}
            </button>
          </div>

          <div
            className={`mt-6 pt-5 border-t ${
              isDark ? 'border-zinc-800' : 'border-zinc-100'
            }`}
          >
            <div className="text-xs font-bold text-zinc-500 mb-2.5">
              Akun uji coba (klik untuk isi cepat):
            </div>

            <div className="grid grid-cols-2 gap-2 text-left">
              {DEMO_ACCOUNTS.map((account) => {
                const isActive = email === account.email;
                return (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => handleQuickLogin(account.email)}
                    className={`p-2.5 rounded-xl border text-xs transition-all cursor-pointer ${
                      isActive
                        ? isDark
                          ? 'bg-zinc-800 border-white text-white'
                          : 'bg-zinc-100 border-black text-black'
                        : isDark
                        ? 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    <div className="font-bold flex items-center justify-between gap-1">
                      <span className="truncate">{account.name}</span>
                      {isActive && <CheckCircle2 className="w-3 h-3 shrink-0" />}
                    </div>
                    <div className="text-[10px] text-zinc-500 truncate">{account.email}</div>
                  </button>
                );
              })}
            </div>

            <div className="mt-2 text-center text-[10px] text-zinc-500">
              Password default semua akun: <code className="font-mono font-bold">password123</code>
            </div>
          </div>
        </div>

        <p className="mt-8 text-xs text-zinc-500 text-center max-w-sm">
          Akselera.Tech - Aplikasi Chat Internal.
        </p>
      </main>
    </div>
  );
}
