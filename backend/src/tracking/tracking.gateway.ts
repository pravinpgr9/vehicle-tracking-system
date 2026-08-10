import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { VehiclesService } from '../vehicles/vehicles.service';
import { AppEvent } from '../common/constants/events';
import { LocationIngestedEvent } from '../common/events/location-ingested.event';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

interface AuthenticatedSocket extends Socket {
  data: { user?: AuthenticatedUser };
}

function vehicleRoom(vehicleId: string): string {
  return `vehicle:${vehicleId}`;
}

// Evaluated once at module load, same as main.ts's CORS setup: the
// gateway decorator's options object can't receive injected ConfigService.
const corsOrigin = process.env.CORS_ORIGIN ?? '*';

@WebSocketGateway({ cors: { origin: corsOrigin } })
export class TrackingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private readonly server!: Server;

  private readonly logger = new Logger(TrackingGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly vehiclesService: VehiclesService,
  ) {}

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    const token = this.extractToken(client);
    if (!token) {
      this.rejectConnection(client, 'Missing authentication token');
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      client.data.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };
    } catch {
      this.rejectConnection(client, 'Invalid or expired token');
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('vehicle:join')
  async handleJoin(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { vehicleId: string },
  ): Promise<void> {
    const userId = this.requireUserId(client);
    try {
      await this.vehiclesService.findOneOwned(userId, body.vehicleId);
    } catch {
      client.emit('error', { message: 'Vehicle not found' });
      return;
    }
    await client.join(vehicleRoom(body.vehicleId));
  }

  @SubscribeMessage('vehicle:leave')
  async handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { vehicleId: string },
  ): Promise<void> {
    await client.leave(vehicleRoom(body.vehicleId));
  }

  @OnEvent(AppEvent.LOCATION_INGESTED)
  handleLocationIngested(event: LocationIngestedEvent): void {
    const { location } = event;
    this.server.to(vehicleRoom(location.vehicleId)).emit('location:update', {
      vehicleId: location.vehicleId,
      latitude: location.latitude,
      longitude: location.longitude,
      speed: location.speed,
      heading: location.heading,
      recordedAt: location.recordedAt,
    });
  }

  private requireUserId(client: AuthenticatedSocket): string {
    const user = client.data.user;
    if (!user) {
      client.emit('error', { message: 'Not authenticated' });
      client.disconnect(true);
      throw new Error('Socket not authenticated');
    }
    return user.id;
  }

  private extractToken(client: Socket): string | undefined {
    const authToken = client.handshake.auth?.token as string | undefined;
    if (authToken) {
      return authToken;
    }
    const header = client.handshake.headers.authorization;
    return header?.startsWith('Bearer ')
      ? header.slice('Bearer '.length)
      : undefined;
  }

  private rejectConnection(client: Socket, message: string): void {
    client.emit('error', { message });
    client.disconnect(true);
  }
}
