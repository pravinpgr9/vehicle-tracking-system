import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import { ErrorCode } from '../common/constants/error-codes';
import { PaginatedResponse } from '../common/types/paginated-response.type';
import { AlertQueryDto } from './dto/alert-query.dto';
import { Alert } from '../generated/prisma/client';

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForUser(
    userId: string,
    query: AlertQueryDto,
  ): Promise<PaginatedResponse<Alert>> {
    const alerts = await this.prisma.alert.findMany({
      where: {
        vehicle: { userId },
        ...(query.unreadOnly && { readAt: null }),
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    });

    const hasMore = alerts.length > query.limit;
    const items = hasMore ? alerts.slice(0, query.limit) : alerts;
    const last = items.at(-1);

    return { items, nextCursor: hasMore && last ? last.id : null };
  }

  async markRead(userId: string, alertId: string): Promise<Alert> {
    const alert = await this.prisma.alert.findUnique({
      where: { id: alertId },
      include: { vehicle: true },
    });
    if (!alert || alert.vehicle.userId !== userId) {
      throw new AppException(
        ErrorCode.ALERT_NOT_FOUND,
        'Alert not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return this.prisma.alert.update({
      where: { id: alertId },
      data: { readAt: new Date() },
    });
  }
}
