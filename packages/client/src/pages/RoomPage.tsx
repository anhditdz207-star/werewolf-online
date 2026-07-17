import { useEffect, useRef, useState } from 'react';
import { GamePhase } from '@werewolf/shared';
import { useGameDispatch, useGameState } from '../store/GameContext';
import { audioManager } from '../lib/audio';
import { MoonPhaseIndicator } from '../components/common/MoonPhaseIndicator';
import { PlayerList } from '../components/lobby/PlayerList';
import { RoleConfigPanel } from '../components/lobby/RoleConfigPanel';
import { RoleRevealModal } from '../components/game/RoleRevealModal';
import { NightActionPanel } from '../components/game/NightActionPanel';
import { DayRevealBanner } from '../components/game/DayRevealBanner';
import { DiscussionChat } from '../components/game/DiscussionChat';
import { VotingPanel } from '../components/game/VotingPanel';
import { HunterShotPanel } from '../components/game/HunterShotPanel';
import { GameOverScreen } from '../components/game/GameOverScreen';

interface RoomPageProps {
  roomId: string;
  onLeaveRoom: () => void;
}

export function RoomPage({ roomId, onLeaveRoom }: RoomPageProps) {
  const state = useGameState();
  const dispatch = useGameDispatch();
  const {
    roomState,
    myPlayerId,
    myRoleInfo,
    nightPrompt,
    lastDayReveal,
    voteTally,
    hunterPrompt,
    gameOver,
    chatMessages,
    errorMessage,
  } = state;

  const [muted, setMuted] = useState(audioManager.isMuted());
  const lastDayRevealRef = useRef(lastDayReveal);
  const lastErrorRef = useRef(errorMessage);

  useEffect(() => {
    if (!errorMessage) return;
    const timeout = setTimeout(() => dispatch({ type: 'ERROR', message: null }), 4000);
    return () => clearTimeout(timeout);
  }, [errorMessage, dispatch]);

  // BGM per phase.
  useEffect(() => {
    if (!roomState) return;
    if (gameOver) {
      audioManager.playBgm(gameOver.winningTeam === 'WEREWOLF' ? 'werewolvesWin' : 'villagersWin');
      return;
    }
    switch (roomState.phase) {
      case GamePhase.WAITING:
      case GamePhase.ROLE_ASSIGN:
        audioManager.playBgm('lobby');
        break;
      case GamePhase.NIGHT:
        audioManager.playBgm('night');
        break;
      case GamePhase.DAY_REVEAL:
        audioManager.playBgm('result');
        break;
      case GamePhase.DISCUSSION:
        audioManager.playBgm('day');
        break;
      case GamePhase.VOTING:
        audioManager.playBgm('voting');
        break;
      default:
        break;
    }
  }, [roomState?.phase, gameOver]);

  useEffect(() => () => audioManager.stopBgm(), []);

  // SFX: bell on new day reveal, wolf howl on entering night, error blip.
  useEffect(() => {
    if (roomState?.phase === GamePhase.NIGHT) audioManager.playSfx('wolfHowl');
  }, [roomState?.phase === GamePhase.NIGHT]);

  useEffect(() => {
    if (lastDayReveal && lastDayReveal !== lastDayRevealRef.current) {
      audioManager.playSfx('bell');
      lastDayRevealRef.current = lastDayReveal;
    }
  }, [lastDayReveal]);

  useEffect(() => {
    if (errorMessage && errorMessage !== lastErrorRef.current) {
      audioManager.playSfx('error');
      lastErrorRef.current = errorMessage;
    }
  }, [errorMessage]);

  function toggleMute() {
    setMuted(audioManager.toggleMuted());
  }

  if (!roomState || !myPlayerId) {
    return (
      <div className="min-h-screen flex items-center justify-center text-mist-400">
        Đang kết nối tới phòng {roomId}...
      </div>
    );
  }

  const isHost = roomState.hostPlayerId === myPlayerId;
  const teammateNicknames =
    myRoleInfo?.teammateIds?.map(
      (id) => roomState.players.find((p) => p.id === id)?.nickname ?? '?',
    ) ?? [];

  return (
    <div className="min-h-screen px-4 py-6 max-w-2xl mx-auto space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs text-mist-400">Mã phòng</p>
          <p className="font-mono text-xl tracking-widest text-parchment-100">{roomId}</p>
        </div>
        <div className="flex items-center gap-3">
          <MoonPhaseIndicator phase={roomState.phase} />
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            className="rounded-full border border-mist-600/50 h-8 w-8 flex items-center justify-center text-sm hover:border-moon-400"
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </header>

      {errorMessage && (
        <div className="rounded-lg border border-blood-500/50 bg-blood-500/10 px-4 py-2 text-sm text-blood-500">
          {errorMessage}
        </div>
      )}

      {roomState.phase === GamePhase.WAITING && (
        <div className="space-y-4">
          <PlayerList players={roomState.players} myPlayerId={myPlayerId} />
          {isHost ? (
            <RoleConfigPanel config={roomState.config} playerCount={roomState.players.length} />
          ) : (
            <p className="text-center text-mist-400 text-sm">Đang chờ chủ phòng bắt đầu...</p>
          )}
        </div>
      )}

      {roomState.phase === GamePhase.ROLE_ASSIGN && myRoleInfo && (
        <RoleRevealModal roleInfo={myRoleInfo} teammateNicknames={teammateNicknames} />
      )}

      {roomState.phase === GamePhase.NIGHT && (
        <div className="space-y-4">
          <PlayerList players={roomState.players} myPlayerId={myPlayerId} />
          {nightPrompt ? (
            <NightActionPanel
              nightPrompt={nightPrompt}
              players={roomState.players}
              myPlayerId={myPlayerId}
            />
          ) : (
            <div className="rounded-xl border border-mist-600/40 bg-night-800 p-6 text-center text-mist-400">
              Màn đêm buông xuống... những người có khả năng đặc biệt đang hành động.
            </div>
          )}
        </div>
      )}

      {roomState.phase === GamePhase.DAY_REVEAL && lastDayReveal && (
        <DayRevealBanner reveal={lastDayReveal} players={roomState.players} />
      )}

      {roomState.phase === GamePhase.DISCUSSION && (
        <div className="space-y-4">
          <PlayerList players={roomState.players} myPlayerId={myPlayerId} />
          <DiscussionChat messages={chatMessages} myPlayerId={myPlayerId} />
        </div>
      )}

      {roomState.phase === GamePhase.VOTING && (
        <VotingPanel state={roomState} myPlayerId={myPlayerId} voteTally={voteTally} />
      )}

      {roomState.phase === GamePhase.GAME_OVER && gameOver && (
        <GameOverScreen result={gameOver} onLeaveRoom={onLeaveRoom} />
      )}

      {hunterPrompt && <HunterShotPanel prompt={hunterPrompt} players={roomState.players} />}
    </div>
  );
}
