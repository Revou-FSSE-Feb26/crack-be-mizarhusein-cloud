import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const testEmail = `e2e-auth-${Date.now()}@example.com`;

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
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: testEmail } });
    await app.close();
  });

  it('POST /auth/register rejects an invalid body', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'not-an-email', password: '123' })
      .expect(400);
  });

  it('POST /auth/register creates a new user and returns a JWT', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: testEmail, password: 'testpass123', name: 'E2E Tester' })
      .expect(201);

    expect(res.body.access_token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ email: testEmail, name: 'E2E Tester' });
  });

  it('POST /auth/register rejects a duplicate email', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: testEmail, password: 'testpass123' })
      .expect(409);
  });

  it('POST /auth/login rejects a wrong password', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testEmail, password: 'wrongpassword' })
      .expect(401);
  });

  it('POST /auth/login succeeds with the right credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testEmail, password: 'testpass123' })
      .expect(200);

    expect(res.body.access_token).toEqual(expect.any(String));
  });
});
