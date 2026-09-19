import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';

const TAX_RATE = 0.1;

const FINISHED: OrderStatus[] = [OrderStatus.COMPLETED, OrderStatus.CANCELLED];

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOrderDto) {
    // Merge duplicate menu ids into one lookup, but keep every line as ordered.
    const menuIds = [...new Set(dto.items.map((i) => i.menuId))];
    const menus = await this.prisma.menu.findMany({
      where: { id: { in: menuIds } },
    });
    const byId = new Map(menus.map((m) => [m.id, m]));

    const missing = menuIds.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Unknown menu item id(s): ${missing.join(', ')}`,
      );
    }

    const lines = dto.items.map((item) => {
      const menu = byId.get(item.menuId)!;
      return {
        menuId: menu.id,
        name: menu.name,
        price: menu.price,
        quantity: item.quantity,
        notes: item.notes?.trim() || null,
      };
    });

    const subtotal = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
    const tax = Math.round(subtotal * TAX_RATE);

    return this.prisma.order.create({
      data: {
        customerName: dto.customerName?.trim() || null,
        tableNumber: dto.tableNumber?.trim() || null,
        notes: dto.notes?.trim() || null,
        subtotal,
        tax,
        total: subtotal + tax,
        items: { create: lines },
      },
      include: { items: true },
    });
  }

  findAll(status?: OrderStatus) {
    return this.prisma.order.findMany({
      where: status ? { status } : undefined,
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) {
      throw new NotFoundException(`Order with id ${id} not found`);
    }
    return order;
  }

  // Finished orders (completed/cancelled) are history and can't be reopened.
  async updateStatus(id: number, status: OrderStatus) {
    const order = await this.findOne(id);
    if (FINISHED.includes(order.status)) {
      throw new BadRequestException(
        `A ${order.status.toLowerCase()} order can no longer be changed`,
      );
    }
    return this.prisma.order.update({
      where: { id },
      data: { status },
      include: { items: true },
    });
  }
}
