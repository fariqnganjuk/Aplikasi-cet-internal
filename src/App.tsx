/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { ChatSidebar } from './components/ChatSidebar';
import { ChatWindow } from './components/ChatWindow';
import { NewChatModal } from './components/NewChatModal';
import { SecurityAuditModal } from './components/SecurityAuditModal';
import { Conversation, User } from './types/chat';
import {
  api,
  getStoredTheme,
  setStoredTheme,
  getStoredUser,
  getToken,
  clearSession,
} from './services/api';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  // Chat states
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isSecurityAuditOpen, setIsSecurityAuditOpen] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  // Initialize theme
  useEffect(() => {
    const savedTheme = getStoredTheme();
    setTheme(savedTheme);
    applyThemeClass(savedTheme);
  }, []);

  const applyThemeClass = (currentTheme: 'light' | 'dark') => {
    if (currentTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleToggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    setStoredTheme(nextTheme);
    applyThemeClass(nextTheme);
  };

  // Check auth status on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = getToken();
      if (!token) {
        setInitializing(false);
        return;
      }

      try {
        const res = await api.getMe();
        setCurrentUser(res.user);
      } catch (err) {
        console.error('Session expired:', err);
        clearSession();
        setCurrentUser(null);
      } finally {
        setInitializing(false);
      }
    };

    checkAuth();

    const handleUnauthorized = () => {
      setCurrentUser(null);
      setActiveConversationId(null);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  // Fetch conversations
  const loadConversations = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await api.getConversations();
      // Ensure deduplication by conversation id
      const seen = new Set<string>();
      const uniqueConvs: Conversation[] = [];
      for (const c of res.conversations) {
        if (c && c.id && !seen.has(c.id)) {
          seen.add(c.id);
          uniqueConvs.push(c);
        }
      }
      setConversations(uniqueConvs);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      loadConversations();
    } else {
      setConversations([]);
      setActiveConversationId(null);
    }
  }, [currentUser, loadConversations]);

  // Real-time synchronization
  useEffect(() => {
    if (!currentUser) return;

    // Fast polling fallback for instant cross-tab/cross-user updates
    const interval = setInterval(() => {
      loadConversations();
    }, 2000);

    // Server-Sent Events listener
    const unsubscribe = api.subscribeToEvents((event) => {
      if (event.type === 'NEW_MESSAGE' || event.type === 'MESSAGES_READ') {
        loadConversations();
      }
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [currentUser, loadConversations]);

  // Handlers
  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    setMobileView('chat');
  };

  const handleBackToList = () => {
    setMobileView('list');
  };

  const handleStartNewChatWithUser = async (user: User) => {
    try {
      const res = await api.startConversation(user.id);
      await loadConversations();
      setActiveConversationId(res.conversationId);
      setMobileView('chat');
    } catch (err: any) {
      console.error('Failed to start chat:', err);
      throw err;
    }
  };

  const handleLogout = async () => {
    await api.logout();
    setCurrentUser(null);
    setActiveConversationId(null);
    setConversations([]);
  };

  // Find active conversation object
  const activeConversation =
    conversations.find((c) => c.id === activeConversationId) || null;

  // Initial loading state
  if (initializing) {
    return (
      <div
        className={`min-h-screen w-full flex flex-col items-center justify-center transition-colors ${
          theme === 'dark' ? 'bg-zinc-950 text-white' : 'bg-white text-zinc-900'
        }`}
      >
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400 mb-3" />
        <p className="text-xs text-zinc-400 font-medium">Memuat Akselera.Tech Chat...</p>
      </div>
    );
  }

  // Not logged in -> Show Auth Screen (Layar 1)
  if (!currentUser) {
    return (
      <AuthScreen
        onSuccess={(user) => {
          setCurrentUser(user);
        }}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />
    );
  }

  // Logged in -> Show Chat Two-Panel Interface (Layar 2 & Layar 4)
  return (
    <div
      className={`h-screen w-screen overflow-hidden flex flex-col transition-colors duration-200 ${
        theme === 'dark' ? 'bg-zinc-950 text-white' : 'bg-white text-zinc-900'
      }`}
    >
      <div className="flex-1 flex w-full h-full overflow-hidden">
        {/* Left Sidebar (Desktop: always visible, Mobile: visible only if list mode) */}
        <div
          className={`${
            mobileView === 'chat' ? 'hidden md:flex' : 'flex'
          } w-full md:w-auto h-full shrink-0`}
        >
          <ChatSidebar
            conversations={conversations}
            activeConversationId={activeConversationId}
            onSelectConversation={handleSelectConversation}
            onOpenNewChat={() => setIsNewChatOpen(true)}
            onOpenSecurityAudit={() => setIsSecurityAuditOpen(true)}
            currentUser={currentUser}
            onLogout={handleLogout}
            theme={theme}
            onToggleTheme={handleToggleTheme}
          />
        </div>

        {/* Right Window (Desktop: always visible, Mobile: visible only if chat mode) */}
        <div
          className={`${
            mobileView === 'list' ? 'hidden md:flex' : 'flex'
          } flex-1 h-full min-w-0`}
        >
          <ChatWindow
            conversation={activeConversation}
            currentUser={currentUser}
            onBackToList={handleBackToList}
            theme={theme}
          />
        </div>
      </div>

      {/* Modal: New Chat (Layar 3) */}
      <NewChatModal
        isOpen={isNewChatOpen}
        onClose={() => setIsNewChatOpen(false)}
        onSelectUser={handleStartNewChatWithUser}
        theme={theme}
      />

      {/* Modal: Security Audit & Aturan #5 Verification */}
      <SecurityAuditModal
        isOpen={isSecurityAuditOpen}
        onClose={() => setIsSecurityAuditOpen(false)}
        currentUser={currentUser}
        theme={theme}
      />
    </div>
  );
}
