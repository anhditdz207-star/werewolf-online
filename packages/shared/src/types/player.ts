import { RoleName } from './roles';

/** Cause of death, used for DAY_REVEAL messaging and Hunter trigger logic. */
export enum DeathCause {
  WEREWOLF = 'WEREWOLF',
  WITCH_POISON = 'WITCH_POISON',
  VOTED_OUT = 'VOTED_OUT',
  LOVER_HEARTBREAK = 'LOVER_HEARTBREAK',
  HUNTER_SHOT = 'HUNTER_SHOT',
}

/**
 * Witch-specific runtime state. Kept separate so it's easy to see at a
 * glance which roles carry extra state beyond alive/dead.
 */
export interface WitchState {
  hasHealPotion: boolean;
  hasPoisonPotion: boolean;
}

/** Guard-specific runtime state, needed to enforce "no repeat target" rule. */
export interface GuardState {
  lastProtectedPlayerId: string | null;
}

/**
 * Player — full server-side representation of a participant.
 * Note: `role` and role-specific state are stripped out before broadcasting
 * to anyone other than the player themselves (see sanitizePlayerForBroadcast
 * on the server).
 */
export interface Player {
  id: string; // stable player id (persists across reconnects), NOT the socket.id
  socketId: string | null; // null when disconnected
  nickname: string;
  isHost: boolean;
  isAlive: boolean;
  isConnected: boolean;

  role: RoleName | null; // null until ROLE_ASSIGN
  deathCause: DeathCause | null;
  diedOnDay: number | null;

  loverId: string | null; // set by Cupid on night 1, mutual link

  witchState: WitchState | null; // present only if role === WITCH
  guardState: GuardState | null; // present only if role === GUARD
}

export function createEmptyPlayer(id: string, nickname: string, isHost: boolean): Player {
  return {
    id,
    socketId: null,
    nickname,
    isHost,
    isAlive: true,
    isConnected: true,
    role: null,
    deathCause: null,
    diedOnDay: null,
    loverId: null,
    witchState: null,
    guardState: null,
  };
}
