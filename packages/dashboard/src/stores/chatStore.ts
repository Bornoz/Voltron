import { create } from 'zustand';
import type { UploadResult } from '../lib/api';

export interface ChatMessage {
  id: string;
  role: 'agent' | 'user';
  text: string;
  timestamp: number;
  attachments?: UploadResult[];
}

interface ChatState {
  messages: ChatMessage[];
  isOpen: boolean;
  unreadCount: number;

  addAgentMessage: (text: string) => void;
  addUserMessage: (text: string, attachments?: UploadResult[]) => void;
  toggleOpen: () => void;
  setOpen: (open: boolean) => void;
  markRead: () => void;
  clear: () => void;
}

let msgCounter = 0;

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isOpen: false,
  unreadCount: 0,

  addAgentMessage: (text) => {
    if (!text.trim()) return;
    const msg: ChatMessage = {
      id: `agent_${++msgCounter}_${Date.now()}`,
      role: 'agent',
      text: text.trim(),
      timestamp: Date.now(),
    };
    set((state) => ({
      messages: [...state.messages.slice(-499), msg],
      unreadCount: state.isOpen ? state.unreadCount : state.unreadCount + 1,
    }));
  },

  addUserMessage: (text, attachments) => {
    if (!text.trim()) return;
    const msg: ChatMessage = {
      id: `user_${++msgCounter}_${Date.now()}`,
      role: 'user',
      text: text.trim(),
      timestamp: Date.now(),
      attachments,
    };
    set((state) => ({
      messages: [...state.messages.slice(-499), msg],
    }));
  },

  toggleOpen: () =>
    set((state) => ({
      isOpen: !state.isOpen,
      unreadCount: !state.isOpen ? 0 : state.unreadCount,
    })),

  setOpen: (open) =>
    set({
      isOpen: open,
      unreadCount: open ? 0 : get().unreadCount,
    }),

  markRead: () => set({ unreadCount: 0 }),

  clear: () => set({ messages: [], unreadCount: 0 }),
}));
