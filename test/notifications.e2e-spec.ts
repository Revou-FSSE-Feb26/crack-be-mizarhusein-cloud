import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Role } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { createUserToken } from './helpers';

describe('Admin notification bell (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  let otherAdminToken: string;
  let customerToken: string;
  const stamp = Date.now();
  const adminEmail = `e2e-bell-admin-${stamp}@example.com`;
  const otherAdminEmail = `e2e-bell-admin2-${stamp}@example.com`;
  const customerEmail = `e2e-bell-customer-${stamp}@example.com`;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const feed = (token: string) =>
    request(app.getHttpServer()).get('/admin/notifications').set(auth(token));

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function placeReservation() {
    await request(app.getHttpServer())
      .post('/reservations')
      .set(auth(customerToken))
      .send({
        customerName: 'E2E Bell Guest',
        email: customerEmail,
        phone: '+62 812 0000 0000',
        partySize: 3,
        date: '2026-12-31T18:00:00.000Z',
      })
      .expect(201);
  }

  async function placeOrder() {
    const menu = await prisma.menu.findFirst();
    await request(app.getHttpServer())
      .post('/orders')
      .send({
        customerName: 'E2E Bell Guest',
        tableNumber: 'Z9',
        items: [{ menuId: menu!.id, quantity: 2 }],
      })
      .expect(201);
  }

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

    adminToken = await createUserToken(app, prisma, adminEmail, Role.ADMIN);
    otherAdminToken = await createUserToken(app, prisma, otherAdminEmail, Role.ADMIN);
    customerToken = await createUserToken(app, prisma, customerEmail);
  });

  afterAll(async () => {
    await prisma.reservation.deleteMany({ where: { customerName: 'E2E Bell Guest' } });
    await prisma.order.deleteMany({ where: { customerName: 'E2E Bell Guest' } });
    await prisma.user.deleteMany({
      where: { email: { in: [adminEmail, otherAdminEmail, customerEmail] } },
    });
    await app.close();
  });

  it('is admin-only', async () => {
    await request(app.getHttpServer()).get('/admin/notifications').expect(401);
    await request(app.getHttpServer()).post('/admin/notifications/seen').expect(401);
    await feed(customerToken).expect(403);
    await request(app.getHttpServer())
      .post('/admin/notifications/seen')
      .set(auth(customerToken))
      .expect(403);
  });

  it('starts at zero: history that already exists counts as seen', async () => {
    const res = await feed(adminToken).expect(200);
    expect(res.body.unreadCount).toBe(0);
    expect(res.body.items.every((i: { isNew: boolean }) => i.isNew === false)).toBe(true);
    // both admins are initialised independently
    const other = await feed(otherAdminToken).expect(200);
    expect(other.body.unreadCount).toBe(0);
  });

  it('a new reservation and a new order become unread notifications', async () => {
    await wait(20);
    await placeReservation();
    await wait(20);
    await placeOrder();

    const res = await feed(adminToken).expect(200);
    expect(res.body.unreadCount).toBe(2);

    const fresh = res.body.items.filter((i: { isNew: boolean }) => i.isNew);
    expect(fresh).toHaveLength(2);
    // newest first, with the details the toast needs
    expect(fresh[0]).toMatchObject({ type: 'order', tableNumber: 'Z9', itemCount: 2 });
    expect(fresh[0].total).toEqual(expect.any(Number));
    expect(fresh[1]).toMatchObject({
      type: 'reservation',
      customerName: 'E2E Bell Guest',
      partySize: 3,
    });
  });

  it('opening the bell clears the badge, for that admin only', async () => {
    await request(app.getHttpServer())
      .post('/admin/notifications/seen')
      .set(auth(adminToken))
      .expect(200);

    const mine = await feed(adminToken).expect(200);
    expect(mine.body.unreadCount).toBe(0);
    expect(mine.body.items.every((i: { isNew: boolean }) => i.isNew === false)).toBe(true);

    // the other admin never opened their bell, so they still have both
    const other = await feed(otherAdminToken).expect(200);
    expect(other.body.unreadCount).toBe(2);
  });

  it('only things created after opening the bell are new again', async () => {
    await wait(20);
    await placeOrder();
    const res = await feed(adminToken).expect(200);
    expect(res.body.unreadCount).toBe(1);
    expect(res.body.items[0]).toMatchObject({ type: 'order', isNew: true });
  });

  it('marking seen twice is harmless and the state persists', async () => {
    await request(app.getHttpServer()).post('/admin/notifications/seen').set(auth(adminToken)).expect(200);
    await request(app.getHttpServer()).post('/admin/notifications/seen').set(auth(adminToken)).expect(200);
    const res = await feed(adminToken).expect(200);
    expect(res.body.unreadCount).toBe(0);
  });

  it('the feed is capped at 10 items', async () => {
    const res = await feed(adminToken).expect(200);
    expect(res.body.items.length).toBeLessThanOrEqual(10);
  });
});
