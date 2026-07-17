import { useState } from 'react';
import { ClientEvents, GameState, VotingSubPhase } from '@werewolf/shared';
import { socket } from '../../lib/socket';
import { audioManager } from '../../lib/audio';
import { PlayerAvatar } from '../common/PlayerAvatar';

interface VotingPanelProps {
  state: GameState;
  myPlayerId: string;
  voteTally: Record<string, number>;
}

export function VotingPanel({ state, myPlayerId, voteTally }: VotingPanelProps) {
  const [votedFor, setVotedFor] = useState<string | null>(null);
  const me = state.players.find((p) => p.id === myPlayerId);
  const candidates = state.players.filter((p) => p.isAlive);

  if (!me?.isAlive) {
    return (
      <div className="rounded-xl border border-mist-600/40 bg-night-800 p-5 text-center text-mist-400">
        Bạn đã qua đời — chỉ có thể theo dõi cuộc bỏ phiếu.
      </div>
    );
  }

  function handleVote(targetId: string) {
    if (targetId === myPlayerId) return;
    socket.emit(ClientEvents.VOTE_CAST, { targetId });
    audioManager.playSfx('click');
    setVotedFor(targetId);
  }

  return (
    <div className="rounded-xl border border-blood-500/40 bg-night-800 p-4 space-y-4">
      <h3 className="font-display text-xl text-blood-500">
        {state.votingSubPhase === VotingSubPhase.REVOTE ? 'Bầu lại (hòa phiếu)' : 'Bỏ phiếu treo cổ'}
      </h3>
      <div className="flex flex-wrap gap-3">
        {candidates.map((p) => (
          <PlayerAvatar
            key={p.id}
            player={p}
            selectable={p.id !== myPlayerId}
            selected={votedFor === p.id}
            voteCount={voteTally[p.id]}
            onSelect={() => handleVote(p.id)}
          />
        ))}
      </div>
      {votedFor && (
        <p className="text-sm text-moon-400">Bạn đã bỏ phiếu. Có thể đổi ý cho đến hết giờ.</p>
      )}
    </div>
  );
}
