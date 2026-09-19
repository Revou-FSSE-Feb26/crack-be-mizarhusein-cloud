import { Injectable } from '@nestjs/common';
import { OrderStatus, ReservationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// "Today" means today at the venue, not in UTC. Defaults to WITA (UTC+8, Bali);
// set APP_UTC_OFFSET_HOURS to change it (e.g. 7 for WIB).
function todayRange(now: Date) {
  const offset = Number(process.env.APP_UTC_OFFSET_HOURS ?? 8) * HOUR_MS;
  const start = Math.floor((now.getTime() + offset) / DAY_MS) * DAY_MS - offset;
  return { start: new Date(start), end: new Date(start + DAY_MS) };
}

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard() {
    const now = new Date();
    const { start, end } = todayRange(now);
    const inNextWeek = new Date(now.getTime() + 7 * DAY_MS);

    const notCancelledRes = { status: { not: ReservationStatus.CANCELLED } };
    const upcomingStatuses = [
      ReservationStatus.PENDING,
      ReservationStatus.CONFIRMED,
    ];
    const notCancelledOrder = { status: { not: OrderStatus.CANCELLED } };

    const [
      todayReservations,
      todayGuests,
      upcomingReservations,
      pendingReservations,
      totalMenuItems,
      ordersToday,
      revenueToday,
      activeOrders,
      recentReservations,
      recentOrders,
    ] = await Promise.all([
      this.prisma.reservation.count({
        where: { date: { gte: start, lt: end }, ...notCancelledRes },
      }),
      this.prisma.reservation.aggregate({
        _sum: { partySize: true },
        where: { date: { gte: start, lt: end }, ...notCancelledRes },
      }),
      this.prisma.reservation.count({
        where: {
          date: { gte: now, lt: inNextWeek },
          status: { in: upcomingStatuses },
        },
      }),
      this.prisma.reservation.count({
        where: { status: ReservationStatus.PENDING },
      }),
      this.prisma.menu.count(),
      this.prisma.order.count({
        where: { createdAt: { gte: start, lt: end }, ...notCancelledOrder },
      }),
      this.prisma.order.aggregate({
        _sum: { total: true },
        where: { createdAt: { gte: start, lt: end }, ...notCancelledOrder },
      }),
      this.prisma.order.count({
        where: {
          status: { in: [OrderStatus.PENDING, OrderStatus.PREPARING] },
        },
      }),
      this.prisma.reservation.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { items: true },
      }),
    ]);

    return {
      generatedAt: now.toISOString(),
      todayReservations,
      todayGuests: todayGuests._sum.partySize ?? 0,
      upcomingReservations,
      pendingReservations,
      totalMenuItems,
      ordersToday,
      revenueToday: revenueToday._sum.total ?? 0,
      activeOrders,
      recentReservations,
      recentOrders,
    };
  }
}
