import {
  DeathCause,
  GamePhase,
  GameState,
  NightSubPhase,
  Player,
  RoleName,
  VotingSubPhase,
} from '@werewolf/shared';
import { validateRoomConfig } from '../../config/roleRules';
import { Room } from '../../rooms/Room';
import { GameLogicError } from '../GameLogicError';
import { assignRoles } from '../engine/RoleAssigner';
import { applyDeaths } from '../engine/DeathResolver';
import {
  createEmptyNightDraft,
  NightActionsDraft,
  NightResolutionResult,
  resolveNight as resolveNightPure,
} from '../engine/NightResolver';
import { resolveVotes, VoteResolutionResult } from '../engine/VoteResolver';
import { checkWinCondition, WinResult } from '../engine/WinConditionChecker';
import { getApplicableNightSubPhases, getNextNightSubPhase } from './NightOrder';

export interface VoteRoundOutcome extends VoteResolutionResult {
  deathDetails: Array<{ playerId: string; cause: DeathCause }>;
  hunterPendingShotIds: string[];
}

export interface HunterShotOutcome {
  deathDetails: Array<{ playerId: string; cause: DeathCause }>;
}

/**
 * GameStateMachine — owns the phase-transition logic for exactly one
 * room. One instance is created per active game (see GameSession in the
 * socket layer). It reads/writes the Room's GameState directly but has
 * NO knowledge of Socket.IO, timers, or broadcasting — callers (socket
 * event handlers) decide when to call each method and what to do with
 * the results (e.g. emit events, start a countdown).
 *
 * Two pieces of state live outside the shared GameState on purpose,
 * because they're either transient or privacy-sensitive and shouldn't be
 * broadcast to all clients before resolution:
 *   - `nightDraft` — in-progress night action choices (would leak, e.g.,
 *     the Seer's target, if broadcast)
 *   - `votes` / `tiedCandidateIds` — kept here so a live tally can be
 *     computed on demand without exposing raw ballots in GameState
 */
export class GameStateMachine {
  private nightDraft: NightActionsDraft = createEmptyNightDraft();
  private applicableNightSubPhases: NightSubPhase[] = [];
  private votes: Record<string, string> = {};
  private tiedCandidateIds: string[] | null = null;

  constructor(private room: Room) {}

  private get state(): GameState {
    return this.room._internalStateForFsm();
  }

  // ==================== WAITING -> ROLE_ASSIGN -> NIGHT ====================

  startGame(requestingPlayerId: string): void {
    const state = this.state;
    if (state.phase !== GamePhase.WAITING) {
      throw new GameLogicError('Ván đấu đã bắt đầu rồi.', 'ALREADY_STARTED');
    }
    if (state.hostPlayerId !== requestingPlayerId) {
      throw new GameLogicError('Chỉ chủ phòng mới được bắt đầu ván đấu.', 'NOT_HOST');
    }
    const validation = validateRoomConfig(state.config.roleCounts, state.players.length);
    if (!validation.isValid) {
      throw new GameLogicError(validation.errors.join(' '), 'INVALID_CONFIG');
    }

    state.players = assignRoles(state.players, state.config);
    state.phase = GamePhase.ROLE_ASSIGN;
  }

  /** Called once clients have acknowledged their role reveal (e.g. after a fixed UI delay). */
  beginFirstNight(): void {
    const state = this.state;
    if (state.phase !== GamePhase.ROLE_ASSIGN) {
      throw new GameLogicError('Ván đấu chưa sẵn sàng để vào đêm đầu tiên.', 'WRONG_PHASE');
    }
    state.dayCount = 1;
    this.enterNightPhase();
  }

  private enterNightPhase(): void {
    const state = this.state;
    state.phase = GamePhase.NIGHT;
    state.votingSubPhase = null;
    this.nightDraft = createEmptyNightDraft();
    this.applicableNightSubPhases = getApplicableNightSubPhases(state.players, state.dayCount);
    state.nightSubPhase = this.applicableNightSubPhases[0] ?? NightSubPhase.RESOLVING;
  }

  // ==================== NIGHT sub-phase actions ====================

  /** Ids of players who should currently be prompted to act. */
  getCurrentNightActorIds(): string[] {
    const state = this.state;
    if (state.phase !== GamePhase.NIGHT || !state.nightSubPhase) return [];
    const role = this.roleForSubPhase(state.nightSubPhase);
    if (!role) return [];
    return state.players.filter((p) => p.isAlive && p.role === role).map((p) => p.id);
  }

