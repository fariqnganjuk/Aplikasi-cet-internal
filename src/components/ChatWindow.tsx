import React, { useState, useEffect, useRef } from 'react';
import { Send, ArrowLeft, ShieldCheck, CheckCheck, Loader2, MessageSquareDashed } from 'lucide-react';
import { Conversation, Message, User } from '../types/chat';
import { api } from '../services/api';

interface ChatWindowProps {
  conversation: Conversation | null;
  currentUser: User | null;
  onBackToList: () => void;
  theme: 'light' | 'dark';
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  conversation,
  currentUser,
  onBackToList,
  theme,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isDark = theme === 'dark';

  // Helper to deduplicate messages by id
  const deduplicateMessages = (msgs: Message[]): Message[] => {
    const seen = new Set<string>();
    const result: Message[] = [];
    for (const m of msgs) {
      if (m && m.id) {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          result.push(m);
        }
      } else if (m) {
        result.push(m);
      }
    }
    return result;
  };

  // Load messages whenever conversation changes
  useEffect(() => {
    if (!conversation) {
      setMessages([]);
      return;
    }

    let isMounted = true;

    const fetchMessages = async () => {
      try {
        setLoading(true);
        const res = await api.getMessages(conversation.id);
        if (isMounted) {
          setMessages(deduplicateMessages(res.messages));
          // Mark messages as read
          api.markAsRead(conversation.id).catch(() => {});
        }
      } catch (err) {
        console.error('Error fetching messages:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchMessages();

    // Auto-focus input
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);

    return () => {
      isMounted = false;
    };
  }, [conversation?.id]);

  // Real-time listener: Listen to incoming messages or poll every 1.5 seconds as a reliable background fallback
  useEffect(() => {
    if (!conversation) return;

    const interval = setInterval(async () => {
      try {
        const res = await api.getMessages(conversation.id);
        setMessages((prev) => {
          const incoming = deduplicateMessages(res.messages);
          if (incoming.length !== prev.length || 
              (incoming.length > 0 && prev.length > 0 && incoming[incoming.length - 1].id !== prev[prev.length - 1].id)) {
            // Also mark read
            api.markAsRead(conversation.id).catch(() => {});
            return incoming;
          }
          return prev;
        });
      } catch {
        // silent
      }
    }, 1500);

    // Also subscribe to Server-Sent Events
    const unsubscribe = api.subscribeToEvents((event) => {
      if (event.type !== 'NEW_MESSAGE') return;
      const payload = event.payload as { conversationId?: string; message?: Message } | undefined;
      if (payload?.conversationId !== conversation.id || !payload?.message) return;
      const newMsg = payload.message;
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return deduplicateMessages([...prev, newMsg]);
      });
      api.markAsRead(conversation.id).catch(() => {});
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [conversation?.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || !conversation || sending) return;

    setInputText('');
    setSending(true);

    try {
      const res = await api.sendMessage(conversation.id, text);
      setMessages((prev) => {
        if (prev.some((m) => m.id === res.message.id)) return prev;
        return [...prev, res.message];
      });
    } catch (err: any) {
      console.error('Failed to send message:', err);
      // restore text on error
      setInputText(text);
    } finally {
      setSending(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  };

  const formatMessageTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(':', '.');
  };

  // Group messages by day for "Hari ini", "Kemarin", etc.
  const formatDayDivider = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    if (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    ) {
      return 'Hari ini';
    }
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear()
    ) {
      return 'Kemarin';
    }
    return d.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    });
  };

  // If no conversation selected: Render Empty State (Mockup Screen 2)
  if (!conversation) {
    return (
      <main
        className={`flex-1 h-full flex flex-col items-center justify-center p-8 text-center transition-colors duration-200 ${
          isDark ? 'bg-zinc-950 text-white' : 'bg-white text-zinc-900'
        }`}
      >
        <div
          className={`w-24 h-20 rounded-2xl flex items-center justify-center mb-6 border shadow-xs ${
            isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
          }`}
        >
          <div className="flex flex-col gap-2 w-12 items-center">
            <span
              className={`w-10 h-2.5 rounded-full ${
                isDark ? 'bg-zinc-700' : 'bg-zinc-300'
              }`}
            />
            <span
              className={`w-7 h-2.5 rounded-full ${
                isDark ? 'bg-zinc-700' : 'bg-zinc-300'
              }`}
            />
          </div>
        </div>

        <h2 className="text-base font-bold tracking-tight mb-1.5">
          Pilih percakapan atau mulai chat baru
        </h2>
        <p className="text-xs text-zinc-400 max-w-sm">
          Daftar hanya berisi percakapan milik akun yang login.
        </p>

        <div className="mt-8 flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-medium border bg-zinc-500/5 text-zinc-500 border-zinc-500/20">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Isolasi Data API & Database Aktif (Fitur Wajib #5)</span>
        </div>
      </main>
    );
  }

  // Active Chat Screen (Mockup Screen 4)
  return (
    <main
      className={`flex-1 h-full flex flex-col min-w-0 transition-colors duration-200 ${
        isDark ? 'bg-zinc-950 text-white' : 'bg-white text-zinc-900'
      }`}
    >
      {/* Chat Header */}
      <header
        className={`px-4 sm:px-6 py-3 border-b flex items-center justify-between shrink-0 ${
          isDark ? 'border-zinc-800 bg-zinc-950' : 'border-zinc-100 bg-white'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Back button for mobile */}
          <button
            onClick={onBackToList}
            aria-label="Kembali ke daftar chat"
            className={`p-1.5 -ml-1 rounded-lg md:hidden transition-colors cursor-pointer ${
              isDark ? 'hover:bg-zinc-800 text-zinc-300' : 'hover:bg-zinc-100 text-zinc-600'
            }`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Recipient Avatar */}
          <div className="relative shrink-0">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black select-none ${
                isDark ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-200 text-zinc-800'
              }`}
            >
              {conversation.otherUser.initials}
            </div>
            {conversation.otherUser.isOnline && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-zinc-500 ring-2 ring-white dark:ring-zinc-950" />
            )}
          </div>

          {/* Recipient Name and Subtitle */}
          <div className="min-w-0">
            <h2 className="text-sm font-bold truncate leading-tight">
              {conversation.otherUser.name}
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-zinc-400 mt-0.5">
              <span className="truncate">{conversation.otherUser.email}</span>
              {conversation.otherUser.isOnline && (
                <>
                  <span>•</span>
                  <span className="text-zinc-500 font-medium">Online</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Security badge in header */}
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md border text-zinc-500 border-zinc-200 dark:border-zinc-800">
          <ShieldCheck className="w-3.5 h-3.5 text-zinc-500" />
          <span>Tersimpan di database</span>
        </div>
      </header>

      {/* Messages List Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {loading && messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
            <Loader2 className="w-6 h-6 animate-spin mb-2" />
            <span className="text-xs">Memuat percakapan...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <MessageSquareDashed className="w-10 h-10 text-zinc-400 stroke-1 mb-2" />
            <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
              Belum ada pesan sebelumnya
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              Kirim pesan di bawah untuk memulai percakapan dengan {conversation.otherUser.name}.
            </p>
          </div>
        ) : (
          <>
            {/* Date divider */}
            <div className="flex items-center justify-center my-2">
              <span
                className={`text-[11px] px-3 py-1 rounded-full font-medium ${
                  isDark
                    ? 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                    : 'bg-zinc-100 text-zinc-500'
                }`}
              >
                {formatDayDivider(messages[0]?.createdAt || new Date().toISOString())}
              </span>
            </div>

            {/* Message Bubbles */}
            {deduplicateMessages(messages).map((msg, index) => {
              const isMe = msg.senderId === currentUser?.id;
              const timeString = formatMessageTime(msg.createdAt);
              const messageKey = msg.id ? `${msg.id}-${index}` : `msg-${index}`;

              return (
                <div
                  key={messageKey}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-[70%] px-4 py-2.5 rounded-2xl relative shadow-xs transition-all ${
                      isMe
                        ? isDark
                          ? 'bg-white text-black rounded-tr-xs'
                          : 'bg-black text-white rounded-tr-xs'
                        : isDark
                        ? 'bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-tl-xs'
                        : 'bg-zinc-100 text-zinc-900 rounded-tl-xs'
                    }`}
                  >
                    {/* Message Text */}
                    <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {msg.text}
                    </p>

                    {/* Timestamp & Read Status */}
                    <div
                      className={`flex items-center justify-end gap-1 mt-1 text-[10px] select-none ${
                        isMe
                          ? isDark
                            ? 'text-zinc-600'
                            : 'text-zinc-400'
                          : 'text-zinc-400'
                      }`}
                    >
                      <span>{timeString}</span>
                      {isMe && (
                        <CheckCheck
                          className={`w-3.5 h-3.5 ${
                            msg.isRead ? (isDark ? 'text-black' : 'text-zinc-600') : 'opacity-70'
                          }`}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Message Area */}
      <footer
        className={`p-3 sm:p-4 border-t shrink-0 ${
          isDark ? 'border-zinc-800 bg-zinc-950' : 'border-zinc-100 bg-white'
        }`}
      >
        <form onSubmit={handleSend} className="flex items-center gap-2 max-w-4xl mx-auto">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Tulis pesan..."
            disabled={sending}
            className={`flex-1 px-4 py-2.5 text-xs sm:text-sm rounded-full border outline-none transition-all ${
              isDark
                ? 'bg-zinc-900 border-zinc-800 text-white placeholder-zinc-500 focus:border-white focus:ring-1 focus:ring-white'
                : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:border-black focus:ring-1 focus:ring-black'
            }`}
          />
          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            className={`px-5 py-2.5 text-xs sm:text-sm font-bold rounded-full transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
              isDark
                ? 'bg-white text-black hover:bg-zinc-200'
                : 'bg-black text-white hover:bg-zinc-800'
            }`}
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Kirim</span>
                <Send className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>
      </footer>
    </main>
  );
};
