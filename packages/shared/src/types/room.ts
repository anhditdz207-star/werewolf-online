import { GamePhase, NightSubPhase, VotingSubPhase } from './phase';
import { Player } from './player';
import { RoleName } from './roles';

/** Host-configured role distribution before the game starts. */
export interface RoomConfig {
  /** Maps each role to how many players should receive it. Remaining
   * players default to VILLAGER. Sum must be <= total player count. */
  roleCounts: Partial<Record<RoleName, number>>;
  discussionDurationSeconds: number; // default suggestion: 90
  votingDurationSeconds: number; // default suggestion: 30
}

export const DEFAULT_ROOM_CONFIG: RoomConfig = {
  roleCounts: {
    [RoleName.WEREWOLF]: 2,
    [RoleName.SEER]: 1,
    [RoleName.GUARD]: 1,
    [RoleName.WITCH]: 1,
    [RoleName.HUNTER]: 1,
    [RoleName.CUPID]: 1,
  },
  discussionDurationSeconds: 90,
  votingDurationSeconds: 30,
};

/** Record of a single night's outcome, kept for end-game history / recap. */
export interface NightResult {
  dayNumber: number;
  killedPlayerIds: string[]; // after guard/witch resolution, final deaths
  deathDetails: Array<{ playerId: string; cause: string }>;
}

export interface VoteRecord {
  round: VotingSubPhase;
  votes: Record<string, string>; // voterId -> targetId
  eliminatedPlayerId: string | null; // null if tied with no elimination
}

/**
 * GameState — the full state of one room's game. This is what lives in
 * memory on the server per room. A sanitized, player-specific view is what
 * actually gets broadcast (see sanitizeStateForPlayer on the server).
 */
export interface GameState {
  roomId: string;
  hostPlayerId: string;
  config: RoomConfig;
  phase: GamePhase;
  nightSubPhase: NightSubPhase | null;
  votingSubPhase: VotingSubPhase | null;
  dayCount: number; // increments each time we enter NIGHT; starts at 1

  players: Player[];

  /** Werewolves' current chosen target for tonight (before final resolution). */
  pendingWolfTargetId: string | null;

  history: {
    nights: NightResult[];
    votes: VoteRecord[];
  };

  winningTeam: 'VILLAGER' | 'WEREWOLF' | null;
}
