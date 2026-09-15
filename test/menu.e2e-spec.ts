import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('Menu (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token: string;
  let createdId: number;
  const testEmail = `e2e-menu-${Date.now()}@example.com`;

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
    await prisma.menu.deleteMany({ where: { name: 'E2E Test Pizza' } });
    await prisma.user.deleteMany({ where: { email: testEmail } });
    await app.close();
  });

  it('GET /menus is public and returns the seeded catalog', async () => {
    const res = await request(app.getHttpServer()).get('/menus').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(20);
  });

  it('POST /menus is rejected without a token', () => {
    return request(app.getHttpServer())
      .post('/menus')
      .send({ name: 'E2E Test Pizza', description: '', price: 1000, image: '', category: 'pizza' })
      .expect(401);
  });

  it('POST /menus creates an item when authenticated', async () => {
    const res = await request(app.getHttpServer())
      .post('/menus')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'E2E Test Pizza', description: '', price: 1000, image: '', category: 'pizza' })
      .expect(201);

    expect(res.body).toMatchObject({ name: 'E2E Test Pizza', price: 1000 });
    createdId = res.body.id;
  });

  it('GET /menus/:id returns the created item', () => {
    return request(app.getHttpServer())
      .get(`/menus/${createdId}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.name).toBe('E2E Test Pizza');
      });
  });

  it('PATCH /menus/:id updates the item when authenticated', () => {
    return request(app.getHttpServer())
      .patch(`/menus/${createdId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ price: 2000 })
      .expect(200)
      .expect((res) => {
        expect(res.body.price).toBe(2000);
      });
  });

  it('DELETE /menus/:id is rejected without a token', () => {
    return request(app.getHttpServer()).delete(`/menus/${createdId}`).expect(401);
  });

  it('DELETE /menus/:id removes the item when authenticated', async () => {
    await request(app.getHttpServer())
      .delete(`/menus/${createdId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app.getHttpServer()).get(`/menus/${createdId}`).expect(404);
  });
});