  /** Valid targets a player may currently choose from. */
  getEligibleTargets(subPhase: NightSubPhase): string[] {
    const alivePlayers = this.state.players.filter((p) => p.isAlive);
    if (subPhase === NightSubPhase.WEREWOLF) {
      // Werewolves cannot target each other.
      return alivePlayers.filter((p) => p.role !== RoleName.WEREWOLF).map((p) => p.id);
    }
    return alivePlayers.map((p) => p.id);
  }

  private roleForSubPhase(subPhase: NightSubPhase): RoleName | null {
    switch (subPhase) {
      case NightSubPhase.CUPID:
        return RoleName.CUPID;
      case NightSubPhase.WEREWOLF:
        return RoleName.WEREWOLF;
      case NightSubPhase.GUARD:
        return RoleName.GUARD;
      case NightSubPhase.WITCH:
        return RoleName.WITCH;
      case NightSubPhase.SEER:
        return RoleName.SEER;
      default:
        return null;
    }
  }

  private assertNightSubPhase(playerId: string, expected: NightSubPhase): Player {
    const state = this.state;
    if (state.phase !== GamePhase.NIGHT || state.nightSubPhase !== expected) {
      throw new GameLogicError('Chưa đến lượt của vai trò này.', 'WRONG_SUBPHASE');
    }
    const player = state.players.find((p) => p.id === playerId);
    if (!player || !player.isAlive) {
      throw new GameLogicError('Người chơi không hợp lệ hoặc đã chết.', 'INVALID_PLAYER');
    }
    return player;
  }

  private assertAliveTarget(targetId: string): Player {
    const target = this.state.players.find((p) => p.id === targetId);
    if (!target || !target.isAlive) {
      throw new GameLogicError('Mục tiêu không hợp lệ hoặc đã chết.', 'INVALID_TARGET');
    }
    return target;
  }

  submitWerewolfTarget(playerId: string, targetId: string): void {
    const player = this.assertNightSubPhase(playerId, NightSubPhase.WEREWOLF);
    if (player.role !== RoleName.WEREWOLF) {
      throw new GameLogicError('Bạn không phải Ma Sói.', 'WRONG_ROLE');
    }
    const target = this.assertAliveTarget(targetId);
    if (target.role === RoleName.WEREWOLF) {
      throw new GameLogicError('Không thể chọn đồng đội Ma Sói làm mục tiêu.', 'INVALID_TARGET');
    }
    // Any werewolf may (re-)submit; last submission before the sub-phase
    // advances is the team's final decision (consensus is coordinated via
    // the werewolves' own chat, outside this state machine).
    this.nightDraft.wolfTargetId = targetId;
  }

  submitGuardTarget(playerId: string, targetId: string): void {
    const player = this.assertNightSubPhase(playerId, NightSubPhase.GUARD);
    if (player.role !== RoleName.GUARD) {
      throw new GameLogicError('Bạn không phải Bảo vệ.', 'WRONG_ROLE');
    }
    this.assertAliveTarget(targetId);
    if (player.guardState && player.guardState.lastProtectedPlayerId === targetId) {
      throw new GameLogicError(
        'Không thể bảo vệ cùng một người hai đêm liên tiếp.',
        'REPEAT_TARGET',
      );
    }
    this.nightDraft.guardTargetId = targetId;
  }

  submitSeerTarget(playerId: string, targetId: string): void {
    const player = this.assertNightSubPhase(playerId, NightSubPhase.SEER);
    if (player.role !== RoleName.SEER) {
      throw new GameLogicError('Bạn không phải Tiên tri.', 'WRONG_ROLE');
    }
    this.assertAliveTarget(targetId);
    this.nightDraft.seerTargetId = targetId;
  }

