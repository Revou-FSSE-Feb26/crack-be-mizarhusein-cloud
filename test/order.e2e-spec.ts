import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Role } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { createUserToken } from './helpers';

describe('Orders & dashboard stats (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  let customerToken: string;
  let orderId: number;
  let menuA: { id: number; price: number; name: string };
  let menuB: { id: number; price: number };
  const stamp = Date.now();
  const adminEmail = `e2e-order-admin-${stamp}@example.com`;
  const customerEmail = `e2e-order-customer-${stamp}@example.com`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.init();
    prisma = moduleFixture.get(PrismaService);

    const menus = await prisma.menu.findMany({ take: 2, orderBy: { id: 'asc' } });
    menuA = menus[0];
    menuB = menus[1];

    adminToken = await createUserToken(app, prisma, adminEmail, Role.ADMIN);
    customerToken = await createUserToken(app, prisma, customerEmail);
  });

  afterAll(async () => {
    if (orderId) await prisma.order.deleteMany({ where: { id: orderId } });
    await prisma.order.deleteMany({ where: { customerName: 'E2E Guest' } });
    await prisma.user.deleteMany({
      where: { email: { in: [adminEmail, customerEmail] } },
    });
    await app.close();
  });

  it('POST /orders is public and prices the order on the server', async () => {
    const res = await request(app.getHttpServer())
      .post('/orders')
      .send({
        customerName: 'E2E Guest',
        tableNumber: 'A12',
        items: [
          { menuId: menuA.id, quantity: 2, notes: 'no ice' },
          { menuId: menuB.id, quantity: 1 },
        ],
      })
      .expect(201);

    const subtotal = menuA.price * 2 + menuB.price;
    expect(res.body.status).toBe('PENDING');
    expect(res.body.subtotal).toBe(subtotal);
    expect(res.body.tax).toBe(Math.round(subtotal * 0.1));
    expect(res.body.total).toBe(subtotal + Math.round(subtotal * 0.1));
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0]).toMatchObject({ name: menuA.name, price: menuA.price });
    orderId = res.body.id;
  });

  it('POST /orders rejects client-supplied prices', () => {
    return request(app.getHttpServer())
      .post('/orders')
      .send({ items: [{ menuId: menuA.id, quantity: 1, price: 1 }] })
      .expect(400);
  });

  it('POST /orders rejects unknown menu items, empty carts and bad quantities', async () => {
    const server = app.getHttpServer();
    await request(server).post('/orders').send({ items: [{ menuId: 99999999, quantity: 1 }] }).expect(400);
    await request(server).post('/orders').send({ items: [] }).expect(400);
    await request(server).post('/orders').send({ items: [{ menuId: menuA.id, quantity: 0 }] }).expect(400);
    await request(server).post('/orders').send({ items: [{ menuId: menuA.id, quantity: 51 }] }).expect(400);
  });

  it('GET /orders requires an admin', async () => {
    await request(app.getHttpServer()).get('/orders').expect(401);
    await request(app.getHttpServer())
      .get('/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);
  });

  it('GET /orders lists the order for an admin (with items)', async () => {
    const res = await request(app.getHttpServer())
      .get('/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const found = res.body.find((o: { id: number }) => o.id === orderId);
    expect(found.items).toHaveLength(2);
  });

  it('GET /orders?status= filters by status', async () => {
    const res = await request(app.getHttpServer())
      .get('/orders?status=SERVED')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.some((o: { id: number }) => o.id === orderId)).toBe(false);
  });

  it('PATCH /orders/:id/status is forbidden for a customer', () => {
    return request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ status: 'PREPARING' })
      .expect(403);
  });

  it('PATCH /orders/:id/status moves the order forward for an admin', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'PREPARING' })
      .expect(200);
    expect(res.body.status).toBe('PREPARING');

    await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'NOT_A_STATUS' })
      .expect(400);
  });

  it('a completed order can no longer be changed', async () => {
    await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'COMPLETED' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'PENDING' })
      .expect(400);
  });

  it('order lines keep their name/price snapshot when the menu item is deleted', async () => {
    const temp = await prisma.menu.create({
      data: { name: 'E2E Temp Dish', description: '', price: 12345, image: '', category: 'pizza' },
    });
    const created = await request(app.getHttpServer())
      .post('/orders')
      .send({ customerName: 'E2E Guest', items: [{ menuId: temp.id, quantity: 1 }] })
      .expect(201);
    await prisma.menu.delete({ where: { id: temp.id } });

    const res = await request(app.getHttpServer())
      .get(`/orders/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.items[0]).toMatchObject({ name: 'E2E Temp Dish', price: 12345, menuId: null });
  });

  it('GET /admin/stats is admin-only', async () => {
    await request(app.getHttpServer()).get('/admin/stats').expect(401);
    await request(app.getHttpServer())
      .get('/admin/stats')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);
  });

  it('GET /admin/stats returns real numbers from the database', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const menuCount = await prisma.menu.count();
    expect(res.body.totalMenuItems).toBe(menuCount);
    for (const key of [
      'todayReservations',
      'todayGuests',
      'upcomingReservations',
      'pendingReservations',
      'ordersToday',
      'revenueToday',
      'activeOrders',
    ]) {
      expect(res.body[key]).toEqual(expect.any(Number));
    }
    expect(Array.isArray(res.body.recentReservations)).toBe(true);
    expect(res.body.recentOrders.length).toBeLessThanOrEqual(5);
    // the order created above is COMPLETED, still counts towards today's revenue
    expect(res.body.ordersToday).toBeGreaterThanOrEqual(1);
    expect(res.body.revenueToday).toBeGreaterThan(0);
  });
});
