import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';
import { hashToken } from '../../common/utils/token.util';
import { Device, Vehicle } from '../../generated/prisma/client';

export interface AuthenticatedDevice extends Device {
  vehicle: Vehicle;
}

/**
 * Authenticates a GPS-ingestion request via `Authorization: Device <token>`.
 * Deliberately separate from JwtAuthGuard: a device token is a long-lived,
 * per-device secret, never the interactive user's JWT (see ARCHITECTURE.md).
 */
@Injectable()
export class DeviceAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    const device = await this.prisma.device.findUnique({
      where: { deviceTokenHash: hashToken(token) },
      include: { vehicle: true },
    });

    if (!device) {
      throw new AppException(
        ErrorCode.INVALID_DEVICE_TOKEN,
        'Invalid device token',
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (!device.isActive || device.vehicle.status !== 'ACTIVE') {
      throw new AppException(
        ErrorCode.DEVICE_INACTIVE,
        'Device or vehicle is inactive',
        HttpStatus.FORBIDDEN,
      );
    }

    (request as Request & { device: AuthenticatedDevice }).device = device;
    return true;
  }

  private extractToken(request: Request): string {
    const header = request.headers.authorization;
    if (!header?.startsWith('Device ')) {
      throw new AppException(
        ErrorCode.INVALID_DEVICE_TOKEN,
        'Missing or malformed device Authorization header',
        HttpStatus.UNAUTHORIZED,
      );
    }
    return header.slice('Device '.length).trim();
  }
}
