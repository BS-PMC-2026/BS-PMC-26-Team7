'use client';

import { useState, type FormEvent } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import Button from '@/components/ui/Button';
import { useLanguage } from '@/context/LanguageContext';
import { sendChatMessage } from '@/services/chatbot';
import type { ChatResponse } from '@/types/chatbot';

/**
 * Floating AI chatbot widget for visitor pages.
 *
 * - All chatbot UI text comes from t.chatbot.* (i18n).
 * - The chatbot ANSWER is shown exactly as returned by the backend; it is
 *   never translated or modified here. The backend is responsible for making
 *   OpenAI answer in the visitor's own language.
 * - Chat history lives only in local component state.
 * - The widget side flips with `dir` so it sits correctly for RTL and LTR.
 */

interface DisplayMessage {
  role: 'user' | 'assistant';
  content: string;
  source?: ChatResponse['source'];
}

export default function ChatWidget() {
  const { t, dir } = useLanguage();
  const c = t.chatbot;

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Pin to the start side of the screen in RTL, the end side in LTR.
  const sideClass = dir === 'rtl' ? 'left-4' : 'right-4';

  const sourceLabel = (source: ChatResponse['source']): string => {
    if (source === 'db') return c.sourceDb;
    if (source === 'ai') return c.sourceAi;
    return c.sourceFallback;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setError('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');
    setLoading(true);

    try {
      const res = await sendChatMessage(text);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: res.answer, source: res.source },
      ]);
    } catch {
      setError(c.errorRetry);
    } finally {
      setLoading(false);
    }
  };

  // Collapsed: just the floating open button.
  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={c.openLabel}
        className={`fixed bottom-4 ${sideClass} z-50 flex items-center gap-2 rounded-full bg-[var(--color-primary)] px-4 py-3 text-white shadow-lg transition-colors hover:bg-[var(--color-primary-hover)]`}
      >
        <MessageCircle size={18} />
        <span className="text-sm font-medium">{c.openLabel}</span>
      </button>
    );
  }

  // Expanded: the chat panel.
  return (
    <div
      className={`fixed bottom-4 ${sideClass} z-50 flex max-h-[70vh] w-[20rem] flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl sm:w-[24rem]`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
        <span className="font-semibold text-[var(--color-foreground)]">{c.title}</span>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          aria-label={c.title}
          className="text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]"
        >
          <X size={18} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {/* Greeting, shown whenever the chat is open */}
        <div className="max-w-[85%] rounded-2xl bg-[var(--color-muted)] px-3 py-2 text-sm text-[var(--color-foreground)]">
          {c.greeting}
        </div>

        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === 'user' ? 'flex flex-col items-end' : 'flex flex-col items-start'}
          >
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                m.role === 'user'
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-muted)] text-[var(--color-foreground)]'
              }`}
            >
              {m.content}
            </div>
            {m.role === 'assistant' && m.source && (
              <span className="mt-1 text-[10px] text-[var(--color-muted-foreground)]">
                {sourceLabel(m.source)}
              </span>
            )}
          </div>
        ))}

        {loading && (
          <div className="max-w-[85%] rounded-2xl bg-[var(--color-muted)] px-3 py-2 text-sm text-[var(--color-muted-foreground)]">
            {c.loading}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-[var(--color-error)] bg-[var(--color-error-bg)] px-3 py-2 text-sm text-[var(--color-error)]">
            {error}
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-[var(--color-border)] px-3 py-3"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={c.placeholder}
          disabled={loading}
          className="flex-1 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus:border-[var(--color-primary)] disabled:opacity-50"
        />
        <Button type="submit" size="sm" disabled={loading || !input.trim()} aria-label={c.send}>
          <Send size={16} />
        </Button>
      </form>
    </div>
  );
}
