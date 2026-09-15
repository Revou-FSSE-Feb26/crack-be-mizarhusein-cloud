import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('Reservation (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token: string;
  let createdId: number;
  const testEmail = `e2e-reservation-${Date.now()}@example.com`;
  const guestEmail = `e2e-guest-${Date.now()}@example.com`;

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

    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: testEmail, password: 'testpass123' });
    token = registerRes.body.access_token;
  });

  afterAll(async () => {
    if (createdId) {
      await prisma.reservation.deleteMany({ where: { id: createdId } });
    }
    await prisma.user.deleteMany({ where: { email: testEmail } });
    await app.close();
  });

  it('POST /reservations is public (no token needed)', async () => {
    const res = await request(app.getHttpServer())
      .post('/reservations')
      .send({
        customerName: 'E2E Test Guest',
        email: guestEmail,
        phone: '+62 812 0000 0001',
        partySize: 2,
        date: '2026-11-01T18:00:00.000Z',
        notes: 'e2e test',
      })
      .expect(201);

    expect(res.body.status).toBe('PENDING');
    createdId = res.body.id;
  });

  it('GET /reservations is rejected without a token', () => {
    return request(app.getHttpServer()).get('/reservations').expect(401);
  });

  it('GET /reservations returns the created reservation when authenticated', async () => {
    const res = await request(app.getHttpServer())
      .get('/reservations')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.some((r: { id: number }) => r.id === createdId)).toBe(true);
  });

  it('PATCH /reservations/:id is rejected without a token', () => {
    return request(app.getHttpServer())
      .patch(`/reservations/${createdId}`)
      .send({ status: 'CONFIRMED' })
      .expect(401);
  });

  it('PATCH /reservations/:id updates status when authenticated', () => {
    return request(app.getHttpServer())
      .patch(`/reservations/${createdId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'CONFIRMED' })
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('CONFIRMED');
      });
  });

  it('DELETE /reservations/:id cancels (soft-delete) when authenticated', () => {
    return request(app.getHttpServer())
      .delete(`/reservations/${createdId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('CANCELLED');
      });
  });
});