  submitWitchAction(
    playerId: string,
    action: 'heal' | 'poison' | 'skip',
    targetId?: string,
  ): void {
    const player = this.assertNightSubPhase(playerId, NightSubPhase.WITCH);
    if (player.role !== RoleName.WITCH || !player.witchState) {
      throw new GameLogicError('Bạn không phải Phù thủy.', 'WRONG_ROLE');
    }

    if (action === 'heal') {
      if (!player.witchState.hasHealPotion) {
        throw new GameLogicError('Bạn đã dùng hết thuốc cứu.', 'NO_POTION');
      }
      if (!this.nightDraft.wolfTargetId) {
        throw new GameLogicError('Không có ai bị Sói cắn đêm nay để cứu.', 'NO_VICTIM');
      }
      // Assumption: heal can only target the werewolves' chosen victim
      // (the witch doesn't get to freely heal anyone else).
      if (targetId && targetId !== this.nightDraft.wolfTargetId) {
        throw new GameLogicError(
          'Chỉ có thể cứu người bị Sói cắn đêm nay.',
          'INVALID_HEAL_TARGET',
        );
      }
      this.nightDraft.witchAction = { type: 'heal', targetId: this.nightDraft.wolfTargetId };
    } else if (action === 'poison') {
      if (!player.witchState.hasPoisonPotion) {
        throw new GameLogicError('Bạn đã dùng hết thuốc độc.', 'NO_POTION');
      }
      if (!targetId) {
        throw new GameLogicError('Cần chọn một mục tiêu để đầu độc.', 'MISSING_TARGET');
      }
      this.assertAliveTarget(targetId);
      this.nightDraft.witchAction = { type: 'poison', targetId };
    } else {
      this.nightDraft.witchAction = { type: 'skip', targetId: null };
    }
  }

  submitCupidTargets(playerId: string, targetId1: string, targetId2: string): void {
    const player = this.assertNightSubPhase(playerId, NightSubPhase.CUPID);
    if (player.role !== RoleName.CUPID) {
      throw new GameLogicError('Bạn không phải Cupid.', 'WRONG_ROLE');
    }
    if (targetId1 === targetId2) {
      throw new GameLogicError('Phải chọn hai người khác nhau.', 'INVALID_TARGETS');
    }
    this.assertAliveTarget(targetId1);
    this.assertAliveTarget(targetId2);
    this.nightDraft.cupidTargetIds = [targetId1, targetId2];
  }

  /** Moves to the next applicable night sub-phase. Returns the new sub-phase. */
  advanceNightSubPhase(): NightSubPhase {
    const state = this.state;
    if (state.phase !== GamePhase.NIGHT || !state.nightSubPhase) {
      throw new GameLogicError('Không ở trong pha Đêm.', 'WRONG_PHASE');
    }
    const next = getNextNightSubPhase(state.nightSubPhase, this.applicableNightSubPhases);
    state.nightSubPhase = next;
    return next;
  }

  isReadyToResolveNight(): boolean {
    return this.state.nightSubPhase === NightSubPhase.RESOLVING;
  }

  /** Resolves the night, applies results to state, and transitions to DAY_REVEAL. */
  resolveNight(): NightResolutionResult {
    const state = this.state;
    if (state.nightSubPhase !== NightSubPhase.RESOLVING) {
      throw new GameLogicError('Chưa sẵn sàng để xử lý kết quả đêm.', 'NOT_READY');
    }
    const result = resolveNightPure(state.players, this.nightDraft, state.dayCount);
    state.players = result.updatedPlayers;
    state.history.nights.push({
      dayNumber: state.dayCount,
      killedPlayerIds: result.killedPlayerIds,
      deathDetails: result.deathDetails.map((d) => ({ playerId: d.playerId, cause: d.cause })),
    });
    state.phase = GamePhase.DAY_REVEAL;
    state.nightSubPhase = null;
    return result;
  }

  // ==================== Hunter retaliation ====================

  /**
   * Called whenever a Hunter has just died (from night resolution, a
   * vote, or — in principle — another Hunter's shot) and chooses their
   * target. Callers must always follow this with checkWinAndMaybeEndGame().
   */
  applyHunterShot(hunterId: string, targetId: string): HunterShotOutcome {
    const state = this.state;
    const hunter = state.players.find((p) => p.id === hunterId);
    if (!hunter || hunter.role !== RoleName.HUNTER || hunter.isAlive) {
      throw new GameLogicError('Chỉ Thợ săn vừa chết mới được bắn trả đũa.', 'INVALID_HUNTER');
    }
    const target = this.assertAliveTarget(targetId);
    if (target.id === hunterId) {
      throw new GameLogicError('Không thể tự bắn chính mình.', 'INVALID_TARGET');
    }
    const deaths = new Map<string, DeathCause>([[targetId, DeathCause.HUNTER_SHOT]]);
    const applied = applyDeaths(state.players, deaths, state.dayCount);
    state.players = applied.updatedPlayers;
    return { deathDetails: applied.deathDetails };
  }

  // ==================== DAY_REVEAL -> DISCUSSION -> VOTING ====================

