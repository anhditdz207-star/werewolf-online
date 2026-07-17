import { DeathCause, Player, RoleName } from '@werewolf/shared';
import { applyDeaths } from './DeathResolver';

/**
 * Draft of everything each role decided during the NIGHT phase, collected
 * by GameStateMachine as sub-phases progress. `null` fields mean that
 * role either isn't in the game, has no living player, or chose to skip.
 */
export interface NightActionsDraft {
  wolfTargetId: string | null;
  seerTargetId: string | null;
  guardTargetId: string | null;
  witchAction: { type: 'heal' | 'poison' | 'skip'; targetId: string | null };
  /** Only ever set on day 1 (Cupid's only night of action). */
  cupidTargetIds: [string, string] | null;
}

export function createEmptyNightDraft(): NightActionsDraft {
  return {
    wolfTargetId: null,
    seerTargetId: null,
    guardTargetId: null,
    witchAction: { type: 'skip', targetId: null },
    cupidTargetIds: null,
  };
}

export interface NightResolutionResult {
  updatedPlayers: Player[];
  killedPlayerIds: string[];
  deathDetails: Array<{ playerId: string; cause: DeathCause }>;
  seerResult: { targetId: string; isWerewolf: boolean } | null;
  hunterPendingShotIds: string[];
}

/**
 * Resolves one night. Does not mutate its inputs — returns new Player
 * objects. Rule assumptions encoded here:
 *
 *  - Witch's heal only saves the werewolves' chosen victim (the witch
 *    never sees/chooses any other target for the heal potion). Self-heal
 *    IS allowed if the witch herself is that victim.
 *  - Witch may use at most one potion per night (heal OR poison, not
 *    both) — enforced by the `witchAction` shape (a single `type`).
 *  - Poison always kills, regardless of Guard protection (Guard only
 *    protects against the werewolves' attack).
 *  - If the werewolves' victim is also the poison target, the recorded
 *    cause is WITCH_POISON (display-only distinction; the player is dead
 *    either way).
 *  - Cupid lover cascade and Hunter detection are delegated to
 *    DeathResolver.applyDeaths so that logic isn't duplicated with
 *    vote-elimination and Hunter's own shot.
 */
export function resolveNight(
  players: Player[],
  draft: NightActionsDraft,
  dayCount: number,
): NightResolutionResult {
  // Work on copies so this function has zero side effects on its inputs.
  let working: Player[] = players.map((p) => ({ ...p }));
  const byId = new Map(working.map((p) => [p.id, p]));

  // 1. Cupid pairing (first night only).
  if (dayCount === 1 && draft.cupidTargetIds) {
    const [id1, id2] = draft.cupidTargetIds;
    const p1 = byId.get(id1);
    const p2 = byId.get(id2);
    if (p1 && p2) {
      p1.loverId = id2;
      p2.loverId = id1;
    }
  }

  const initialDeaths = new Map<string, DeathCause>();

  // 2. Werewolf attack, subject to Guard protection and Witch heal.
  const wolfVictim = draft.wolfTargetId ? byId.get(draft.wolfTargetId) : undefined;
  const savedByGuard = wolfVictim !== undefined && draft.guardTargetId === wolfVictim.id;
  const savedByWitch =
    wolfVictim !== undefined &&
    draft.witchAction.type === 'heal' &&
    draft.witchAction.targetId === wolfVictim.id;

  if (wolfVictim && !savedByGuard && !savedByWitch) {
    initialDeaths.set(wolfVictim.id, DeathCause.WEREWOLF);
  }

  // 3. Witch poison — unconditional, overrides werewolf cause if same target.
  if (draft.witchAction.type === 'poison' && draft.witchAction.targetId) {
    initialDeaths.set(draft.witchAction.targetId, DeathCause.WITCH_POISON);
  }

  // 4. Persist Guard's target for the "no repeat target" rule next night.
  const guardPlayer = working.find((p) => p.role === RoleName.GUARD);
  if (guardPlayer && guardPlayer.guardState) {
    guardPlayer.guardState = { lastProtectedPlayerId: draft.guardTargetId };
  }

  // 5. Consume Witch's potion if she acted (even if the heal "missed").
  const witchPlayer = working.find((p) => p.role === RoleName.WITCH);
  if (witchPlayer && witchPlayer.witchState) {
    if (draft.witchAction.type === 'heal') {
      witchPlayer.witchState = { ...witchPlayer.witchState, hasHealPotion: false };
    } else if (draft.witchAction.type === 'poison') {
      witchPlayer.witchState = { ...witchPlayer.witchState, hasPoisonPotion: false };
    }
  }

  // 6. Apply deaths (handles lover cascade + Hunter detection centrally).
  const { updatedPlayers, deathDetails, hunterPendingShotIds } = applyDeaths(
    working,
    initialDeaths,
    dayCount,
  );
  working = updatedPlayers;

  // 7. Seer's private result (computed regardless of who died tonight).
  let seerResult: NightResolutionResult['seerResult'] = null;
  if (draft.seerTargetId) {
    const target = working.find((p) => p.id === draft.seerTargetId);
    if (target) {
      seerResult = { targetId: target.id, isWerewolf: target.role === RoleName.WEREWOLF };
    }
  }

  return {
    updatedPlayers: working,
    killedPlayerIds: deathDetails.map((d) => d.playerId),
    deathDetails,
    seerResult,
    hunterPendingShotIds,
  };
}
