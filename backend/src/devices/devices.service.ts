import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import { AppException } from '../common/exceptions/app.exception';
import { ErrorCode } from '../common/constants/error-codes';
import { generateToken, hashToken } from '../common/utils/token.util';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { Device } from '../generated/prisma/client';

@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vehiclesService: VehiclesService,
  ) {}

  async register(
    userId: string,
    vehicleId: string,
    dto: CreateDeviceDto,
  ): Promise<{ device: Device; token: string }> {
    await this.vehiclesService.findOneOwned(userId, vehicleId);

    const existing = await this.prisma.device.findUnique({
      where: { deviceIdentifier: dto.deviceIdentifier },
    });
    if (existing) {
      throw new AppException(
        ErrorCode.DEVICE_IDENTIFIER_ALREADY_REGISTERED,
        'A device with this identifier is already registered',
        HttpStatus.CONFLICT,
      );
    }

    const token = generateToken();
    const device = await this.prisma.device.create({
      data: {
        vehicleId,
        deviceType: dto.deviceType,
        deviceIdentifier: dto.deviceIdentifier,
        platform: dto.platform,
        deviceTokenHash: hashToken(token),
      },
    });

    return { device, token };
  }

  async findAllForVehicle(
    userId: string,
    vehicleId: string,
  ): Promise<Device[]> {
    await this.vehiclesService.findOneOwned(userId, vehicleId);
    return this.prisma.device.findMany({
      where: { vehicleId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneOwned(
    userId: string,
    vehicleId: string,
    deviceId: string,
  ): Promise<Device> {
    await this.vehiclesService.findOneOwned(userId, vehicleId);
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
    });
    if (!device || device.vehicleId !== vehicleId) {
      throw new AppException(
        ErrorCode.DEVICE_NOT_FOUND,
        'Device not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return device;
  }

  async update(
    userId: string,
    vehicleId: string,
    deviceId: string,
    dto: UpdateDeviceDto,
  ): Promise<Device> {
    await this.findOneOwned(userId, vehicleId, deviceId);
    return this.prisma.device.update({ where: { id: deviceId }, data: dto });
  }
}
