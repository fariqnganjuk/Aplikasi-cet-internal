import React, { useState, useEffect } from 'react';
import { Search, X, Check, Loader2, User as UserIcon } from 'lucide-react';
import { User } from '../types/chat';
import { api } from '../services/api';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (user: User) => Promise<void>;
  theme: 'light' | 'dark';
}

export const NewChatModal: React.FC<NewChatModalProps> = ({
  isOpen,
  onClose,
  onSelectUser,
  theme,
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isDark = theme === 'dark';

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedUser(null);
      setError('');
      loadUsers();
    }
  }, [isOpen]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.getUsers();
      setUsers(res.users);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat daftar pengguna.');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase().trim();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const handleSubmit = async () => {
    if (!selectedUser) return;
    try {
      setSubmitting(true);
      setError('');
      await onSelectUser(selectedUser);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal memulai percakapan.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity">
      <div
        className={`w-full max-w-md rounded-2xl shadow-2xl border flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${
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
          <h2 className="text-lg font-bold">Chat baru</h2>
          <button
            onClick={onClose}
            className={`text-sm px-2.5 py-1 rounded-md transition-colors ${
              isDark
                ? 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                : 'text-zinc-500 hover:text-black hover:bg-zinc-100'
            }`}
          >
            Tutup
          </button>
        </div>

        {/* Search bar */}
        <div className="p-4 border-b border-inherit">
          <div className="relative">
            <Search
              className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${
                isDark ? 'text-zinc-400' : 'text-zinc-400'
              }`}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama atau email..."
              className={`w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border outline-none transition-all ${
                isDark
                  ? 'bg-zinc-800/80 border-zinc-700 text-white placeholder-zinc-500 focus:border-white focus:ring-1 focus:ring-white'
                  : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:border-black focus:ring-1 focus:ring-black'
              }`}
            />
          </div>
          <p className="mt-2 text-xs text-zinc-400">
            * Hanya pengguna terdaftar yang muncul di daftar ini.
          </p>
        </div>

        {/* User list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-[220px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
              <Loader2 className="w-6 h-6 animate-spin mb-2" />
              <span className="text-xs">Memuat pengguna terdaftar...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
              <UserIcon className="w-8 h-8 stroke-1 mb-2 opacity-60" />
              <p className="text-sm">Tidak ada pengguna yang cocok.</p>
            </div>
          ) : (
            filteredUsers.map((user, index) => {
              const isSelected = selectedUser?.id === user.id;
              const userKey = user.id ? `${user.id}-${index}` : `user-${index}`;
              return (
                <div
                  key={userKey}
                  onClick={() => setSelectedUser(user)}
                  className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                    isSelected
                      ? isDark
                        ? 'bg-zinc-800 border border-zinc-700 ring-1 ring-zinc-500'
                        : 'bg-zinc-100 border border-zinc-300 ring-1 ring-black'
                      : isDark
                      ? 'hover:bg-zinc-800/60 border border-transparent'
                      : 'hover:bg-zinc-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="relative">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                          isDark ? 'bg-zinc-700' : 'bg-zinc-800'
                        }`}
                      >
                        {user.initials}
                      </div>
                      {user.isOnline && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-900" />
                      )}
                    </div>

                    <div className="text-left">
                      <h4 className="text-sm font-bold leading-tight">{user.name}</h4>
                      <p className="text-xs text-zinc-400 leading-tight mt-0.5">{user.email}</p>
                    </div>
                  </div>

                  {/* Radio button / Check */}
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                      isSelected
                        ? isDark
                          ? 'border-white bg-white text-black'
                          : 'border-black bg-black text-white'
                        : isDark
                        ? 'border-zinc-600'
                        : 'border-zinc-300'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="px-6 py-2 bg-amber-500/10 border-t border-amber-500/20 text-amber-500 text-xs text-center font-medium">
            {error}
          </div>
        )}

        {/* Footer */}
        <div
          className={`px-6 py-4 border-t flex items-center justify-end gap-3 ${
            isDark ? 'border-zinc-800' : 'border-zinc-100'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
              isDark
                ? 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                : 'text-zinc-600 hover:text-black hover:bg-zinc-100'
            }`}
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!selectedUser || submitting}
            className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              isDark
                ? 'bg-white text-black hover:bg-zinc-200 active:scale-98'
                : 'bg-black text-white hover:bg-zinc-800 active:scale-98'
            }`}
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Mulai chat
          </button>
        </div>
      </div>
    </div>
  );
};
