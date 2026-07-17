export enum Team {
  VILLAGER = 'VILLAGER',
  WEREWOLF = 'WEREWOLF',
}

export enum RoleName {
  WEREWOLF = 'WEREWOLF',
  VILLAGER = 'VILLAGER',
  SEER = 'SEER',
  GUARD = 'GUARD',
  WITCH = 'WITCH',
  HUNTER = 'HUNTER',
  CUPID = 'CUPID',
}

/**
 * Static metadata about a role. This is NOT per-player state (that lives in
 * Player.roleState on the server) — it's the fixed rulebook definition.
 */
export interface RoleDefinition {
  name: RoleName;
  team: Team;
  /** Vietnamese display name, shown in UI. */
  displayNameVi: string;
  /** Short rule description shown in the role-reveal modal. */
  descriptionVi: string;
  /** Whether this role takes an action during the NIGHT phase. */
  hasNightAction: boolean;
}

export const ROLE_DEFINITIONS: Record<RoleName, RoleDefinition> = {
  [RoleName.WEREWOLF]: {
    name: RoleName.WEREWOLF,
    team: Team.WEREWOLF,
    displayNameVi: 'Ma Sói',
    descriptionVi: 'Mỗi đêm, cùng các Sói khác chọn một người để cắn chết.',
    hasNightAction: true,
  },
  [RoleName.VILLAGER]: {
    name: RoleName.VILLAGER,
    team: Team.VILLAGER,
    displayNameVi: 'Dân thường',
    descriptionVi: 'Không có kỹ năng đặc biệt. Dùng lời nói và lá phiếu để tìm Sói.',
    hasNightAction: false,
  },
  [RoleName.SEER]: {
    name: RoleName.SEER,
    team: Team.VILLAGER,
    displayNameVi: 'Tiên tri',
    descriptionVi: 'Mỗi đêm, soi một người để biết họ thuộc phe Sói hay phe Dân.',
    hasNightAction: true,
  },
  [RoleName.GUARD]: {
    name: RoleName.GUARD,
    team: Team.VILLAGER,
    displayNameVi: 'Bảo vệ',
    descriptionVi:
      'Mỗi đêm, chọn một người để bảo vệ khỏi Sói. Không được bảo vệ cùng một người hai đêm liên tiếp.',
    hasNightAction: true,
  },
  [RoleName.WITCH]: {
    name: RoleName.WITCH,
    team: Team.VILLAGER,
    displayNameVi: 'Phù thủy',
    descriptionVi:
      'Có một bình thuốc cứu và một bình thuốc độc, mỗi loại dùng được một lần trong cả game. ' +
      'Chỉ được dùng một bình mỗi đêm.',
    hasNightAction: true,
  },
  [RoleName.HUNTER]: {
    name: RoleName.HUNTER,
    team: Team.VILLAGER,
    displayNameVi: 'Thợ săn',
    descriptionVi: 'Khi chết (vì bất kỳ lý do gì), được bắn chết ngay một người khác.',
    hasNightAction: false,
  },
  [RoleName.CUPID]: {
    name: RoleName.CUPID,
    team: Team.VILLAGER,
    displayNameVi: 'Cupid',
    descriptionVi:
      'Chỉ đêm đầu tiên, chọn hai người trở thành một cặp tình nhân. ' +
      'Nếu một người chết, người còn lại cũng chết theo.',
    hasNightAction: true,
  },
};
