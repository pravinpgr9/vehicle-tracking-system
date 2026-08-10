import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import { ErrorCode } from '../common/constants/error-codes';
import { CreateGeofenceDto } from './dto/create-geofence.dto';
import { UpdateGeofenceDto } from './dto/update-geofence.dto';
import { Geofence } from '../generated/prisma/client';

@Injectable()
export class GeofencesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateGeofenceDto): Promise<Geofence> {
    return this.prisma.geofence.create({ data: { ...dto, userId } });
  }

  async findAllForUser(userId: string): Promise<Geofence[]> {
    return this.prisma.geofence.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneOwned(userId: string, geofenceId: string): Promise<Geofence> {
    const geofence = await this.prisma.geofence.findUnique({
      where: { id: geofenceId },
    });
    if (!geofence || geofence.userId !== userId) {
      throw new AppException(
        ErrorCode.GEOFENCE_NOT_FOUND,
        'Geofence not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return geofence;
  }

  async update(
    userId: string,
    geofenceId: string,
    dto: UpdateGeofenceDto,
  ): Promise<Geofence> {
    await this.findOneOwned(userId, geofenceId);
    return this.prisma.geofence.update({
      where: { id: geofenceId },
      data: dto,
    });
  }

  async remove(userId: string, geofenceId: string): Promise<void> {
    await this.findOneOwned(userId, geofenceId);
    await this.prisma.geofence.delete({ where: { id: geofenceId } });
  }
}
