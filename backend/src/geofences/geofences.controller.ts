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
import { GeofencesService } from './geofences.service';
import { CreateGeofenceDto } from './dto/create-geofence.dto';
import { UpdateGeofenceDto } from './dto/update-geofence.dto';
import { GeofenceResponseDto } from './dto/geofence-response.dto';

@ApiTags('geofences')
@ApiBearerAuth('user-jwt')
@UseGuards(JwtAuthGuard)
@Controller('geofences')
export class GeofencesController {
  constructor(private readonly geofencesService: GeofencesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a geofence owned by the current user' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateGeofenceDto,
  ): Promise<GeofenceResponseDto> {
    const geofence = await this.geofencesService.create(user.id, dto);
    return new GeofenceResponseDto(geofence);
  }

  @Get()
  @ApiOperation({ summary: "List the current user's geofences" })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GeofenceResponseDto[]> {
    const geofences = await this.geofencesService.findAllForUser(user.id);
    return geofences.map((geofence) => new GeofenceResponseDto(geofence));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a geofence' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateGeofenceDto,
  ): Promise<GeofenceResponseDto> {
    const geofence = await this.geofencesService.update(user.id, id, dto);
    return new GeofenceResponseDto(geofence);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a geofence' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.geofencesService.remove(user.id, id);
  }
}
