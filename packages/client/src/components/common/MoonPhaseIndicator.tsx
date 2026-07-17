import { GamePhase } from '@werewolf/shared';

interface MoonPhaseIndicatorProps {
  phase: GamePhase | null;
}

/**
 * Renders a moon whose illuminated fraction communicates the current
 * phase at a glance: crescent for NIGHT, full/glowing for
 * DISCUSSION/DAY_REVEAL, half-lit for VOTING (the "judgment" moment),
 * new/dark for WAITING. This is the app's one signature visual element —
 * everything else stays quiet around it.
 */
export function MoonPhaseIndicator({ phase }: MoonPhaseIndicatorProps) {
  const litFraction = getLitFraction(phase);
  const label = getPhaseLabel(phase);

  return (
    <div className="flex flex-col items-center gap-1" role="img" aria-label={label}>
      <svg
        width="56"
        height="56"
        viewBox="0 0 56 56"
        className="drop-shadow-[0_0_12px_rgba(244,213,141,0.35)]"
      >
        <circle cx="28" cy="28" r="24" fill="#1F2D4A" stroke="#546077" strokeWidth="1" />
        <clipPath id="moon-clip">
          <circle cx="28" cy="28" r="24" />
        </clipPath>
        <rect
          x={28 - 24 + 48 * (1 - litFraction)}
          y="4"
          width="48"
          height="48"
          fill="#F4D58D"
          clipPath="url(#moon-clip)"
          style={{ transition: 'x 700ms ease' }}
        />
      </svg>
      <span className="text-xs font-body text-mist-400 tracking-wide">{label}</span>
    </div>
  );
}

function getLitFraction(phase: GamePhase | null): number {
  switch (phase) {
    case GamePhase.NIGHT:
      return 0.18;
    case GamePhase.VOTING:
      return 0.5;
    case GamePhase.DAY_REVEAL:
    case GamePhase.DISCUSSION:
      return 1;
    case GamePhase.GAME_OVER:
      return 1;
    case GamePhase.ROLE_ASSIGN:
      return 0.3;
    default:
      return 0.05;
  }
}

function getPhaseLabel(phase: GamePhase | null): string {
  switch (phase) {
    case GamePhase.WAITING:
      return 'Chờ người chơi';
    case GamePhase.ROLE_ASSIGN:
      return 'Nhận vai trò';
    case GamePhase.NIGHT:
      return 'Ban đêm';
    case GamePhase.DAY_REVEAL:
      return 'Bình minh';
    case GamePhase.DISCUSSION:
      return 'Thảo luận';
    case GamePhase.VOTING:
      return 'Bỏ phiếu';
    case GamePhase.GAME_OVER:
      return 'Kết thúc';
    default:
      return '';
  }
}
