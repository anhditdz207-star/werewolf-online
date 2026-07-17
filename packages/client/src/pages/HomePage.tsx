import { FormEvent, useState } from 'react';
import { ClientEvents } from '@werewolf/shared';
import { socket } from '../lib/socket';
import { useGameDispatch } from '../store/GameContext';

interface HomePageProps {
  onEnterRoom: (roomId: string) => void;
}

type AckResponse = { roomId: string; playerId: string };

export function HomePage({ onEnterRoom }: HomePageProps) {
  const dispatch = useGameDispatch();
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
      setError('Vui lòng nhập biệt danh của bạn.');
      return;
    }
    setBusy(true);
    setError(null);

    const onAck = (res: AckResponse) => {
      setBusy(false);
      dispatch({ type: 'SET_MY_PLAYER_ID', playerId: res.playerId });
      onEnterRoom(res.roomId);
    };

    if (mode === 'create') {
      socket.emit(ClientEvents.ROOM_CREATE, { nickname: trimmedNickname }, onAck);
    } else {
      const trimmedCode = roomCode.trim().toUpperCase();
      if (!trimmedCode) {
        setBusy(false);
        setError('Vui lòng nhập mã phòng.');
        return;
      }
      socket.emit(
        ClientEvents.ROOM_JOIN,
        { roomId: trimmedCode, nickname: trimmedNickname },
        onAck,
      );
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <h1 className="font-display text-5xl text-moon-400 mb-1">Ma Sói Online</h1>
      <p className="text-mist-400 mb-8">Đấu trí giữa Đêm và Ngày</p>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-mist-600/40 bg-night-800 p-6 space-y-4"
      >
        <div className="flex rounded-lg bg-night-700 p-1">
          <button
            type="button"
            onClick={() => setMode('create')}
            className={`flex-1 rounded-md py-2 text-sm font-medium ${mode === 'create' ? 'bg-moon-400 text-night-950' : 'text-mist-400'}`}
          >
            Tạo phòng
          </button>
          <button
            type="button"
            onClick={() => setMode('join')}
            className={`flex-1 rounded-md py-2 text-sm font-medium ${mode === 'join' ? 'bg-moon-400 text-night-950' : 'text-mist-400'}`}
          >
            Vào phòng
          </button>
        </div>

        <div>
          <label className="text-sm text-mist-400 mb-1 block">Biệt danh</label>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
            placeholder="VD: Lan Anh"
            className="w-full rounded-lg bg-night-700 px-3 py-2.5 outline-none focus:ring-1 focus:ring-moon-400"
          />
        </div>

        {mode === 'join' && (
          <div>
            <label className="text-sm text-mist-400 mb-1 block">Mã phòng</label>
            <input
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              maxLength={6}
              placeholder="VD: AB12CD"
              className="w-full rounded-lg bg-night-700 px-3 py-2.5 uppercase tracking-widest outline-none focus:ring-1 focus:ring-moon-400"
            />
          </div>
        )}

        {error && <p className="text-sm text-blood-500">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-moon-400 py-2.5 font-semibold text-night-950 disabled:opacity-50"
        >
          {mode === 'create' ? 'Tạo phòng mới' : 'Tham gia'}
        </button>
      </form>
    </div>
  );
}
