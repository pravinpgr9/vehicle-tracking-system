import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  type AuthenticatedUser,
  CurrentUser,
} from '../auth/decorators/current-user.decorator';
import { AlertsService } from './alerts.service';
import { AlertQueryDto } from './dto/alert-query.dto';
import { AlertResponseDto } from './dto/alert-response.dto';
import { PaginatedResponse } from '../common/types/paginated-response.type';

@ApiTags('alerts')
@ApiBearerAuth('user-jwt')
@UseGuards(JwtAuthGuard)
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  @ApiOperation({ summary: "List the current user's alerts (paginated)" })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AlertQueryDto,
  ): Promise<PaginatedResponse<AlertResponseDto>> {
    const { items, nextCursor } = await this.alertsService.findAllForUser(
      user.id,
      query,
    );
    return {
      items: items.map((alert) => new AlertResponseDto(alert)),
      nextCursor,
    };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark an alert as read' })
  async markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<AlertResponseDto> {
    const alert = await this.alertsService.markRead(user.id, id);
    return new AlertResponseDto(alert);
  }
}
