import { FormEvent, useEffect, useRef, useState } from 'react';
import { ClientEvents } from '@werewolf/shared';
import { socket } from '../lib/socket';
import { useGameDispatch } from '../store/GameContext';
import { audioManager } from '../lib/audio';
import { fileToAvatarDataUrl } from '../lib/avatar';
import { PRESET_AVATARS } from '../data/presetAvatars';

interface LobbyPageProps {
  nickname: string;
  avatarUrl: string | null;
  onRenameNickname: (nickname: string) => void;
  onAvatarChange: (dataUrl: string) => void;
  onEnterRoom: (roomId: string) => void;
  onLogout: () => void;
}

type AckResponse = { roomId: string; playerId: string };

export function LobbyPage({ nickname, avatarUrl, onRenameNickname, onAvatarChange, onEnterRoom, onLogout }: LobbyPageProps) {
  const dispatch = useGameDispatch();
  const [roomCode, setRoomCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(nickname);
  const [bgmVolume, setBgmVolume] = useState(() => Math.round(audioManager.getBgmVolume() * 100));
  const [sfxVolume, setSfxVolume] = useState(() => Math.round(audioManager.getSfxVolume() * 100));
  const [vibration, setVibration] = useState(() => audioManager.isVibrationEnabled());
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    audioManager.playBgm('lobby');
  }, []);

  async function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      onAvatarChange(dataUrl);
      setShowAvatarPicker(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải ảnh lên.');
    }
  }

  function saveName() {
    const trimmed = nameDraft.trim();
    if (trimmed) onRenameNickname(trimmed);
    setEditingName(false);
  }

  function handleAck(res: AckResponse) {
    setBusy(false);
    dispatch({ type: 'SET_MY_PLAYER_ID', playerId: res.playerId });
    onEnterRoom(res.roomId);
  }

  function handleCreate() {
    setBusy(true);
    setError(null);
    socket.emit(ClientEvents.ROOM_CREATE, { nickname }, handleAck);
  }

  function handleJoin(e: FormEvent) {
    e.preventDefault();
    const trimmedCode = roomCode.trim().toUpperCase();
    if (!trimmedCode) {
      setError('Vui lòng nhập mã phòng.');
      return;
    }
    setBusy(true);
    setError(null);
    socket.emit(ClientEvents.ROOM_JOIN, { roomId: trimmedCode, nickname }, handleAck);
  }

  return (
    <div
      className="min-h-screen w-full bg-cover bg-center relative px-4 py-6"
      style={{ backgroundImage: 'url(/ui/lobby/background_lobby.png)' }}
    >
      {/* Menu button */}
      <button
        type="button"
        onClick={() => setShowSettings(true)}
        className="absolute top-4 left-4 w-14 sm:w-16 transition-transform hover:scale-105 active:scale-95"
      >
        <img src="/ui/lobby/three_line_button.png" alt="Menu" className="w-full select-none pointer-events-none" draggable={false} />
      </button>

      <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />

      {/* Player profile */}
      <div className="absolute top-4 right-4 w-56 sm:w-64">
        <img src="/ui/lobby/player_profile_frame.png" alt="" className="w-full select-none pointer-events-none" draggable={false} />
        <button
          type="button"
          onClick={() => setShowAvatarPicker(true)}
          title="Đổi ảnh đại diện"
          className="absolute left-[3%] top-[7%] w-[23%] aspect-square rounded-full overflow-hidden"
        >
          {avatarUrl && <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />}
        </button>
        <span className="absolute inset-0 flex items-center pl-[30%] pr-[8%] text-parchment-100 font-semibold truncate">
          {nickname}
        </span>
      </div>

      {/* Main content: create + join panels */}
      <div className="min-h-screen flex flex-col sm:flex-row items-center justify-center gap-8">
        {/* Room creation */}
        <div className="relative w-[300px]">
          <img src="/ui/lobby/room_creation_box.png" alt="" className="w-full select-none pointer-events-none drop-shadow-2xl" draggable={false} />
          <div className="absolute inset-0 flex flex-col items-center justify-end px-[10%] pb-[10%]">
            <button
              type="button"
              disabled={busy}
              onClick={handleCreate}
              className="w-full rounded-full bg-moon-400 py-2.5 font-semibold text-night-950 disabled:opacity-50 hover:bg-moon-300"
            >
              Tạo phòng mới
            </button>
          </div>
        </div>

        {/* Enter room */}
        <form onSubmit={handleJoin} className="relative w-[280px]">
          <img src="/ui/lobby/enter_room_box.png" alt="" className="w-full select-none pointer-events-none drop-shadow-2xl" draggable={false} />
          <div className="absolute inset-0 flex flex-col items-center justify-end px-[10%] pb-[10%] gap-2.5">
            <input
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              maxLength={6}
              placeholder="Mã phòng"
              className="w-full rounded-full bg-night-950/70 border border-moon-400/40 px-3 py-2 text-center uppercase tracking-widest text-parchment-100 placeholder:text-mist-400 outline-none focus:ring-1 focus:ring-moon-400"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-blood-500 py-2.5 font-semibold text-parchment-100 disabled:opacity-50 hover:bg-blood-600"
            >
              Vào phòng
            </button>
          </div>
        </form>
      </div>

      {error && (
        <p className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg bg-night-950/90 border border-blood-500/60 px-4 py-2 text-sm text-blood-500">
          {error}
        </p>
      )}

      {/* Settings panel overlay */}
      {showSettings && (
        <div
          className="fixed inset-0 z-40 bg-cover bg-center overflow-y-auto"
          style={{ backgroundImage: 'url(/ui/lobby/settings/settings_panel.png)' }}
        >
          <button
            type="button"
            onClick={() => setShowSettings(false)}
            className="absolute top-4 right-4 w-12 transition-transform hover:scale-105 active:scale-95"
          >
            <img src="/ui/lobby/settings/exit_button.png" alt="Đóng" className="w-full select-none pointer-events-none" draggable={false} />
          </button>

          <div className="max-w-xl mx-auto px-6 pt-24 pb-10 space-y-5 text-moon-300">
            <div className="rounded-xl border border-moon-400/40 bg-night-950/50 divide-y divide-moon-400/20">
              <button
                type="button"
                onClick={() => setShowAvatarPicker(true)}
                className="flex items-center justify-between px-4 py-3 w-full text-left"
              >
                <span className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-full overflow-hidden border border-moon-400/50 bg-night-800 flex-shrink-0">
                    {avatarUrl && <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />}
                  </span>
                  <span className="text-sm tracking-wide">ĐỔI ẢNH ĐẠI DIỆN</span>
                </span>
                <span>›</span>
              </button>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm tracking-wide">ĐỔI TÊN</span>
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      maxLength={20}
                      onKeyDown={(e) => e.key === 'Enter' && saveName()}
                      className="rounded-full bg-night-950 border border-moon-400/40 px-3 py-1 text-parchment-100 text-sm outline-none"
                    />
                    <button type="button" onClick={saveName} className="text-sm text-moon-400 hover:text-moon-300">
                      Lưu
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => { setNameDraft(nickname); setEditingName(true); }} className="text-parchment-100 hover:text-moon-300">
                    {nickname} ›
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-moon-400/40 bg-night-950/50 divide-y divide-moon-400/20">
              <div className="px-4 py-3">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span>NHẠC NỀN</span>
                  <span>{bgmVolume}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={bgmVolume}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setBgmVolume(v);
                    audioManager.setBgmVolume(v / 100);
                  }}
                  className="w-full accent-moon-400"
                />
              </div>
              <div className="px-4 py-3">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span>HIỆU ỨNG ÂM THANH</span>
                  <span>{sfxVolume}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={sfxVolume}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setSfxVolume(v);
                    audioManager.setSfxVolume(v / 100);
                    audioManager.playSfx('click');
                  }}
                  className="w-full accent-moon-400"
                />
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm">RUNG</span>
                <button
                  type="button"
                  onClick={() => {
                    const next = !vibration;
                    setVibration(next);
                    audioManager.setVibrationEnabled(next);
                    if (next) audioManager.vibrate();
                  }}
                  className={`rounded-full px-4 py-1 text-xs font-semibold border ${vibration ? 'bg-moon-400 text-night-950 border-moon-400' : 'border-moon-400/40 text-moon-300'}`}
                >
                  {vibration ? 'BẬT' : 'TẮT'}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="w-full transition-transform hover:scale-105 active:scale-95"
            >
              <img src="/ui/lobby/settings/logout_button.png" alt="Đăng xuất" className="w-full select-none pointer-events-none" draggable={false} />
            </button>
          </div>
        </div>
      )}

      {/* Avatar picker */}
      {showAvatarPicker && (
        <div
          className="fixed inset-0 z-50 bg-night-950/85 flex items-center justify-center px-4"
          onClick={() => setShowAvatarPicker(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-moon-400/40 bg-night-900 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-moon-300 font-display text-lg mb-4 text-center">Chọn ảnh đại diện</h2>

            <div className="grid grid-cols-5 gap-3">
              {PRESET_AVATARS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  title={preset.label}
                  onClick={() => {
                    onAvatarChange(preset.src);
                    setShowAvatarPicker(false);
                  }}
                  className={`aspect-square rounded-full overflow-hidden border-2 transition-transform hover:scale-105 ${
                    avatarUrl === preset.src ? 'border-moon-400' : 'border-transparent'
                  }`}
                >
                  <img src={preset.src} alt={preset.label} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="w-full mt-5 rounded-full border border-moon-400/50 py-2.5 text-sm text-moon-300 hover:bg-moon-400/10"
            >
              Tải ảnh từ máy...
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
