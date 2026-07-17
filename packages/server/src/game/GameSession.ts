import { EventEmitter } from 'events';
import { GamePhase, NightSubPhase, RoleName, ServerEvents, VotingSubPhase } from '@werewolf/shared';
import { Room } from '../rooms/Room';
import { GameStateMachine } from './fsm/GameStateMachine';
import { TIMING } from '../config/timing';

/**
 * GameSession wraps one Room + its GameStateMachine and is the piece
 * that actually makes the game "run itself": starting countdowns,
 * auto-advancing night sub-phases once the required actor(s) have
 * submitted, and looping NIGHT <-> DAY until a winner is decided.
 *
 * It knows NOTHING about Socket.IO. It communicates outward purely by
 * emitting events:
 *   - 'stateChanged'            -> socket layer should broadcast sanitized state to the room
 *   - 'privateEvent' (playerId, eventName, payload) -> socket layer sends to that player's socket only
 *   - 'broadcastEvent' (eventName, payload)         -> socket layer sends to everyone in the room
 *
 * This separation is what makes it possible to unit-test the entire
 * game loop (as we did for GameStateMachine) without ever starting an
 * HTTP or WebSocket server.
 */
export class GameSession extends EventEmitter {
  private fsm: GameStateMachine;
  private discussionTimer: ReturnType<typeof setTimeout> | null = null;
  private votingTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingHunterIds: string[] = [];

  constructor(private room: Room) {
    super();
    this.fsm = new GameStateMachine(room);
  }

  get roomId(): string {
    return this.room.roomId;
  }

  // ==================== Lobby -> first night ====================

  handleStartGame(requestingPlayerId: string): void {
    this.fsm.startGame(requestingPlayerId);
    this.emitStateChanged();
    this.emitPrivateRoleAssignments();
    setTimeout(() => this.beginFirstNight(), TIMING.ROLE_REVEAL_DELAY_MS);
  }

  private emitPrivateRoleAssignments(): void {
    const players = this.room.getState().players;
    for (const player of players) {
      if (!player.role) continue;
      const teammateIds =
        player.role === RoleName.WEREWOLF
          ? players.filter((p) => p.role === RoleName.WEREWOLF && p.id !== player.id).map((p) => p.id)
          : undefined;
      this.emit('privateEvent', player.id, ServerEvents.ROLE_ASSIGNED, {
        role: player.role,
        teammateIds,
      });
    }
  }

  private beginFirstNight(): void {
    this.fsm.beginFirstNight();
    this.emitStateChanged();
    this.promptCurrentNightActors();
  }

  // ==================== Night flow ====================

  private promptCurrentNightActors(): void {
    const state = this.room.getState();
    if (state.phase !== GamePhase.NIGHT || !state.nightSubPhase) return;

    if (state.nightSubPhase === NightSubPhase.RESOLVING) {
      this.resolveNightAndContinue();
      return;
    }

    const actorIds = this.fsm.getCurrentNightActorIds();
    if (actorIds.length === 0) {
      // Defensive fallback: NightOrder should already skip sub-phases with
      // no eligible actor, but if it ever happens, don't stall the game.
      this.advanceNightSubPhase();
      return;
    }

    const eligibleTargetIds = this.fsm.getEligibleTargets(state.nightSubPhase);
    for (const actorId of actorIds) {
      this.emit('privateEvent', actorId, ServerEvents.NIGHT_PROMPT, {
        subPhase: state.nightSubPhase,
        eligibleTargetIds,
        timeoutSeconds: TIMING.NIGHT_ACTION_TIMEOUT_SECONDS,
      });
    }
  }

  /**
   * Called by the socket handler right after any successful night-action
   * submission. For this MVP, one valid submission from the required
   * role is treated as that sub-phase's final decision (werewolves
   * coordinate their single choice via their own chat, outside this
   * state machine) — so we advance immediately rather than waiting for
   * every eligible actor individually.
   */
  onNightActionSubmitted(): void {
    this.advanceNightSubPhase();
  }

  /** Called by the socket handler if a night-action timer expires with no submission. */
  onNightActionTimeout(): void {
    this.advanceNightSubPhase();
  }

  private advanceNightSubPhase(): void {
    this.fsm.advanceNightSubPhase();
    this.emitStateChanged();
    this.promptCurrentNightActors();
  }

  private resolveNightAndContinue(): void {
    const result = this.fsm.resolveNight();

    if (result.seerResult) {
      const seer = this.room.getState().players.find((p) => p.role === RoleName.SEER);
      if (seer) {
        this.emit('privateEvent', seer.id, ServerEvents.SEER_RESULT, result.seerResult);
      }
    }

    this.emit('broadcastEvent', ServerEvents.DAY_REVEAL, {
      dayCount: this.room.getState().dayCount,
      deaths: result.deathDetails,
    });
    this.emitStateChanged();

    if (result.hunterPendingShotIds.length > 0) {
      this.promptHunters(result.hunterPendingShotIds);
    } else {
      this.afterDeathsSettled();
    }
  }

  // ==================== Hunter retaliation ====================

