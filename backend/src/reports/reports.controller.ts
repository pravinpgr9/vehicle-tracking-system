import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  type AuthenticatedUser,
  CurrentUser,
} from '../auth/decorators/current-user.decorator';
import { ReportsService } from './reports.service';
import { DailyReportQueryDto } from './dto/daily-report-query.dto';
import { MonthlyReportQueryDto } from './dto/monthly-report-query.dto';
import { DailyReportResponseDto } from './dto/daily-report-response.dto';
import { MonthlyReportResponseDto } from './dto/monthly-report-response.dto';

@ApiTags('reports')
@ApiBearerAuth('user-jwt')
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('daily')
  @ApiOperation({ summary: "Get a vehicle's daily driving report" })
  async getDaily(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DailyReportQueryDto,
  ): Promise<DailyReportResponseDto> {
    return this.reportsService.getDaily(user.id, query);
  }

  @Get('monthly')
  @ApiOperation({ summary: "Get a vehicle's monthly driving report" })
  async getMonthly(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: MonthlyReportQueryDto,
  ): Promise<MonthlyReportResponseDto> {
    return this.reportsService.getMonthly(user.id, query);
  }
}
