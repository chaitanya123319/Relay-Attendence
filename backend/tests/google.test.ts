/**
 * Google Sign-In tests.
 * The verifier boundary (verifyGoogleIdToken) is mocked for the endpoint
 * mapping tests; the real verifier module is additionally tested in its
 * "disabled" state (no GOOGLE_CLIENT_IDS configured → 503), offline.
 */
import request from 'supertest';
import { unauthorized } from '../src/lib/errors';
import { prisma } from '../src/lib/prisma';
import { app, bearer, resetDb, seedBasic } from './helpers';

jest.mock('../src/lib/google', () => ({ verifyGoogleIdToken: jest.fn() }));
import { verifyGoogleIdToken } from '../src/lib/google';

const mockVerify = verifyGoogleIdToken as jest.MockedFunction<typeof verifyGoogleIdToken>;

const FAKE_TOKEN = 'eyJhbGciOiJSUzI1NiJ9.' + 'a'.repeat(80);

beforeEach(async () => {
  await resetDb();
  await seedBasic();
  mockVerify.mockReset();
});

describe('Auth — Google Sign-In', () => {
  test('issues RELAY tokens for an active user whose email matches the Google account', async () => {
    mockVerify.mockResolvedValueOnce({
      email: 'engineer@test.local',
      emailVerified: true,
      name: 'Test Engineer',
    });

    const res = await request(app).post('/api/auth/google').send({ idToken: FAKE_TOKEN });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.user.role).toBe('ENGINEER');

    // The issued access token actually works against a protected route.
    const me = await request(app).get('/api/auth/me').set(bearer(res.body.accessToken));
    expect(me.status).toBe(200);
    expect(me.body.email).toBe('engineer@test.local');

    // And the login is audited distinctly from password logins.
    const audit = await prisma.auditLog.findFirst({ where: { action: 'AUTH_LOGIN_GOOGLE' } });
    expect(audit?.actorId).toBe(res.body.user.id);
  });

  test('rejects Google accounts that are not linked to a RELAY user (no self-registration)', async () => {
    mockVerify.mockResolvedValueOnce({ email: 'stranger@example.com', emailVerified: true });
    const res = await request(app).post('/api/auth/google').send({ idToken: FAKE_TOKEN });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('GOOGLE_NOT_LINKED');
  });

  test('rejects unverified Google emails', async () => {
    mockVerify.mockResolvedValueOnce({ email: 'engineer@test.local', emailVerified: false });
    const res = await request(app).post('/api/auth/google').send({ idToken: FAKE_TOKEN });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('GOOGLE_EMAIL_UNVERIFIED');
  });

  test('rejects deactivated users', async () => {
    const hr = await prisma.user.findFirstOrThrow({ where: { email: 'hr@test.local' } });
    await prisma.user.update({ where: { id: hr.id }, data: { isActive: false } });
    mockVerify.mockResolvedValueOnce({ email: 'hr@test.local', emailVerified: true });
    const res = await request(app).post('/api/auth/google').send({ idToken: FAKE_TOKEN });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('GOOGLE_NOT_LINKED');
  });

  test('propagates token verification failure as 401', async () => {
    mockVerify.mockRejectedValueOnce(unauthorized('GOOGLE_TOKEN_INVALID', 'bad token'));
    const res = await request(app).post('/api/auth/google').send({ idToken: FAKE_TOKEN });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('GOOGLE_TOKEN_INVALID');
  });

  test('validation: a missing idToken returns the standard 400 envelope', async () => {
    const res = await request(app).post('/api/auth/google').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('real verifier: with no GOOGLE_CLIENT_IDS configured, Google sign-in is disabled (503)', async () => {
    const real = jest.requireActual('../src/lib/google') as {
      verifyGoogleIdToken: (t: string) => Promise<unknown>;
    };
    await expect(real.verifyGoogleIdToken('not-a-real-token')).rejects.toMatchObject({
      status: 503,
      code: 'GOOGLE_DISABLED',
    });
  });
});
