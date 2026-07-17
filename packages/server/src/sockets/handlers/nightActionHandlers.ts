import { Server, Socket } from 'socket.io';
import {
  ClientEvents,
  NightActionCupidPayload,
  NightActionGuardPayload,
  NightActionSeerPayload,
  NightActionWerewolfPayload,
  NightActionWitchPayload,
} from '@werewolf/shared';
import { RoomManager } from '../../rooms/RoomManager';
import { GameSession } from '../../game/GameSession';
import { GameLogicError } from '../../game/GameLogicError';
import { GameSessionRegistry } from '../GameSessionRegistry';
import { SocketAuthRegistry } from '../SocketAuth';
import { sendError } from '../broadcast';

export function registerNightActionHandlers(
  io: Server,
  socket: Socket,
  roomManager: RoomManager,
  sessionRegistry: GameSessionRegistry,
  auth: SocketAuthRegistry,
): void {
  function getActiveSession(): { session: GameSession; playerId: string } | null {
    const authData = auth.get(socket.id);
    if (!authData) {
      sendError(socket, new GameLogicError('Bạn chưa tham gia phòng nào.', 'NOT_IN_ROOM'));
      return null;
    }
    const session = sessionRegistry.get(authData.roomId);
    if (!session) {
      sendError(socket, new GameLogicError('Ván đấu chưa bắt đầu.', 'NO_ACTIVE_GAME'));
      return null;
    }
    return { session, playerId: authData.playerId };
  }

  socket.on(ClientEvents.NIGHT_ACTION_WEREWOLF, (payload: NightActionWerewolfPayload) => {
    const ctx = getActiveSession();
    if (!ctx) return;
    try {
      ctx.session.handleWerewolfTarget(ctx.playerId, payload.targetId);
    } catch (err) {
      sendError(socket, err);
    }
  });

  socket.on(ClientEvents.NIGHT_ACTION_GUARD, (payload: NightActionGuardPayload) => {
    const ctx = getActiveSession();
    if (!ctx) return;
    try {
      ctx.session.handleGuardTarget(ctx.playerId, payload.targetId);
    } catch (err) {
      sendError(socket, err);
    }
  });

  socket.on(ClientEvents.NIGHT_ACTION_SEER, (payload: NightActionSeerPayload) => {
    const ctx = getActiveSession();
    if (!ctx) return;
    try {
      ctx.session.handleSeerTarget(ctx.playerId, payload.targetId);
    } catch (err) {
      sendError(socket, err);
    }
  });

  socket.on(ClientEvents.NIGHT_ACTION_WITCH, (payload: NightActionWitchPayload) => {
    const ctx = getActiveSession();
    if (!ctx) return;
    try {
      ctx.session.handleWitchAction(ctx.playerId, payload.action, payload.targetId);
    } catch (err) {
      sendError(socket, err);
    }
  });

  socket.on(ClientEvents.NIGHT_ACTION_CUPID, (payload: NightActionCupidPayload) => {
    const ctx = getActiveSession();
    if (!ctx) return;
    try {
      ctx.session.handleCupidTargets(ctx.playerId, payload.targetId1, payload.targetId2);
    } catch (err) {
      sendError(socket, err);
    }
  });
}
