import { useState } from 'react';
import { ClientEvents, NightPromptPayload, NightSubPhase, Player } from '@werewolf/shared';
import { socket } from '../../lib/socket';
import { audioManager } from '../../lib/audio';
import { PlayerAvatar } from '../common/PlayerAvatar';
import { Timer } from '../common/Timer';

interface NightActionPanelProps {
  nightPrompt: NightPromptPayload;
  players: Player[];
  myPlayerId: string;
}

const SUBPHASE_TITLE: Record<string, string> = {
  [NightSubPhase.WEREWOLF]: 'Chọn nạn nhân đêm nay',
  [NightSubPhase.GUARD]: 'Chọn người để bảo vệ',
  [NightSubPhase.SEER]: 'Chọn người để soi',
  [NightSubPhase.WITCH]: 'Quyết định của Phù thủy',
  [NightSubPhase.CUPID]: 'Chọn hai người yêu nhau',
};

export function NightActionPanel({ nightPrompt, players, myPlayerId }: NightActionPanelProps) {
  const [submitted, setSubmitted] = useState(false);
  const [cupidFirstPick, setCupidFirstPick] = useState<string | null>(null);
  const me = players.find((p) => p.id === myPlayerId);
  const eligible = players.filter((p) => nightPrompt.eligibleTargetIds.includes(p.id));

  function markSubmitted() {
    setSubmitted(true);
    audioManager.playSfx('click');
  }

  function pickSingleTarget(targetId: string) {
    if (submitted) return;
    switch (nightPrompt.subPhase) {
      case NightSubPhase.WEREWOLF:
        socket.emit(ClientEvents.NIGHT_ACTION_WEREWOLF, { targetId });
        break;
      case NightSubPhase.GUARD:
        socket.emit(ClientEvents.NIGHT_ACTION_GUARD, { targetId });
        break;
      case NightSubPhase.SEER:
        socket.emit(ClientEvents.NIGHT_ACTION_SEER, { targetId });
        break;
      default:
        return;
    }
    markSubmitted();
  }

  function handleCupidPick(targetId: string) {
    if (submitted) return;
    if (!cupidFirstPick) {
      setCupidFirstPick(targetId);
      return;
    }
    if (targetId === cupidFirstPick) return;
    socket.emit(ClientEvents.NIGHT_ACTION_CUPID, {
      targetId1: cupidFirstPick,
      targetId2: targetId,
    });
    markSubmitted();
  }

  function handleWitchHeal() {
    if (submitted) return;
    socket.emit(ClientEvents.NIGHT_ACTION_WITCH, { action: 'heal' });
    markSubmitted();
  }

  function handleWitchPoison(targetId: string) {
    if (submitted) return;
    socket.emit(ClientEvents.NIGHT_ACTION_WITCH, { action: 'poison', targetId });
    markSubmitted();
  }

  function handleWitchSkip() {
    if (submitted) return;
    socket.emit(ClientEvents.NIGHT_ACTION_WITCH, { action: 'skip' });
    markSubmitted();
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-mist-600/40 bg-night-800 p-6 text-center space-y-2">
        <p className="text-moon-400 font-display text-xl">Đã gửi lựa chọn</p>
        <p className="text-sm text-mist-400">Đang chờ những người khác...</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-moon-400/40 bg-night-800 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl text-moon-400">
          {SUBPHASE_TITLE[nightPrompt.subPhase] ?? 'Hành động ban đêm'}
        </h3>
        <Timer seconds={nightPrompt.timeoutSeconds} />
      </div>

      {nightPrompt.subPhase === NightSubPhase.WITCH && me?.witchState ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!me.witchState.hasHealPotion}
              onClick={handleWitchHeal}
              className="flex-1 rounded-lg bg-moon-400 py-2 font-semibold text-night-950 disabled:opacity-30"
            >
              Cứu người bị cắn
            </button>
            <button
              type="button"
              onClick={handleWitchSkip}
              className="flex-1 rounded-lg border border-mist-600 py-2 text-parchment-100"
            >
              Bỏ qua
            </button>
          </div>
          {me.witchState.hasPoisonPotion && (
            <>
              <p className="text-sm text-mist-400">Hoặc chọn một người để đầu độc:</p>
              <div className="flex flex-wrap gap-3">
                {eligible.map((p) => (
                  <PlayerAvatar
                    key={p.id}
                    player={p}
                    selectable
                    onSelect={() => handleWitchPoison(p.id)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {eligible.map((p) => (
            <PlayerAvatar
              key={p.id}
              player={p}
              selectable
              selected={cupidFirstPick === p.id}
              onSelect={() =>
                nightPrompt.subPhase === NightSubPhase.CUPID
                  ? handleCupidPick(p.id)
                  : pickSingleTarget(p.id)
              }
            />
          ))}
        </div>
      )}

      {nightPrompt.subPhase === NightSubPhase.CUPID && cupidFirstPick && (
        <p className="text-sm text-moon-400">
          Đã chọn 1 người — chọn thêm 1 người nữa để ghép đôi.
        </p>
      )}
    </div>
  );
}
