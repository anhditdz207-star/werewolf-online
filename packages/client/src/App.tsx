import { useState } from 'react';
import { ClientEvents } from '@werewolf/shared';
import { GameProvider, useGameDispatch } from './store/GameContext';
import { useSocketConnection } from './hooks/useSocketConnection';
import { socket } from './lib/socket';
import { LoginPage } from './pages/LoginPage';
import { LobbyPage } from './pages/LobbyPage';
import { RoomPage } from './pages/RoomPage';
import { CardGallery } from './components/cards/CardGallery';

const NICKNAME_STORAGE_KEY = 'masoi_nickname';
const AVATAR_STORAGE_KEY = 'masoi_avatar';

function AppInner() {
  useSocketConnection();
  const dispatch = useGameDispatch();
  const [nickname, setNickname] = useState<string | null>(() => localStorage.getItem(NICKNAME_STORAGE_KEY));
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => localStorage.getItem(AVATAR_STORAGE_KEY));
  const [roomId, setRoomId] = useState<string | null>(null);
  const [showCardGallery, setShowCardGallery] = useState(false);

  function handleLogin(name: string) {
    localStorage.setItem(NICKNAME_STORAGE_KEY, name);
    setNickname(name);
  }

  function handleRenameNickname(name: string) {
    localStorage.setItem(NICKNAME_STORAGE_KEY, name);
    setNickname(name);
  }

  function handleAvatarChange(dataUrl: string) {
    try {
      localStorage.setItem(AVATAR_STORAGE_KEY, dataUrl);
    } catch {
      /* localStorage quota exceeded — keep the avatar in memory for this session only. */
    }
    setAvatarUrl(dataUrl);
  }

  function handleLeaveRoom() {
    socket.emit(ClientEvents.ROOM_LEAVE);
    dispatch({ type: 'LEAVE_ROOM' });
    setRoomId(null);
  }

  function handleLogout() {
    localStorage.removeItem(NICKNAME_STORAGE_KEY);
    setRoomId(null);
    setNickname(null);
  }

  function renderScreen() {
    if (!nickname) return <LoginPage onLogin={handleLogin} />;
    if (!roomId) {
      return (
        <LobbyPage
          nickname={nickname}
          avatarUrl={avatarUrl}
          onRenameNickname={handleRenameNickname}
          onAvatarChange={handleAvatarChange}
          onEnterRoom={setRoomId}
          onLogout={handleLogout}
        />
      );
    }
    return <RoomPage roomId={roomId} onLeaveRoom={handleLeaveRoom} />;
  }

  return (
    <>
      {renderScreen()}

      {nickname && (
        <button
          type="button"
          onClick={() => setShowCardGallery(true)}
          className="fixed bottom-4 right-4 z-30 rounded-full bg-moon-400 px-4 py-2.5 text-sm font-semibold text-night-950 shadow-lg hover:bg-moon-300"
        >
          📖 Lá bài
        </button>
      )}

      {showCardGallery && <CardGallery onClose={() => setShowCardGallery(false)} />}
    </>
  );
}

export function App() {
  return (
    <GameProvider>
      <AppInner />
    </GameProvider>
  );
}
