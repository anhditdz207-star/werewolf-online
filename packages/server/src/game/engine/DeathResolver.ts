import { DeathCause, Player, RoleName } from '@werewolf/shared';

export interface DeathApplicationResult {
  updatedPlayers: Player[];
  deathDetails: Array<{ playerId: string; cause: DeathCause }>;
  /** Newly-dead players holding the Hunter role — caller must prompt
   * them to shoot before the game state is considered settled. */
  hunterPendingShotIds: string[];
}

/**
 * Applies a set of initial deaths to the player list, then resolves the
 * Cupid lover cascade to a fixpoint (in case of chained pairs — not
 * possible with a single Cupid, but this stays correct if that rule
 * ever changes), and detects any newly-dead Hunters.
 *
 * This is the ONLY place that marks a player as dead. Night resolution,
 * vote elimination, and Hunter's own retaliation shot all funnel through
 * here so the lover/Hunter rules can never be implemented inconsistently
 * in two places.
 */
export function applyDeaths(
  players: Player[],
  initialDeaths: Map<string, DeathCause>,
  dayCount: number,
): DeathApplicationResult {
  const updated = players.map((p) => ({ ...p }));
  const byId = new Map(updated.map((p) => [p.id, p]));
  const deathCauseById = new Map(initialDeaths);

  let changed = true;
  while (changed) {
    changed = false;
    for (const deadId of Array.from(deathCauseById.keys())) {
      const deadPlayer = byId.get(deadId);
      const loverId = deadPlayer?.loverId;
      if (loverId && !deathCauseById.has(loverId)) {
        const lover = byId.get(loverId);
        if (lover && lover.isAlive) {
          deathCauseById.set(loverId, DeathCause.LOVER_HEARTBREAK);
          changed = true;
        }
      }
    }
  }

  const hunterPendingShotIds: string[] = [];
  const deathDetails: Array<{ playerId: string; cause: DeathCause }> = [];
  for (const [playerId, cause] of deathCauseById.entries()) {
    const player = byId.get(playerId);
    if (!player || !player.isAlive) continue; // already dead, ignore
    player.isAlive = false;
    player.deathCause = cause;
    player.diedOnDay = dayCount;
    deathDetails.push({ playerId, cause });
    if (player.role === RoleName.HUNTER) {
      hunterPendingShotIds.push(playerId);
    }
  }

  return { updatedPlayers: updated, deathDetails, hunterPendingShotIds };
}
