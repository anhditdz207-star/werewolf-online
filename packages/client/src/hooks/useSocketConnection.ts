import { useEffect } from 'react';
import {
  ChatMessagePayload,
  DayRevealPayload,
  GameOverPayload,
  HunterPromptPayload,
  NightPromptPayload,
  RoleAssignedPayload,
  RoomErrorPayload,
  RoomStatePayload,
  SeerResultPayload,
  ServerEvents,
  VoteResultPayload,
  VoteTallyPayload,
} from '@werewolf/shared';
import { socket } from '../lib/socket';
import { useGameDispatch } from '../store/GameContext';

/**
 * Subscribes to every ServerEvents.* event once and translates each into
 * a reducer action. This is the ONLY place that listens on the raw
 * socket — components never call socket.on directly, they read from
 * useGameState() instead. Keeps the socket <-> state mapping in one
 * auditable place.
 */
export function useSocketConnection(): void {
  const dispatch = useGameDispatch();

  useEffect(() => {
    const onRoomState = (state: RoomStatePayload) => dispatch({ type: 'ROOM_STATE', state });
    const onRoleAssigned = (payload: RoleAssignedPayload) =>
      dispatch({ type: 'ROLE_ASSIGNED', payload });
    const onNightPrompt = (payload: NightPromptPayload) =>
      dispatch({ type: 'NIGHT_PROMPT', payload });
    const onSeerResult = (payload: SeerResultPayload) => dispatch({ type: 'SEER_RESULT', payload });
    const onDayReveal = (payload: DayRevealPayload) => dispatch({ type: 'DAY_REVEAL', payload });
    const onVoteTally = (payload: VoteTallyPayload) =>
      dispatch({ type: 'VOTE_TALLY', tally: payload.tally });
    const onVoteResult = (_payload: VoteResultPayload) =>
      dispatch({ type: 'VOTE_RESULT_CLEAR_TALLY' });
    const onHunterPrompt = (payload: HunterPromptPayload) =>
      dispatch({ type: 'HUNTER_PROMPT', payload });
    const onGameOver = (payload: GameOverPayload) => dispatch({ type: 'GAME_OVER', payload });
    const onChatMessage = (payload: ChatMessagePayload) =>
      dispatch({ type: 'CHAT_MESSAGE', payload });
    const onRoomError = (payload: RoomErrorPayload) =>
      dispatch({ type: 'ERROR', message: payload.message });

    socket.on(ServerEvents.ROOM_STATE, onRoomState);
    socket.on(ServerEvents.ROLE_ASSIGNED, onRoleAssigned);
    socket.on(ServerEvents.NIGHT_PROMPT, onNightPrompt);
    socket.on(ServerEvents.SEER_RESULT, onSeerResult);
    socket.on(ServerEvents.DAY_REVEAL, onDayReveal);
    socket.on(ServerEvents.VOTE_TALLY, onVoteTally);
    socket.on(ServerEvents.VOTE_RESULT, onVoteResult);
    socket.on(ServerEvents.HUNTER_PROMPT, onHunterPrompt);
    socket.on(ServerEvents.GAME_OVER, onGameOver);
    socket.on(ServerEvents.CHAT_MESSAGE, onChatMessage);
    socket.on(ServerEvents.ROOM_ERROR, onRoomError);

    return () => {
      socket.off(ServerEvents.ROOM_STATE, onRoomState);
      socket.off(ServerEvents.ROLE_ASSIGNED, onRoleAssigned);
      socket.off(ServerEvents.NIGHT_PROMPT, onNightPrompt);
      socket.off(ServerEvents.SEER_RESULT, onSeerResult);
      socket.off(ServerEvents.DAY_REVEAL, onDayReveal);
      socket.off(ServerEvents.VOTE_TALLY, onVoteTally);
      socket.off(ServerEvents.VOTE_RESULT, onVoteResult);
      socket.off(ServerEvents.HUNTER_PROMPT, onHunterPrompt);
      socket.off(ServerEvents.GAME_OVER, onGameOver);
      socket.off(ServerEvents.CHAT_MESSAGE, onChatMessage);
      socket.off(ServerEvents.ROOM_ERROR, onRoomError);
    };
  }, [dispatch]);
}
