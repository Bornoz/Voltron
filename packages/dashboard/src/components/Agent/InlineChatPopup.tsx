import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, Send, X, Minimize2, Paperclip } from 'lucide-react';
import { useChatStore, type ChatMessage } from '../../stores/chatStore';
import { FileUploader } from './FileUploader';
import { useTranslation } from '../../i18n';
import { type UploadResult } from '../../lib/api';

interface InlineChatPopupProps {
  projectId: string;
  onInject: (prompt: string, context?: { filePath?: string; constraints?: string[]; attachmentUrls?: string[] }) => void;
}

export function InlineChatPopup({ projectId, onInject }: InlineChatPopupProps) {
  const { t } = useTranslation();
  const messages = useChatStore((s) => s.messages);
  const isOpen = useChatStore((s) => s.isOpen);
  const unreadCount = useChatStore((s) => s.unreadCount);
  const toggleOpen = useChatStore((s) => s.toggleOpen);
  const addUserMessage = useChatStore((s) => s.addUserMessage);

  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<UploadResult[]>([]);
  const [showUploader, setShowUploader] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (isOpen && !minimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isOpen, minimized]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;

    const attachmentUrls = attachments.map((a) => a.url);
    addUserMessage(text, attachments.length > 0 ? attachments : undefined);
    onInject(text, attachmentUrls.length > 0 ? { attachmentUrls } : undefined);

    setInput('');
    setAttachments([]);
    setShowUploader(false);
  }, [input, attachments, addUserMessage, onInject]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Floating button (when closed)
  if (!isOpen) {
    return (
      <button
        onClick={toggleOpen}
        className="fixed bottom-6 right-6 z-[100000] w-12 h-12 bg-blue-600 hover:bg-blue-500 rounded-full shadow-lg shadow-blue-600/30 flex items-center justify-center transition-all hover:scale-105"
        aria-label={t('agent.chat.title')}
      >
        <MessageSquare className="w-5 h-5 text-white" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
    );
  }

  // Minimized state
  if (minimized) {
    return (
      <div className="fixed bottom-6 right-6 z-[100000] w-72 bg-gray-900 border border-gray-700 rounded-t-xl shadow-2xl">
        <div
          className="flex items-center justify-between px-3 py-2 cursor-pointer"
          onClick={() => setMinimized(false)}
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-medium text-gray-200">{t('agent.chat.title')}</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <button onClick={(e) => { e.stopPropagation(); toggleOpen(); }} className="p-1 hover:bg-gray-800 rounded">
            <X className="w-3 h-3 text-gray-500" />
          </button>
        </div>
      </div>
    );
  }

  // Full chat panel
  return (
    <div className="fixed bottom-6 right-6 z-[100000] w-[350px] h-[500px] bg-gray-900 border border-gray-700 rounded-xl shadow-2xl shadow-black/40 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-medium text-gray-200">{t('agent.chat.title')}</span>
          <span className="text-[9px] text-gray-500">{messages.length} {t('agent.chat.messages')}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMinimized(true)} className="p-1 hover:bg-gray-800 rounded transition-colors">
            <Minimize2 className="w-3 h-3 text-gray-500" />
          </button>
          <button onClick={toggleOpen} className="p-1 hover:bg-gray-800 rounded transition-colors">
            <X className="w-3 h-3 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {messages.length === 0 && (
          <div className="text-center text-gray-600 text-[10px] py-8">
            {t('agent.chat.empty')}
          </div>
        )}
        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* File uploader */}
      {showUploader && (
        <div className="px-3 py-1.5 border-t border-gray-800">
          <FileUploader
            projectId={projectId}
            attachments={attachments}
            onAttachmentAdd={(a) => setAttachments((prev) => [...prev, a])}
            onAttachmentRemove={(id) => setAttachments((prev) => prev.filter((a) => a.id !== id))}
          />
        </div>
      )}

      {/* Input */}
      <div className="px-3 py-2 border-t border-gray-800 shrink-0">
        <div className="flex items-end gap-1.5">
          <button
            onClick={() => setShowUploader(!showUploader)}
            className={`p-1.5 rounded-lg transition-colors ${showUploader ? 'bg-blue-900/30 text-blue-400' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'}`}
          >
            <Paperclip className="w-3.5 h-3.5" />
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('agent.chat.placeholder')}
            rows={1}
            className="flex-1 px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 placeholder:text-gray-600 resize-none focus:outline-none focus:border-blue-500 max-h-20"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="p-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isAgent = message.role === 'agent';
  const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`flex ${isAgent ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[85%] px-2.5 py-1.5 rounded-lg text-[11px] leading-relaxed ${
        isAgent
          ? 'bg-gray-800 text-gray-200 rounded-bl-none'
          : 'bg-blue-600/20 text-blue-100 border border-blue-600/30 rounded-br-none'
      }`}>
        <div className="whitespace-pre-wrap break-words">{message.text}</div>
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {message.attachments.map((a) => (
              <span key={a.id} className="px-1.5 py-0.5 bg-gray-700/50 rounded text-[9px] text-gray-400">
                {a.filename}
              </span>
            ))}
          </div>
        )}
        <div className={`text-[8px] mt-0.5 ${isAgent ? 'text-gray-600' : 'text-blue-400/50'}`}>{time}</div>
      </div>
    </div>
  );
}
