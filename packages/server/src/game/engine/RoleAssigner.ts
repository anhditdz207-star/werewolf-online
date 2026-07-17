import { Player, RoleName, RoomConfig } from '@werewolf/shared';

/** Fisher-Yates shuffle — does not mutate the input array. */
function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Expands a roleCounts map (e.g. { WEREWOLF: 2, SEER: 1 }) into a flat
 * array of role assignments (e.g. [WEREWOLF, WEREWOLF, SEER]), padding
 * the remainder with VILLAGER up to `totalPlayers`.
 */
function buildRolePool(
  roleCounts: Partial<Record<RoleName, number>>,
  totalPlayers: number,
): RoleName[] {
  const pool: RoleName[] = [];
  for (const [role, count] of Object.entries(roleCounts) as [RoleName, number][]) {
    for (let i = 0; i < count; i++) {
      pool.push(role);
    }
  }
  while (pool.length < totalPlayers) {
    pool.push(RoleName.VILLAGER);
  }
  return pool;
}

/**
 * Assigns roles randomly to the given players. Returns NEW Player objects
 * (does not mutate input) with `role` and role-specific state initialized.
 *
 * Caller is responsible for validating the config beforehand
 * (see config/roleRules.ts) — this function assumes a valid distribution.
 */
export function assignRoles(players: Player[], config: RoomConfig): Player[] {
  const rolePool = shuffle(buildRolePool(config.roleCounts, players.length));

  return players.map((player, index) => {
    const role = rolePool[index];
    return {
      ...player,
      role,
      witchState:
        role === RoleName.WITCH ? { hasHealPotion: true, hasPoisonPotion: true } : null,
      guardState: role === RoleName.GUARD ? { lastProtectedPlayerId: null } : null,
    };
  });
}
