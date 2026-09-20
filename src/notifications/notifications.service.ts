import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const FEED_SIZE = 10;

// The admin bell. There is no notifications table: a "notification" is simply a
// reservation or order that was created after the moment this admin last opened
// the bell (users.notificationsSeenAt). Only createdAt values written by the
// database/ORM are compared with each other, so clock differences between
// servers can't make items appear or vanish.
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  // Timestamp of the newest reservation or order, or null when there are none.
  private async latestActivityAt(): Promise<Date | null> {
    const [reservation, order] = await Promise.all([
      this.prisma.reservation.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      this.prisma.order.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);
    const times = [reservation?.createdAt, order?.createdAt].filter(
      (d): d is Date => !!d,
    );
    return times.length ? new Date(Math.max(...times.map((d) => d.getTime()))) : null;
  }

  private async getSeenAt(adminId: number): Promise<Date> {
    const user = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: { notificationsSeenAt: true },
    });
    if (user?.notificationsSeenAt) {
      return user.notificationsSeenAt;
    }
    // First time this admin uses the bell: everything that already exists counts
    // as seen, so the badge doesn't start at the size of the whole history.
    const seenAt = (await this.latestActivityAt()) ?? new Date();
    await this.prisma.user.update({
      where: { id: adminId },
      data: { notificationsSeenAt: seenAt },
    });
    return seenAt;
  }

  async getFeed(adminId: number) {
    const seenAt = await this.getSeenAt(adminId);
    const isNew = { createdAt: { gt: seenAt } };

    const [newReservations, newOrders, reservations, orders] =
      await Promise.all([
        this.prisma.reservation.count({ where: isNew }),
        this.prisma.order.count({ where: isNew }),
        this.prisma.reservation.findMany({
          orderBy: { createdAt: 'desc' },
          take: FEED_SIZE,
        }),
        this.prisma.order.findMany({
          orderBy: { createdAt: 'desc' },
          take: FEED_SIZE,
          include: { items: true },
        }),
      ]);

    const items = [
      ...reservations.map((r) => ({
        type: 'reservation' as const,
        id: r.id,
        createdAt: r.createdAt,
        isNew: r.createdAt > seenAt,
        customerName: r.customerName,
        partySize: r.partySize,
        date: r.date,
      })),
      ...orders.map((o) => ({
        type: 'order' as const,
        id: o.id,
        createdAt: o.createdAt,
        isNew: o.createdAt > seenAt,
        customerName: o.customerName,
        tableNumber: o.tableNumber,
        total: o.total,
        itemCount: o.items.reduce((sum, i) => sum + i.quantity, 0),
      })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, FEED_SIZE);

    return {
      unreadCount: newReservations + newOrders,
      seenAt,
      items,
    };
  }

  // Called when the admin opens the bell: everything up to now is now "seen".
  async markSeen(adminId: number) {
    const current = await this.getSeenAt(adminId);
    const latest = await this.latestActivityAt();
    const next = latest && latest > current ? latest : current;
    if (next > current) {
      await this.prisma.user.update({
        where: { id: adminId },
        data: { notificationsSeenAt: next },
      });
    }
    return { seenAt: next };
  }
}