  startDiscussion(): void {
    const state = this.state;
    if (state.phase !== GamePhase.DAY_REVEAL) {
      throw new GameLogicError('Sai giai đoạn.', 'WRONG_PHASE');
    }
    state.phase = GamePhase.DISCUSSION;
  }

  startVoting(): void {
    const state = this.state;
    if (state.phase !== GamePhase.DISCUSSION) {
      throw new GameLogicError('Sai giai đoạn.', 'WRONG_PHASE');
    }
    state.phase = GamePhase.VOTING;
    state.votingSubPhase = VotingSubPhase.FIRST_VOTE;
    this.votes = {};
    this.tiedCandidateIds = null;
  }

  submitVote(voterId: string, targetId: string): void {
    const state = this.state;
    if (state.phase !== GamePhase.VOTING) {
      throw new GameLogicError('Không ở trong pha bỏ phiếu.', 'WRONG_PHASE');
    }
    const voter = state.players.find((p) => p.id === voterId);
    if (!voter || !voter.isAlive) {
      throw new GameLogicError('Chỉ người chơi còn sống mới được bỏ phiếu.', 'INVALID_VOTER');
    }
    this.assertAliveTarget(targetId);
    if (voterId === targetId) {
      throw new GameLogicError('Không thể tự bỏ phiếu cho chính mình.', 'SELF_VOTE');
    }
    if (this.tiedCandidateIds && !this.tiedCandidateIds.includes(targetId)) {
      throw new GameLogicError(
        'Vòng bầu lại chỉ được chọn trong số người bị hòa phiếu.',
        'INVALID_REVOTE_TARGET',
      );
    }
    this.votes[voterId] = targetId;
  }

  /** Live tally, safe to broadcast periodically while voting is in progress. */
  getVoteTally(): Record<string, number> {
    const tally: Record<string, number> = {};
    for (const targetId of Object.values(this.votes)) {
      tally[targetId] = (tally[targetId] ?? 0) + 1;
    }
    return tally;
  }

  /**
   * Resolves the current voting round. On a tie in FIRST_VOTE, switches
   * to REVOTE (restricted to tied candidates) and returns needsRevote:
   * true — caller should re-open voting UI rather than proceed. On a
   * resolved elimination (or a REVOTE that ties again, per project
   * rules), applies the result and returns the outcome for broadcasting.
   */
  resolveVoting(): VoteRoundOutcome {
    const state = this.state;
    if (state.phase !== GamePhase.VOTING || !state.votingSubPhase) {
      throw new GameLogicError('Không ở trong pha bỏ phiếu.', 'WRONG_PHASE');
    }
    const aliveIds = state.players.filter((p) => p.isAlive).map((p) => p.id);
    const result = resolveVotes(this.votes, aliveIds, state.votingSubPhase);

    if (result.needsRevote) {
      state.votingSubPhase = VotingSubPhase.REVOTE;
      this.tiedCandidateIds = result.tiedPlayerIds;
      this.votes = {};
      return { ...result, deathDetails: [], hunterPendingShotIds: [] };
    }

    let deathDetails: Array<{ playerId: string; cause: DeathCause }> = [];
    let hunterPendingShotIds: string[] = [];
    if (result.eliminatedPlayerId) {
      const deaths = new Map<string, DeathCause>([
        [result.eliminatedPlayerId, DeathCause.VOTED_OUT],
      ]);
      const applied = applyDeaths(state.players, deaths, state.dayCount);
      state.players = applied.updatedPlayers;
      deathDetails = applied.deathDetails;
      hunterPendingShotIds = applied.hunterPendingShotIds;
    }

    state.history.votes.push({
      round: state.votingSubPhase,
      votes: { ...this.votes },
      eliminatedPlayerId: result.eliminatedPlayerId,
    });

    return { ...result, deathDetails, hunterPendingShotIds };
  }

  // ==================== Win condition & loop ====================

  /** Call after any death-causing event settles (night, vote, Hunter shot). */
  checkWinAndMaybeEndGame(): WinResult {
    const state = this.state;
    const winner = checkWinCondition(state.players);
    if (winner) {
      state.winningTeam = winner;
      state.phase = GamePhase.GAME_OVER;
    }
    return winner;
  }

  /** Call when voting resolved with no winner yet — loops back to NIGHT. */
  goToNextNight(): void {
    this.state.dayCount += 1;
    this.enterNightPhase();
  }

  getState(): Readonly<GameState> {
    return this.state;
  }
}
