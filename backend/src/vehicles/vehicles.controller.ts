import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { VehicleResponseDto } from './dto/vehicle-response.dto';

@ApiTags('vehicles')
@ApiBearerAuth('user-jwt')
@UseGuards(JwtAuthGuard)
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a vehicle owned by the current user' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateVehicleDto,
  ): Promise<VehicleResponseDto> {
    const vehicle = await this.vehiclesService.create(user.id, dto);
    return new VehicleResponseDto(vehicle);
  }

  @Get()
  @ApiOperation({ summary: "List the current user's vehicles" })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<VehicleResponseDto[]> {
    const vehicles = await this.vehiclesService.findAllForUser(user.id);
    return vehicles.map((vehicle) => new VehicleResponseDto(vehicle));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a vehicle by id' })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<VehicleResponseDto> {
    const vehicle = await this.vehiclesService.findOneOwned(user.id, id);
    return new VehicleResponseDto(vehicle);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a vehicle' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateVehicleDto,
  ): Promise<VehicleResponseDto> {
    const vehicle = await this.vehiclesService.update(user.id, id, dto);
    return new VehicleResponseDto(vehicle);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a vehicle' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.vehiclesService.remove(user.id, id);
  }
}
