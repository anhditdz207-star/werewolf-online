import React, { createContext, useContext, useReducer } from 'react';
import {
  ChatMessagePayload,
  DayRevealPayload,
  GameOverPayload,
  GameState,
  HunterPromptPayload,
  NightPromptPayload,
  RoleAssignedPayload,
  SeerResultPayload,
} from '@werewolf/shared';

export interface GameUiState {
  myPlayerId: string | null;
  roomState: GameState | null;
  myRoleInfo: RoleAssignedPayload | null;
  nightPrompt: NightPromptPayload | null;
  seerResult: SeerResultPayload | null;
  lastDayReveal: DayRevealPayload | null;
  voteTally: Record<string, number>;
  hunterPrompt: HunterPromptPayload | null;
  gameOver: GameOverPayload | null;
  chatMessages: ChatMessagePayload[];
  errorMessage: string | null;
}

const initialState: GameUiState = {
  myPlayerId: null,
  roomState: null,
  myRoleInfo: null,
  nightPrompt: null,
  seerResult: null,
  lastDayReveal: null,
  voteTally: {},
  hunterPrompt: null,
  gameOver: null,
  chatMessages: [],
  errorMessage: null,
};

type Action =
  | { type: 'SET_MY_PLAYER_ID'; playerId: string }
  | { type: 'ROOM_STATE'; state: GameState }
  | { type: 'ROLE_ASSIGNED'; payload: RoleAssignedPayload }
  | { type: 'NIGHT_PROMPT'; payload: NightPromptPayload | null }
  | { type: 'SEER_RESULT'; payload: SeerResultPayload }
  | { type: 'DAY_REVEAL'; payload: DayRevealPayload }
  | { type: 'VOTE_TALLY'; tally: Record<string, number> }
  | { type: 'VOTE_RESULT_CLEAR_TALLY' }
  | { type: 'HUNTER_PROMPT'; payload: HunterPromptPayload | null }
  | { type: 'GAME_OVER'; payload: GameOverPayload }
  | { type: 'CHAT_MESSAGE'; payload: ChatMessagePayload }
  | { type: 'ERROR'; message: string | null }
  | { type: 'LEAVE_ROOM' };

function reducer(state: GameUiState, action: Action): GameUiState {
  switch (action.type) {
    case 'SET_MY_PLAYER_ID':
      return { ...state, myPlayerId: action.playerId };
    case 'ROOM_STATE':
      return { ...state, roomState: action.state };
    case 'ROLE_ASSIGNED':
      return { ...state, myRoleInfo: action.payload };
    case 'NIGHT_PROMPT':
      return { ...state, nightPrompt: action.payload };
    case 'SEER_RESULT':
      return { ...state, seerResult: action.payload };
    case 'DAY_REVEAL':
      return { ...state, lastDayReveal: action.payload, nightPrompt: null };
    case 'VOTE_TALLY':
      return { ...state, voteTally: action.tally };
    case 'VOTE_RESULT_CLEAR_TALLY':
      return { ...state, voteTally: {} };
    case 'HUNTER_PROMPT':
      return { ...state, hunterPrompt: action.payload };
    case 'GAME_OVER':
      return { ...state, gameOver: action.payload };
    case 'CHAT_MESSAGE':
      return { ...state, chatMessages: [...state.chatMessages, action.payload].slice(-200) };
    case 'ERROR':
      return { ...state, errorMessage: action.message };
    case 'LEAVE_ROOM':
      return { ...initialState, myPlayerId: state.myPlayerId };
    default:
      return state;
  }
}

const GameStateContext = createContext<GameUiState | null>(null);
const GameDispatchContext = createContext<React.Dispatch<Action> | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <GameStateContext.Provider value={state}>
      <GameDispatchContext.Provider value={dispatch}>{children}</GameDispatchContext.Provider>
    </GameStateContext.Provider>
  );
}

export function useGameState(): GameUiState {
  const ctx = useContext(GameStateContext);
  if (!ctx) throw new Error('useGameState must be used within GameProvider');
  return ctx;
}

export function useGameDispatch(): React.Dispatch<Action> {
  const ctx = useContext(GameDispatchContext);
  if (!ctx) throw new Error('useGameDispatch must be used within GameProvider');
  return ctx;
}
