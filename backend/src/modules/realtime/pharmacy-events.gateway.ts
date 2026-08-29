import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/realtime',
})
export class PharmacyEventsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(PharmacyEventsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const authHeader = client.handshake.headers.authorization;
      const token =
        client.handshake.auth?.token ||
        (authHeader ? authHeader.replace('Bearer ', '') : null) ||
        client.handshake.query?.token;

      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token, disconnecting.`);
        client.disconnect();
        return;
      }

      const decoded: any = this.jwtService.verify(token as string);
      if (!decoded || !decoded.tenantId) {
        client.disconnect();
        return;
      }

      const roomName = `tenant_${decoded.tenantId}`;
      client.join(roomName);
      (client as any).tenantId = decoded.tenantId;
      (client as any).userId = decoded.sub;

      this.logger.log(`Client ${client.id} joined room ${roomName}`);
    } catch (err: any) {
      this.logger.warn(`Auth failed for socket ${client.id}: ${err.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Broadcast inventory updates to all cashiers in the same pharmacy
   */
  @OnEvent('inventory.synced')
  handleInventorySynced(payload: { tenantId: string; schemaName: string; medicineIds?: string[] }) {
    if (!payload.tenantId || !this.server) return;
    const roomName = `tenant_${payload.tenantId}`;
    this.server.to(roomName).emit('STOCK_UPDATED', {
      timestamp: new Date().toISOString(),
      medicineIds: payload.medicineIds || [],
    });
  }

  /**
   * Broadcast sale completed event
   */
  @OnEvent('sale.completed')
  handleSaleCompleted(payload: { tenantId: string; schemaName: string; sale: any }) {
    if (!payload.tenantId || !this.server) return;
    const roomName = `tenant_${payload.tenantId}`;
    this.server.to(roomName).emit('SALE_COMPLETED', {
      timestamp: new Date().toISOString(),
      sale: payload.sale,
    });
  }

  /**
   * Broadcast bulk stock entry event
   */
  @OnEvent('stock.entered')
  handleStockEntered(payload: { tenantId: string; schemaName: string; count: number }) {
    if (!payload.tenantId || !this.server) return;
    const roomName = `tenant_${payload.tenantId}`;
    this.server.to(roomName).emit('STOCK_ENTERED', {
      timestamp: new Date().toISOString(),
      count: payload.count,
    });
  }
}
