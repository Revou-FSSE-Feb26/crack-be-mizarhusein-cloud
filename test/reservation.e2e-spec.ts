import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Role } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { createUserToken } from './helpers';

describe('Reservation (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  let customerToken: string;
  let otherCustomerToken: string;
  let createdId: number;
  const stamp = Date.now();
  const adminEmail = `e2e-rsv-admin-${stamp}@example.com`;
  const customerEmail = `e2e-rsv-customer-${stamp}@example.com`;
  const otherEmail = `e2e-rsv-other-${stamp}@example.com`;

  const body = {
    customerName: 'E2E Test Guest',
    email: customerEmail,
    phone: '+62 812 0000 0001',
    partySize: 2,
    date: '2026-11-01T18:00:00.000Z',
    notes: 'e2e test',
  };

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
    otherCustomerToken = await createUserToken(app, prisma, otherEmail);
  });

  afterAll(async () => {
    await prisma.reservation.deleteMany({ where: { email: customerEmail } });
    await prisma.user.deleteMany({
      where: { email: { in: [adminEmail, customerEmail, otherEmail] } },
    });
    await app.close();
  });

  it('POST /reservations requires login', () => {
    return request(app.getHttpServer()).post('/reservations').send(body).expect(401);
  });

  it('POST /reservations creates a PENDING booking linked to the customer', async () => {
    const res = await request(app.getHttpServer())
      .post('/reservations')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(body)
      .expect(201);

    expect(res.body.status).toBe('PENDING');
    expect(res.body.userId).toEqual(expect.any(Number));
    createdId = res.body.id;
  });

  it('GET /reservations/me returns only the callers own bookings', async () => {
    const mine = await request(app.getHttpServer())
      .get('/reservations/me')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    expect(mine.body.map((r: { id: number }) => r.id)).toEqual([createdId]);

    const theirs = await request(app.getHttpServer())
      .get('/reservations/me')
      .set('Authorization', `Bearer ${otherCustomerToken}`)
      .expect(200);
    expect(theirs.body).toEqual([]);
  });

  it('GET /reservations/me is rejected without a token', () => {
    return request(app.getHttpServer()).get('/reservations/me').expect(401);
  });

  it('GET /reservations (all) is rejected without a token', () => {
    return request(app.getHttpServer()).get('/reservations').expect(401);
  });

  it('GET /reservations (all) is forbidden for a customer', () => {
    return request(app.getHttpServer())
      .get('/reservations')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);
  });

  it('GET /reservations (all) works for an admin', async () => {
    const res = await request(app.getHttpServer())
      .get('/reservations')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.some((r: { id: number }) => r.id === createdId)).toBe(true);
  });

  it('PATCH /reservations/:id is forbidden for a customer', () => {
    return request(app.getHttpServer())
      .patch(`/reservations/${createdId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ status: 'CONFIRMED' })
      .expect(403);
  });

  it('PATCH /reservations/:id updates status for an admin', () => {
    return request(app.getHttpServer())
      .patch(`/reservations/${createdId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'CONFIRMED' })
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('CONFIRMED');
      });
  });

  it('DELETE /reservations/me/:id cannot cancel someone elses booking', () => {
    return request(app.getHttpServer())
      .delete(`/reservations/me/${createdId}`)
      .set('Authorization', `Bearer ${otherCustomerToken}`)
      .expect(404);
  });

  it('DELETE /reservations/me/:id lets the owner cancel their booking', () => {
    return request(app.getHttpServer())
      .delete(`/reservations/me/${createdId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('CANCELLED');
      });
  });

  it('DELETE /reservations/me/:id refuses to cancel an already-cancelled booking', () => {
    return request(app.getHttpServer())
      .delete(`/reservations/me/${createdId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(400);
  });

  it('DELETE /reservations/:id (admin cancel) is forbidden for a customer', () => {
    return request(app.getHttpServer())
      .delete(`/reservations/${createdId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);
  });
});
