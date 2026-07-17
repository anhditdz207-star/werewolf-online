import { FormEvent, useEffect, useRef, useState } from 'react';
import { ChatMessagePayload, ClientEvents } from '@werewolf/shared';
import { socket } from '../../lib/socket';
import { audioManager } from '../../lib/audio';

interface DiscussionChatProps {
  messages: ChatMessagePayload[];
  myPlayerId: string | null;
}

export function DiscussionChat({ messages, myPlayerId }: DiscussionChatProps) {
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    socket.emit(ClientEvents.CHAT_SEND, { text });
    audioManager.playSfx('click');
    setDraft('');
  }

  return (
    <div className="rounded-xl border border-mist-600/40 bg-night-800 flex flex-col h-72">
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {messages.map((m, i) => (
          <div
            key={i}
            className={m.playerId === myPlayerId ? 'text-moon-400' : 'text-parchment-100'}
          >
            <span className="font-semibold">{m.nickname}: </span>
            <span>{m.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSubmit} className="flex border-t border-mist-600/40 p-2 gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Nhập tin nhắn..."
          maxLength={500}
          className="flex-1 rounded-lg bg-night-700 px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-moon-400"
        />
        <button
          type="submit"
          className="rounded-lg bg-moon-400 px-3 py-1.5 text-sm font-semibold text-night-950"
        >
          Gửi
        </button>
      </form>
    </div>
  );
}
