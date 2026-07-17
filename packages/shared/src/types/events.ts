import { DeathCause, Player } from './player';
import { GameState, RoomConfig } from './room';
import { RoleName } from './roles';

/**
 * All event names as constants (not raw strings) so a typo becomes a
 * compile error instead of a silent runtime bug.
 */
export const ClientEvents = {
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_UPDATE_CONFIG: 'room:updateConfig',
  ROOM_START: 'room:start',

  NIGHT_ACTION_WEREWOLF: 'night:action:werewolf',
  NIGHT_ACTION_SEER: 'night:action:seer',
  NIGHT_ACTION_GUARD: 'night:action:guard',
  NIGHT_ACTION_WITCH: 'night:action:witch',
  NIGHT_ACTION_CUPID: 'night:action:cupid',

  CHAT_SEND: 'chat:send',
  VOTE_CAST: 'vote:cast',
  HUNTER_SHOOT: 'hunter:shoot',
} as const;

export const ServerEvents = {
  ROOM_STATE: 'room:state', // sanitized full state, broadcast after every change
  ROOM_ERROR: 'room:error',
  ROLE_ASSIGNED: 'role:assigned', // private, sent only to the individual player's socket

  NIGHT_PROMPT: 'night:prompt', // tells a specific player it's their turn to act
  SEER_RESULT: 'seer:result', // private result of a seer's inspection

  DAY_REVEAL: 'day:reveal',
  CHAT_MESSAGE: 'chat:message',

  VOTE_TALLY: 'vote:tally', // live vote counts during VOTING
  VOTE_RESULT: 'vote:result',

  HUNTER_PROMPT: 'hunter:prompt', // sent to the hunter who just died

  GAME_OVER: 'game:over',
} as const;

// ---------- Client -> Server payloads ----------

export interface RoomCreatePayload {
  nickname: string;
}
export interface RoomJoinPayload {
  roomId: string;
  nickname: string;
}
export interface RoomUpdateConfigPayload {
  config: RoomConfig;
}
export interface NightActionWerewolfPayload {
  targetId: string;
}
export interface NightActionSeerPayload {
  targetId: string;
}
export interface NightActionGuardPayload {
  targetId: string;
}
export interface NightActionWitchPayload {
  action: 'heal' | 'poison' | 'skip';
  targetId?: string; // required unless action === 'skip'
}
export interface NightActionCupidPayload {
  targetId1: string;
  targetId2: string;
}
export interface ChatSendPayload {
  text: string;
}
export interface VoteCastPayload {
  targetId: string;
}
export interface HunterShootPayload {
  targetId: string;
}

// ---------- Server -> Client payloads ----------

export interface RoomErrorPayload {
  message: string;
  code: string;
}
export interface RoleAssignedPayload {
  role: RoleName;
  /** Only populated for WEREWOLF role: ids of fellow werewolves. */
  teammateIds?: string[];
}
export interface NightPromptPayload {
  subPhase: string; // NightSubPhase value
  /** Valid target player ids the acting player may choose from. */
  eligibleTargetIds: string[];
  timeoutSeconds: number;
}
export interface SeerResultPayload {
  targetId: string;
  isWerewolf: boolean;
}
export interface DayRevealPayload {
  dayCount: number;
  deaths: Array<{ playerId: string; cause: DeathCause }>;
}
export interface ChatMessagePayload {
  playerId: string;
  nickname: string;
  text: string;
  timestamp: number;
}
export interface VoteTallyPayload {
  tally: Record<string, number>; // targetId -> vote count
}
export interface VoteResultPayload {
  eliminatedPlayerId: string | null;
  wasRevote: boolean;
}
export interface HunterPromptPayload {
  eligibleTargetIds: string[];
  timeoutSeconds: number;
}
export interface GameOverPayload {
  winningTeam: 'VILLAGER' | 'WEREWOLF';
  allPlayers: Player[]; // full reveal, roles included
}

/** Generic envelope broadcast after every state-changing action. */
export type RoomStatePayload = GameState;
