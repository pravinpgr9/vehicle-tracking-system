import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

interface HealthStatus {
  status: 'ok' | 'error';
  database: 'connected' | 'disconnected';
  timestamp: string;
}

@ApiTags('health')
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Liveness and database connectivity check' })
  async check(): Promise<HealthStatus> {
    const database = await this.checkDatabase();
    return {
      status: database === 'connected' ? 'ok' : 'error',
      database,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<'connected' | 'disconnected'> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'connected';
    } catch {
      return 'disconnected';
    }
  }
}