  private promptHunters(hunterIds: string[]): void {
    this.pendingHunterIds = [...hunterIds];
    const eligibleTargetIds = this.room.getAlivePlayers().map((p) => p.id);
    for (const hunterId of hunterIds) {
      this.emit('privateEvent', hunterId, ServerEvents.HUNTER_PROMPT, {
        eligibleTargetIds,
        timeoutSeconds: TIMING.HUNTER_SHOT_TIMEOUT_SECONDS,
      });
    }
  }

  handleHunterShot(hunterId: string, targetId: string): void {
    if (!this.pendingHunterIds.includes(hunterId)) {
      throw new Error('Không phải lượt bắn của bạn.');
    }
    this.fsm.applyHunterShot(hunterId, targetId);
    this.pendingHunterIds = this.pendingHunterIds.filter((id) => id !== hunterId);
    this.emitStateChanged();

    if (this.pendingHunterIds.length === 0) {
      this.afterDeathsSettled();
    }
  }

  /** Called after any death-causing event (night, vote, Hunter shot) has fully settled. */
  private afterDeathsSettled(): void {
    const winner = this.fsm.checkWinAndMaybeEndGame();
    if (winner) {
      this.emitGameOver(winner);
      return;
    }

    const state = this.room.getState();
    if (state.phase === GamePhase.VOTING) {
      this.fsm.goToNextNight();
      this.emitStateChanged();
      this.promptCurrentNightActors();
    } else if (state.phase === GamePhase.DAY_REVEAL) {
      setTimeout(() => this.handleStartDiscussion(), TIMING.DAY_REVEAL_DISPLAY_MS);
    }
  }

  private emitGameOver(winningTeam: 'VILLAGER' | 'WEREWOLF'): void {
    this.clearTimers();
    this.emit('broadcastEvent', ServerEvents.GAME_OVER, {
      winningTeam,
      allPlayers: this.room.getState().players,
    });
    this.emitStateChanged();
  }

  // ==================== Night action entry points ====================
  // Each simply delegates to the FSM (which validates + throws
  // GameLogicError on invalid input) then advances the sub-phase.

  handleWerewolfTarget(playerId: string, targetId: string): void {
    this.fsm.submitWerewolfTarget(playerId, targetId);
    this.onNightActionSubmitted();
  }

  handleGuardTarget(playerId: string, targetId: string): void {
    this.fsm.submitGuardTarget(playerId, targetId);
    this.onNightActionSubmitted();
  }

  handleSeerTarget(playerId: string, targetId: string): void {
    this.fsm.submitSeerTarget(playerId, targetId);
    this.onNightActionSubmitted();
  }

  handleWitchAction(playerId: string, action: 'heal' | 'poison' | 'skip', targetId?: string): void {
    this.fsm.submitWitchAction(playerId, action, targetId);
    this.onNightActionSubmitted();
  }

  handleCupidTargets(playerId: string, targetId1: string, targetId2: string): void {
    this.fsm.submitCupidTargets(playerId, targetId1, targetId2);
    this.onNightActionSubmitted();
  }

  // ==================== Day flow ====================

  private handleStartDiscussion(): void {
    this.fsm.startDiscussion();
    this.emitStateChanged();
    const durationMs = this.room.getState().config.discussionDurationSeconds * 1000;
    this.discussionTimer = setTimeout(() => this.handleStartVoting(), durationMs);
  }

  private handleStartVoting(): void {
    if (this.discussionTimer) clearTimeout(this.discussionTimer);
    this.fsm.startVoting();
    this.emitStateChanged();
    this.scheduleVoteResolution();
  }

  private scheduleVoteResolution(): void {
    const durationMs = this.room.getState().config.votingDurationSeconds * 1000;
    this.votingTimer = setTimeout(() => this.handleResolveVoting(), durationMs);
  }

  handleVoteCast(voterId: string, targetId: string): void {
    this.fsm.submitVote(voterId, targetId);
    this.emit('broadcastEvent', ServerEvents.VOTE_TALLY, { tally: this.fsm.getVoteTally() });
  }

  private handleResolveVoting(): void {
    if (this.votingTimer) clearTimeout(this.votingTimer);
    const outcome = this.fsm.resolveVoting();
    const wasRevote = this.room.getState().votingSubPhase === VotingSubPhase.REVOTE;

    this.emit('broadcastEvent', ServerEvents.VOTE_RESULT, {
      eliminatedPlayerId: outcome.eliminatedPlayerId,
      wasRevote,
    });
    this.emitStateChanged();

    if (outcome.needsRevote) {
      this.scheduleVoteResolution();
      return;
    }

    if (outcome.hunterPendingShotIds.length > 0) {
      this.promptHunters(outcome.hunterPendingShotIds);
    } else {
      this.afterDeathsSettled();
    }
  }

  // ==================== Chat ====================

  handleChatMessage(playerId: string, nickname: string, text: string): void {
    this.emit('broadcastEvent', ServerEvents.CHAT_MESSAGE, {
      playerId,
      nickname,
      text,
      timestamp: Date.now(),
    });
  }

  // ==================== Cleanup ====================

  clearTimers(): void {
    if (this.discussionTimer) clearTimeout(this.discussionTimer);
    if (this.votingTimer) clearTimeout(this.votingTimer);
  }

  private emitStateChanged(): void {
    this.emit('stateChanged');
  }
}
