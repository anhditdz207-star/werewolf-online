import { Server, Socket } from 'socket.io';
import { ClientEvents, HunterShootPayload, VoteCastPayload } from '@werewolf/shared';
import { RoomManager } from '../../rooms/RoomManager';
import { GameLogicError } from '../../game/GameLogicError';
import { GameSessionRegistry } from '../GameSessionRegistry';
import { SocketAuthRegistry } from '../SocketAuth';
import { sendError } from '../broadcast';

export function registerVotingHandlers(
  io: Server,
  socket: Socket,
  roomManager: RoomManager,
  sessionRegistry: GameSessionRegistry,
  auth: SocketAuthRegistry,
): void {
  socket.on(ClientEvents.VOTE_CAST, (payload: VoteCastPayload) => {
    const authData = auth.get(socket.id);
    if (!authData) {
      sendError(socket, new GameLogicError('Bạn chưa tham gia phòng nào.', 'NOT_IN_ROOM'));
      return;
    }
    const session = sessionRegistry.get(authData.roomId);
    if (!session) {
      sendError(socket, new GameLogicError('Ván đấu chưa bắt đầu.', 'NO_ACTIVE_GAME'));
      return;
    }
    try {
      session.handleVoteCast(authData.playerId, payload.targetId);
    } catch (err) {
      sendError(socket, err);
    }
  });

  socket.on(ClientEvents.HUNTER_SHOOT, (payload: HunterShootPayload) => {
    const authData = auth.get(socket.id);
    if (!authData) {
      sendError(socket, new GameLogicError('Bạn chưa tham gia phòng nào.', 'NOT_IN_ROOM'));
      return;
    }
    const session = sessionRegistry.get(authData.roomId);
    if (!session) {
      sendError(socket, new GameLogicError('Ván đấu chưa bắt đầu.', 'NO_ACTIVE_GAME'));
      return;
    }
    try {
      session.handleHunterShot(authData.playerId, payload.targetId);
    } catch (err) {
      sendError(socket, err);
    }
  });
}
