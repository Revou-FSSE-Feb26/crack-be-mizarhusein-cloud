import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Role } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { createUserToken } from './helpers';

describe('Users & order ownership (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  let customerToken: string;
  let victimToken: string;
  let adminId: number;
  let customerId: number;
  let victimId: number;
  const stamp = Date.now();
  const adminEmail = `e2e-users-admin-${stamp}@example.com`;
  const customerEmail = `e2e-users-customer-${stamp}@example.com`;
  const victimEmail = `e2e-users-victim-${stamp}@example.com`;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

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
    customerToken = await createUserToken(app, prisma, customerEmail);
    victimToken = await createUserToken(app, prisma, victimEmail);

    const rows = await prisma.user.findMany({
      where: { email: { in: [adminEmail, customerEmail, victimEmail] } },
    });
    const idOf = (email: string) => rows.find((r) => r.email === email)!.id;
    adminId = idOf(adminEmail);
    customerId = idOf(customerEmail);
    victimId = idOf(victimEmail);
  });

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { customerName: 'E2E Owner' } });
    await prisma.user.deleteMany({
      where: { email: { in: [adminEmail, customerEmail, victimEmail] } },
    });
    await app.close();
  });

  it('GET /users/me returns the caller without the password hash', async () => {
    const res = await request(app.getHttpServer())
      .get('/users/me')
      .set(auth(customerToken))
      .expect(200);
    expect(res.body).toMatchObject({ id: customerId, email: customerEmail, role: 'CUSTOMER' });
    expect(res.body.password).toBeUndefined();
    await request(app.getHttpServer()).get('/users/me').expect(401);
  });

  it('PATCH /users/me updates the name and returns a fresh token', async () => {
    const res = await request(app.getHttpServer())
      .patch('/users/me')
      .set(auth(customerToken))
      .send({ name: 'Renamed Customer' })
      .expect(200);
    expect(res.body.user.name).toBe('Renamed Customer');
    expect(res.body.access_token).toEqual(expect.any(String));
  });

  it('PATCH /users/me needs the current password to set a new one', async () => {
    const server = app.getHttpServer();
    await request(server)
      .patch('/users/me')
      .set(auth(customerToken))
      .send({ newPassword: 'brandnew123' })
      .expect(400);
    await request(server)
      .patch('/users/me')
      .set(auth(customerToken))
      .send({ currentPassword: 'wrong-password', newPassword: 'brandnew123' })
      .expect(400);
    await request(server)
      .patch('/users/me')
      .set(auth(customerToken))
      .send({ currentPassword: 'testpass123', newPassword: '123' })
      .expect(400);
    await request(server).patch('/users/me').set(auth(customerToken)).send({}).expect(400);
  });

  it('PATCH /users/me changes the password, and the new one logs in', async () => {
    await request(app.getHttpServer())
      .patch('/users/me')
      .set(auth(customerToken))
      .send({ currentPassword: 'testpass123', newPassword: 'brandnew123' })
      .expect(200);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: customerEmail, password: 'testpass123' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: customerEmail, password: 'brandnew123' })
      .expect(200);
  });

  it('PATCH /users/me cannot change the role or email', async () => {
    await request(app.getHttpServer())
      .patch('/users/me')
      .set(auth(customerToken))
      .send({ role: 'ADMIN' })
      .expect(400);
    await request(app.getHttpServer())
      .patch('/users/me')
      .set(auth(customerToken))
      .send({ email: 'someone-else@example.com' })
      .expect(400);
  });

  it('GET /users is admin-only and never leaks password hashes', async () => {
    await request(app.getHttpServer()).get('/users').expect(401);
    await request(app.getHttpServer()).get('/users').set(auth(customerToken)).expect(403);

    const res = await request(app.getHttpServer())
      .get('/users')
      .set(auth(adminToken))
      .expect(200);
    expect(res.body.some((u: { id: number }) => u.id === customerId)).toBe(true);
    expect(res.body.every((u: { password?: string }) => u.password === undefined)).toBe(true);

    const admins = await request(app.getHttpServer())
      .get('/users?role=ADMIN')
      .set(auth(adminToken))
      .expect(200);
    expect(admins.body.every((u: { role: string }) => u.role === 'ADMIN')).toBe(true);
  });

  it('GET /users/:id is admin-only and 404s for unknown ids', async () => {
    await request(app.getHttpServer()).get(`/users/${customerId}`).set(auth(customerToken)).expect(403);
    await request(app.getHttpServer()).get(`/users/${customerId}`).set(auth(adminToken)).expect(200);
    await request(app.getHttpServer()).get('/users/99999999').set(auth(adminToken)).expect(404);
  });

  it('PATCH /users/:id is admin-only', async () => {
    await request(app.getHttpServer())
      .patch(`/users/${victimId}`)
      .set(auth(customerToken))
      .send({ name: 'Nope' })
      .expect(403);
    const res = await request(app.getHttpServer())
      .patch(`/users/${victimId}`)
      .set(auth(adminToken))
      .send({ name: 'Edited By Admin' })
      .expect(200);
    expect(res.body.name).toBe('Edited By Admin');
  });

  it('an admin cannot change their own role or delete themselves', async () => {
    await request(app.getHttpServer())
      .patch(`/users/${adminId}`)
      .set(auth(adminToken))
      .send({ role: 'CUSTOMER' })
      .expect(400);
    await request(app.getHttpServer())
      .delete(`/users/${adminId}`)
      .set(auth(adminToken))
      .expect(400);
  });

  it('a logged-in order is linked to the customer; a guest order is not', async () => {
    const menu = await prisma.menu.findFirst();
    const items = [{ menuId: menu!.id, quantity: 1 }];

    const mine = await request(app.getHttpServer())
      .post('/orders')
      .set(auth(victimToken))
      .send({ customerName: 'E2E Owner', items })
      .expect(201);
    expect(mine.body.userId).toBe(victimId);

    const guest = await request(app.getHttpServer())
      .post('/orders')
      .send({ customerName: 'E2E Owner', items })
      .expect(201);
    expect(guest.body.userId).toBeNull();

    // a broken/expired token doesn't block ordering, it just makes the order a guest order
    const badToken = await request(app.getHttpServer())
      .post('/orders')
      .set(auth('not-a-real-token'))
      .send({ customerName: 'E2E Owner', items })
      .expect(201);
    expect(badToken.body.userId).toBeNull();
  });

  it('GET /orders/me returns only the caller\'s orders', async () => {
    const res = await request(app.getHttpServer())
      .get('/orders/me')
      .set(auth(victimToken))
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].userId).toBe(victimId);
    expect(res.body[0].items).toHaveLength(1);

    const other = await request(app.getHttpServer())
      .get('/orders/me')
      .set(auth(customerToken))
      .expect(200);
    expect(other.body).toEqual([]);
    await request(app.getHttpServer()).get('/orders/me').expect(401);
  });

  it('role changes take effect immediately, without a new login', async () => {
    // victimToken was issued when the user was a CUSTOMER
    await request(app.getHttpServer()).get('/users').set(auth(victimToken)).expect(403);
    await request(app.getHttpServer())
      .patch(`/users/${victimId}`)
      .set(auth(adminToken))
      .send({ role: 'ADMIN' })
      .expect(200);
    await request(app.getHttpServer()).get('/users').set(auth(victimToken)).expect(200);
    await request(app.getHttpServer())
      .patch(`/users/${victimId}`)
      .set(auth(adminToken))
      .send({ role: 'CUSTOMER' })
      .expect(200);
    await request(app.getHttpServer()).get('/users').set(auth(victimToken)).expect(403);
  });

  it('DELETE /users/:id is admin-only, keeps their orders, and kills their token', async () => {
    await request(app.getHttpServer())
      .delete(`/users/${victimId}`)
      .set(auth(customerToken))
      .expect(403);

    const res = await request(app.getHttpServer())
      .delete(`/users/${victimId}`)
      .set(auth(adminToken))
      .expect(200);
    expect(res.body).toEqual({ id: victimId, deleted: true });

    // the order survives, just no longer linked to anyone
    const kept = await prisma.order.findMany({ where: { customerName: 'E2E Owner' } });
    expect(kept.length).toBeGreaterThanOrEqual(1);
    expect(kept.every((o) => o.userId === null)).toBe(true);

    // a token for a deleted account is rejected
    await request(app.getHttpServer()).get('/users/me').set(auth(victimToken)).expect(401);
    await request(app.getHttpServer()).delete(`/users/${victimId}`).set(auth(adminToken)).expect(404);
  });
});
