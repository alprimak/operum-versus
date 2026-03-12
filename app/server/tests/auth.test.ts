import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { initDatabase, resetDatabase } from '../src/models/database.js';
import { clearRefreshTokenBlacklist } from '../src/routes/auth.js';

describe('Authentication', () => {
  beforeEach(() => {
    resetDatabase();
    initDatabase();
    clearRefreshTokenBlacklist();
  });

  it('should register a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@test.com', password: 'password123', name: 'Test User' });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('test@test.com');
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  });

  it('should login with valid credentials', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@test.com', password: 'password123', name: 'Test User' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });

  it('should reject invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'wrong' });

    expect(res.status).toBe(401);
  });

  it('should refresh token', async () => {
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@test.com', password: 'password123', name: 'Test User' });

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: registerRes.body.refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });

  it('should invalidate refresh token after use', async () => {
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@test.com', password: 'password123', name: 'Test User' });

    const refreshToken = registerRes.body.refreshToken;

    // First refresh should succeed
    const first = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });
    expect(first.status).toBe(200);

    // Second refresh with same token should FAIL
    const second = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });
    expect(second.status).toBe(403);
  });

  it('should handle concurrent refresh attempts — only first should succeed', async () => {
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@test.com', password: 'password123', name: 'Test User' });

    const refreshToken = registerRes.body.refreshToken;

    // Fire 3 concurrent refresh requests with the same token
    const [r1, r2, r3] = await Promise.all([
      request(app).post('/api/auth/refresh').send({ refreshToken }),
      request(app).post('/api/auth/refresh').send({ refreshToken }),
      request(app).post('/api/auth/refresh').send({ refreshToken }),
    ]);

    const statuses = [r1.status, r2.status, r3.status];
    const successes = statuses.filter(s => s === 200);
    const failures = statuses.filter(s => s === 403);

    // Exactly one should succeed, others should fail
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(2);
  });
});
