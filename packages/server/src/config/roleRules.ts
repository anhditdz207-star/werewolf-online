import { RoleName } from '@werewolf/shared';

export const MIN_PLAYERS = 6;
export const MAX_PLAYERS = 20;

/**
 * Roles that can only ever have at most 1 instance in a game.
 * (Werewolf is intentionally excluded — you can have multiple.)
 */
export const SINGLE_INSTANCE_ROLES: RoleName[] = [
  RoleName.SEER,
  RoleName.GUARD,
  RoleName.WITCH,
  RoleName.HUNTER,
  RoleName.CUPID,
];

export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates a role distribution against a given player count.
 * Rules enforced:
 *  - total players within [MIN_PLAYERS, MAX_PLAYERS]
 *  - sum of assigned roles <= total players (rest become VILLAGER)
 *  - single-instance roles never exceed count of 1
 *  - at least 1 werewolf required
 *  - werewolves must be strictly less than half the players (else werewolf
 *    team would start the game already at/above win threshold)
 */
export function validateRoomConfig(
  roleCounts: Partial<Record<RoleName, number>>,
  totalPlayers: number,
): ConfigValidationResult {
  const errors: string[] = [];

  if (totalPlayers < MIN_PLAYERS) {
    errors.push(`Cần tối thiểu ${MIN_PLAYERS} người chơi.`);
  }
  if (totalPlayers > MAX_PLAYERS) {
    errors.push(`Tối đa ${MAX_PLAYERS} người chơi.`);
  }

  const werewolfCount = roleCounts[RoleName.WEREWOLF] ?? 0;
  if (werewolfCount < 1) {
    errors.push('Cần ít nhất 1 Ma Sói.');
  }
  if (werewolfCount * 2 >= totalPlayers) {
    errors.push('Số lượng Ma Sói phải nhỏ hơn một nửa tổng số người chơi.');
  }

  for (const role of SINGLE_INSTANCE_ROLES) {
    const count = roleCounts[role] ?? 0;
    if (count > 1) {
      errors.push(`Vai trò ${role} chỉ được có tối đa 1 người.`);
    }
  }

  const totalAssigned = Object.values(roleCounts).reduce<number>(
    (sum, n) => sum + (n ?? 0),
    0,
  );
  if (totalAssigned > totalPlayers) {
    errors.push('Tổng số vai trò được cấu hình vượt quá số người chơi.');
  }

  return { isValid: errors.length === 0, errors };
}
