import { NightSubPhase, Player, RoleName } from '@werewolf/shared';

const FULL_SEQUENCE: NightSubPhase[] = [
  NightSubPhase.CUPID,
  NightSubPhase.WEREWOLF,
  NightSubPhase.GUARD,
  NightSubPhase.WITCH,
  NightSubPhase.SEER,
  NightSubPhase.RESOLVING,
];

const SUBPHASE_ROLE: Partial<Record<NightSubPhase, RoleName>> = {
  [NightSubPhase.CUPID]: RoleName.CUPID,
  [NightSubPhase.WEREWOLF]: RoleName.WEREWOLF,
  [NightSubPhase.GUARD]: RoleName.GUARD,
  [NightSubPhase.WITCH]: RoleName.WITCH,
  [NightSubPhase.SEER]: RoleName.SEER,
};

/**
 * Returns the ordered list of sub-phases that should actually happen
 * tonight — skipping roles with no living player, and skipping CUPID
 * entirely after the first night. RESOLVING is always included as the
 * terminal marker.
 */
export function getApplicableNightSubPhases(
  players: Player[],
  dayCount: number,
): NightSubPhase[] {
  return FULL_SEQUENCE.filter((subPhase) => {
    if (subPhase === NightSubPhase.RESOLVING) return true;
    if (subPhase === NightSubPhase.CUPID) {
      if (dayCount !== 1) return false;
      return players.some((p) => p.role === RoleName.CUPID && p.isAlive);
    }

    const role = SUBPHASE_ROLE[subPhase];
    if (!role) return false;

    if (role === RoleName.WITCH) {
      const witch = players.find((p) => p.role === RoleName.WITCH && p.isAlive);
      return !!witch && witch.witchState !== null &&
        (witch.witchState.hasHealPotion || witch.witchState.hasPoisonPotion);
    }

    return players.some((p) => p.role === role && p.isAlive);
  });
}

/** Returns the next sub-phase after `current` within the applicable list. */
export function getNextNightSubPhase(
  current: NightSubPhase,
  applicable: NightSubPhase[],
): NightSubPhase {
  const idx = applicable.indexOf(current);
  if (idx === -1 || idx === applicable.length - 1) {
    return NightSubPhase.RESOLVING;
  }
  return applicable[idx + 1];
}
