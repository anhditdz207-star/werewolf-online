/**
 * GamePhase — every state the game FSM can be in.
 *
 * Flow (see GameStateMachine.ts on the server for transition rules):
 *
 *   WAITING -> ROLE_ASSIGN -> NIGHT -> DAY_REVEAL -> DISCUSSION -> VOTING
 *      -> (check win) -> NIGHT (loop) | GAME_OVER
 */
export enum GamePhase {
  /** Lobby: players joining, host configuring roles. */
  WAITING = 'WAITING',
  /** Roles have just been assigned; each player is shown their role privately. */
  ROLE_ASSIGN = 'ROLE_ASSIGN',
  /** Night actions happen in a fixed sub-order (see NightSubPhase). */
  NIGHT = 'NIGHT',
  /** Server announces who died overnight and (if applicable) how. */
  DAY_REVEAL = 'DAY_REVEAL',
  /** Timed open discussion among living players. */
  DISCUSSION = 'DISCUSSION',
  /** Players vote to eliminate a suspect; ties trigger a revote. */
  VOTING = 'VOTING',
  /** A win condition has been met; final reveal of all roles. */
  GAME_OVER = 'GAME_OVER',
}

/**
 * NightSubPhase — the fixed order in which roles act during NIGHT.
 * Cupid only acts when dayCount === 1 (first night only).
 */
export enum NightSubPhase {
  CUPID = 'CUPID', // first night only
  WEREWOLF = 'WEREWOLF',
  GUARD = 'GUARD',
  WITCH = 'WITCH',
  SEER = 'SEER',
  RESOLVING = 'RESOLVING', // server computing outcome, no player input
}

/**
 * VotingSubPhase — supports the tie -> revote -> no-elimination rule.
 */
export enum VotingSubPhase {
  FIRST_VOTE = 'FIRST_VOTE',
  REVOTE = 'REVOTE', // only entered if FIRST_VOTE ties; candidates limited to tied players
}
