'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChatSidebar } from './components/ChatSidebar';
import { ChatWindow } from './components/ChatWindow';
import { NewChatModal } from './components/NewChatModal';
import { SecurityAuditModal } from './components/SecurityAuditModal';
import { Conversation, User } from './types/chat';
import { api } from './services/api';
import { useTheme } from './hooks/useTheme';
import { Loader2 } from 'lucide-react';

interface Props {
  initialUser: User;
}

export default function App({ initialUser }: Props) {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const currentUser = initialUser;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isSecurityAuditOpen, setIsSecurityAuditOpen] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  const loadConversations = useCallback(async () => {
    try {
      const res = await api.getConversations();
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
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!currentUser) return;

    const interval = setInterval(() => loadConversations(), 2000);

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

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    setMobileView('chat');
  };

  const handleBackToList = () => {
    setMobileView('list');
  };

  const handleStartNewChatWithUser = async (user: User) => {
    const res = await api.startConversation(user.id);
    await loadConversations();
    setActiveConversationId(res.conversationId);
    setMobileView('chat');
  };

  const handleLogout = async () => {
    await api.logout();
    router.replace('/login');
    router.refresh();
  };

  const activeConversation =
    conversations.find((c) => c.id === activeConversationId) || null;

  return (
    <div
      className={`h-screen w-screen overflow-hidden flex flex-col transition-colors duration-200 ${
        theme === 'dark' ? 'bg-black text-white' : 'bg-white text-black'
      }`}
    >
      <div className="flex-1 flex w-full h-full overflow-hidden">
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
            onToggleTheme={toggleTheme}
          />
        </div>

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

      <NewChatModal
        isOpen={isNewChatOpen}
        onClose={() => setIsNewChatOpen(false)}
        onSelectUser={handleStartNewChatWithUser}
        theme={theme}
      />

      <SecurityAuditModal
        isOpen={isSecurityAuditOpen}
        onClose={() => setIsSecurityAuditOpen(false)}
        currentUser={currentUser}
        theme={theme}
      />
    </div>
  );
}
