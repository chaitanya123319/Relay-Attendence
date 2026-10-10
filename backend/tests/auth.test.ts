import request from 'supertest';
import { app, bearer, loginAs, resetDb, seedBasic } from './helpers';

beforeAll(async () => {
  await resetDb();
  await seedBasic();
});

describe('Auth', () => {
  test('logs in with email and returns access + refresh tokens', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'engineer@test.local', password: 'Relay@123' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.user.role).toBe('ENGINEER');
    expect(res.body.user.passwordHash).toBeUndefined(); // never leaks hashes
  });

  test('logs in with employee ID', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'T-0004', password: 'Relay@123' });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('engineer@test.local');
  });

  test('rejects a wrong password with a consistent error envelope', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'engineer@test.local', password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(res.body.error.message).toBeDefined();
  });

  test('rejects an unknown user without revealing account existence', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'nobody@test.local', password: 'whatever123' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('GET /me requires a token and returns the profile with one', async () => {
    const unauth = await request(app).get('/api/auth/me');
    expect(unauth.status).toBe(401);
    expect(unauth.body.error.code).toBe('AUTH_REQUIRED');

    const { accessToken } = await loginAs('engineer@test.local');
    const res = await request(app).get('/api/auth/me').set(bearer(accessToken));
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('engineer@test.local');
  });

  test('refresh rotates tokens and the old refresh token cannot be reused', async () => {
    const { refreshToken } = await loginAs('engineer@test.local');

    const first = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(first.status).toBe(200);
    expect(first.body.accessToken).toBeTruthy();
    expect(first.body.refreshToken).not.toBe(refreshToken);

    // Replaying the rotated token = theft signal → rejected + chain revoked.
    const replay = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('REFRESH_REUSE');

    // The freshly issued token is revoked too (whole chain).
    const chain = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: first.body.refreshToken });
    expect(chain.status).toBe(401);
  });

  test('logout revokes the refresh token', async () => {
    const { accessToken, refreshToken } = await loginAs('engineer@test.local');
    const out = await request(app)
      .post('/api/auth/logout')
      .set(bearer(accessToken))
      .send({ refreshToken });
    expect(out.status).toBe(200);

    const after = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(after.status).toBe(401);
  });

  test('deactivated users cannot log in or keep sessions', async () => {
    const { prisma } = await import('../src/lib/prisma');
    const hr = await prisma.user.findUniqueOrThrow({ where: { email: 'hr@test.local' } });
    await prisma.user.update({ where: { id: hr.id }, data: { isActive: false } });

    const login = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'hr@test.local', password: 'Relay@123' });
    expect(login.status).toBe(401);

    await prisma.user.update({ where: { id: hr.id }, data: { isActive: true } });
  });

  test('validation errors are returned as 400 VALIDATION_ERROR', async () => {
    const res = await request(app).post('/api/auth/login').send({ identifier: '', password: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
