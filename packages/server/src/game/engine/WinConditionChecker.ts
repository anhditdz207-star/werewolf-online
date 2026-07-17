import { Player, RoleName } from '@werewolf/shared';

export type WinResult = 'VILLAGER' | 'WEREWOLF' | null;

/**
 * Win conditions:
 *  - VILLAGER wins when zero werewolves remain alive.
 *  - WEREWOLF wins when alive werewolves >= alive non-werewolves (they
 *    can no longer be out-voted).
 *  - Returns null if neither condition is met (game continues).
 *
 * Call this after every death-causing event: night resolution, vote
 * elimination, AND hunter shots — any of these can end the game.
 */
export function checkWinCondition(players: Player[]): WinResult {
  const alive = players.filter((p) => p.isAlive);
  const aliveWerewolves = alive.filter((p) => p.role === RoleName.WEREWOLF).length;
  const aliveOthers = alive.length - aliveWerewolves;

  if (aliveWerewolves === 0) return 'VILLAGER';
  if (aliveWerewolves >= aliveOthers) return 'WEREWOLF';
  return null;
}
