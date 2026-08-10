import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  type AuthenticatedUser,
  CurrentUser,
} from '../auth/decorators/current-user.decorator';
import { DevicesService } from './devices.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import {
  DeviceCreatedResponseDto,
  DeviceResponseDto,
} from './dto/device-response.dto';

@ApiTags('devices')
@ApiBearerAuth('user-jwt')
@UseGuards(JwtAuthGuard)
@Controller('vehicles/:vehicleId/devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post()
  @ApiOperation({
    summary: 'Register a GPS-capable device for a vehicle',
    description:
      'Returns a one-time plaintext device token. Store it on the device ' +
      '(e.g. the Android app) — it cannot be retrieved again.',
  })
  async register(
    @CurrentUser() user: AuthenticatedUser,
    @Param('vehicleId') vehicleId: string,
    @Body() dto: CreateDeviceDto,
  ): Promise<DeviceCreatedResponseDto> {
    const { device, token } = await this.devicesService.register(
      user.id,
      vehicleId,
      dto,
    );
    return new DeviceCreatedResponseDto(device, token);
  }

  @Get()
  @ApiOperation({ summary: "List a vehicle's registered devices" })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Param('vehicleId') vehicleId: string,
  ): Promise<DeviceResponseDto[]> {
    const devices = await this.devicesService.findAllForVehicle(
      user.id,
      vehicleId,
    );
    return devices.map((device) => new DeviceResponseDto(device));
  }

  @Get(':deviceId')
  @ApiOperation({ summary: 'Get a device by id' })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('vehicleId') vehicleId: string,
    @Param('deviceId') deviceId: string,
  ): Promise<DeviceResponseDto> {
    const device = await this.devicesService.findOneOwned(
      user.id,
      vehicleId,
      deviceId,
    );
    return new DeviceResponseDto(device);
  }

  @Patch(':deviceId')
  @ApiOperation({
    summary: 'Activate/deactivate a device or update its platform',
  })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('vehicleId') vehicleId: string,
    @Param('deviceId') deviceId: string,
    @Body() dto: UpdateDeviceDto,
  ): Promise<DeviceResponseDto> {
    const device = await this.devicesService.update(
      user.id,
      vehicleId,
      deviceId,
      dto,
    );
    return new DeviceResponseDto(device);
  }
}
