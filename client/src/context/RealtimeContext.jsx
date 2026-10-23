import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { createSocket } from '../socket/socket';
import { chatApi } from '../api';

const RealtimeContext = createContext(null);

/** Socket connection + live notifications + chat unread counts, shared by the whole app. */
export function RealtimeProvider({ children }) {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [online, setOnline] = useState(() => new Set());
  const activeConversation = useRef(null);

  const refreshConversations = useCallback(async () => {
    try {
      const { data } = await chatApi.list();
      setConversations(data);
      setOnline((prev) => {
        const next = new Set(prev);
        data.forEach((c) => c.otherUser && c.otherOnline && next.add(c.otherUser._id));
        return next;
      });
    } catch {
      /* handled by the 401 interceptor */
    }
  }, []);

  const notify = useCallback((n) => {
    setNotifications((list) => [{ id: `${Date.now()}-${Math.random()}`, at: new Date().toISOString(), read: false, ...n }, ...list].slice(0, 30));
  }, []);

  useEffect(() => {
    if (!token) {
      setConversations([]);
      setNotifications([]);
      return undefined;
    }
    const s = createSocket(token);
    setSocket(s);
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.on('connect_error', () => setConnected(false));
    s.on('conversation_updated', refreshConversations);
    s.on('presence', ({ userId, online: isOn }) =>
      setOnline((prev) => {
        const next = new Set(prev);
        if (isOn) next.add(userId); else next.delete(userId);
        return next;
      })
    );
    s.on('new_message', ({ conversationId, message }) => {
      if (String(message.sender?._id) === String(user?._id)) return;
      if (activeConversation.current === conversationId && document.visibilityState === 'visible') return;
      notify({ kind: 'message', title: `${message.sender?.name || 'New message'}`, body: message.text, link: 'chat', conversationId });
    });
    s.on('video_updated', (p) => notify({ kind: 'video', title: p.title, body: `${p.by ? `${p.by} · ` : ''}${p.summary || 'updated'}`, videoId: p.videoId }));
    s.on('feedback_added', (p) => notify({ kind: 'feedback', title: p.title, body: `New feedback from ${p.by}`, videoId: p.videoId }));
    refreshConversations();
    return () => {
      s.removeAllListeners();
      s.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [token, user?._id, refreshConversations, notify]);

  const unreadTotal = conversations.reduce((n, c) => n + (c.unreadCount || 0), 0);

  const value = useMemo(
    () => ({
      socket,
      connected,
      conversations,
      setConversations,
      refreshConversations,
      unreadTotal,
      online,
      notifications,
      markNotificationsRead: () => setNotifications((l) => l.map((n) => ({ ...n, read: true }))),
      clearNotifications: () => setNotifications([]),
      setActiveConversation: (id) => { activeConversation.current = id; },
    }),
    [socket, connected, conversations, refreshConversations, unreadTotal, online, notifications]
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export const useRealtime = () => useContext(RealtimeContext);
