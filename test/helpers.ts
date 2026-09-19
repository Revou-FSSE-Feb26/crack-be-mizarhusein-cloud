import { INestApplication } from '@nestjs/common';
import { Role } from '@prisma/client';
import request from 'supertest';
import { PrismaService } from './../src/prisma/prisma.service';

// Registers a user through the public API (which always makes a CUSTOMER), optionally
// promotes them directly in the DB, then logs in so the returned JWT carries the final role.
export async function createUserToken(
  app: INestApplication,
  prisma: PrismaService,
  email: string,
  role: Role = Role.CUSTOMER,
): Promise<string> {
  const password = 'testpass123';
  await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email, password, name: 'E2E User' })
    .expect(201);

  if (role !== Role.CUSTOMER) {
    await prisma.user.update({ where: { email }, data: { role } });
  }

  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    .expect(200);
  return res.body.access_token as string;
}
