import React, { useState } from 'react';
import { Search, Plus, LogOut, ShieldCheck, UserCheck, MessageSquare } from 'lucide-react';
import { Conversation, User } from '../types/chat';
import { AkseleraLogo } from './AkseleraLogo';
import { ThemeToggle } from './ThemeToggle';

interface ChatSidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onOpenNewChat: () => void;
  onOpenSecurityAudit: () => void;
  currentUser: User | null;
  onLogout: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onOpenNewChat,
  onOpenSecurityAudit,
  currentUser,
  onLogout,
  theme,
  onToggleTheme,
}) => {
  const [search, setSearch] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);

  const isDark = theme === 'dark';

  const formatMessageTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();

    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(':', '.');
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    if (isYesterday) return 'Kemarin';

    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const diffDays = Math.round((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 7) {
      return days[date.getDay()];
    }

    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  };

  const filteredConversations = conversations.filter((c) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const nameMatch = c.otherUser.name.toLowerCase().includes(q);
    const emailMatch = c.otherUser.email.toLowerCase().includes(q);
    const messageMatch = c.lastMessage?.text.toLowerCase().includes(q);
    return nameMatch || emailMatch || messageMatch;
  });

  return (
    <aside
      className={`w-full md:w-80 lg:w-96 h-full flex flex-col border-r transition-colors duration-200 select-none ${
        isDark
          ? 'bg-zinc-950 border-zinc-800 text-white'
          : 'bg-white border-zinc-200 text-zinc-900'
      }`}
    >
      {/* Top Header Bar */}
      <div
        className={`px-4 py-3.5 flex items-center justify-between border-b ${
          isDark ? 'border-zinc-800 bg-zinc-950' : 'border-zinc-100 bg-white'
        }`}
      >
        <div className="flex items-center gap-2">
          <AkseleraLogo theme={theme} size="md" />
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />

          {/* User profile button & popup */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className={`flex items-center gap-2 p-1 pl-2 rounded-full border transition-all cursor-pointer ${
                isDark
                  ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-200'
                  : 'bg-zinc-50 border-zinc-200 hover:border-zinc-300 text-zinc-800'
              }`}
            >
              <span className="text-xs font-bold max-w-[90px] truncate hidden sm:inline">
                {currentUser?.name}
              </span>
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  isDark ? 'bg-zinc-700 text-white' : 'bg-black text-white'
                }`}
              >
                {currentUser?.initials || 'ME'}
              </div>
            </button>

            {showUserMenu && (
              <div
                className={`absolute right-0 mt-2 w-56 rounded-2xl shadow-xl border py-1.5 z-40 animate-in fade-in duration-100 ${
                  isDark
                    ? 'bg-zinc-900 border-zinc-800 text-white'
                    : 'bg-white border-zinc-200 text-zinc-800'
                }`}
              >
                <div className="px-4 py-2.5 border-b border-inherit">
                  <p className="text-xs font-bold leading-tight">{currentUser?.name}</p>
                  <p className="text-[11px] text-zinc-400 truncate mt-0.5">{currentUser?.email}</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[10px] text-emerald-500 font-semibold uppercase tracking-wider">
                      Aktif Online
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    onOpenSecurityAudit();
                  }}
                  className={`w-full text-left px-4 py-2.5 text-xs flex items-center gap-2.5 transition-colors cursor-pointer ${
                    isDark ? 'hover:bg-zinc-800 text-emerald-400' : 'hover:bg-zinc-50 text-emerald-700'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Verifikasi Keamanan (Aturan #5)</span>
                </button>

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    onLogout();
                  }}
                  className={`w-full text-left px-4 py-2 text-xs flex items-center gap-2.5 transition-colors cursor-pointer ${
                    isDark ? 'hover:bg-rose-500/10 text-rose-400' : 'hover:bg-rose-50 text-rose-600'
                  }`}
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>Keluar (Logout)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Bar: Search & New Chat Button */}
      <div className="p-3.5 space-y-2.5">
        <div className="flex items-center gap-2">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search
              className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
                isDark ? 'text-zinc-500' : 'text-zinc-400'
              }`}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari chat"
              className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border outline-none transition-all ${
                isDark
                  ? 'bg-zinc-900 border-zinc-800 text-white placeholder-zinc-500 focus:border-zinc-600'
                  : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:border-zinc-400'
              }`}
            />
          </div>

          {/* New Chat Button */}
          <button
            onClick={onOpenNewChat}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer active:scale-95 ${
              isDark
                ? 'bg-white text-black hover:bg-zinc-200'
                : 'bg-black text-white hover:bg-zinc-800'
            }`}
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>+ Chat baru</span>
          </button>
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-2 space-y-1">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <MessageSquare className="w-8 h-8 text-zinc-400 stroke-1 mb-2 opacity-60" />
            <p className="text-xs text-zinc-400 font-medium">
              {search ? 'Tidak ada percakapan yang cocok' : 'Belum ada percakapan'}
            </p>
            {!search && (
              <button
                onClick={onOpenNewChat}
                className="mt-3 text-xs text-emerald-500 font-bold hover:underline cursor-pointer"
              >
                Mulai chat pertama
              </button>
            )}
          </div>
        ) : (
          filteredConversations.map((conv, index) => {
            const isActive = conv.id === activeConversationId;
            const timeStr = formatMessageTime(conv.lastMessage?.createdAt || conv.updatedAt);
            const convKey = conv.id ? `${conv.id}-${index}` : `conv-${index}`;

            return (
              <div
                key={convKey}
                onClick={() => onSelectConversation(conv.id)}
                className={`relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-150 ${
                  isActive
                    ? isDark
                      ? 'bg-zinc-800/90 text-white shadow-xs'
                      : 'bg-zinc-100 text-black shadow-xs'
                    : isDark
                    ? 'hover:bg-zinc-900/80 text-zinc-300 hover:text-white'
                    : 'hover:bg-zinc-50 text-zinc-700 hover:text-black'
                }`}
              >
                {/* User Avatar */}
                <div className="relative shrink-0">
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center text-xs font-black select-none ${
                      isActive
                        ? isDark
                          ? 'bg-zinc-700 text-white ring-2 ring-white/20'
                          : 'bg-zinc-900 text-white ring-2 ring-black/10'
                        : isDark
                        ? 'bg-zinc-800 text-zinc-200'
                        : 'bg-zinc-200 text-zinc-800'
                    }`}
                  >
                    {conv.otherUser.initials}
                  </div>
                  {conv.otherUser.isOnline && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-950" />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <h3
                      className={`text-xs font-bold truncate ${
                        isActive
                          ? isDark
                            ? 'text-white'
                            : 'text-black'
                          : isDark
                          ? 'text-zinc-200'
                          : 'text-zinc-900'
                      }`}
                    >
                      {conv.otherUser.name}
                    </h3>
                    <span
                      className={`text-[11px] shrink-0 ${
                        conv.unreadCount > 0
                          ? isDark
                            ? 'text-white font-bold'
                            : 'text-black font-bold'
                          : 'text-zinc-400'
                      }`}
                    >
                      {timeStr}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={`text-xs truncate ${
                        conv.unreadCount > 0
                          ? isDark
                            ? 'text-zinc-200 font-semibold'
                            : 'text-zinc-900 font-semibold'
                          : 'text-zinc-400'
                      }`}
                    >
                      {conv.lastMessage?.text || 'Mulai percakapan baru'}
                    </p>

                    {/* Unread badge */}
                    {conv.unreadCount > 0 && (
                      <span
                        className={`inline-flex items-center justify-center min-w-4 h-4 px-1.5 text-[10px] font-black rounded-full shrink-0 ${
                          isDark
                            ? 'bg-white text-black'
                            : 'bg-black text-white'
                        }`}
                      >
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Footer Info */}
      <div
        className={`px-4 py-2.5 border-t text-[11px] flex items-center justify-between ${
          isDark ? 'border-zinc-800 text-zinc-500 bg-zinc-950' : 'border-zinc-100 text-zinc-400 bg-white'
        }`}
      >
        <span>Akselera.Tech Chat</span>
        <button
          onClick={onOpenSecurityAudit}
          className="hover:underline flex items-center gap-1 cursor-pointer font-medium"
        >
          <ShieldCheck className="w-3 h-3 text-emerald-500" />
          <span>Isolasi Aktif</span>
        </button>
      </div>
    </aside>
  );
};
