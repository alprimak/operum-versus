import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { initDatabase, resetDatabase } from '../src/models/database.js';
import { resetRefreshTokenStore } from '../src/middleware/auth.js';

describe('Authentication', () => {
  beforeEach(() => {
    resetDatabase();
    initDatabase();
    resetRefreshTokenStore();
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

    // Second refresh with same token should fail (single-use enforcement)
    const second = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });
    expect(second.status).toBe(403);
  });

  it('should allow only one concurrent refresh per token', async () => {
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'race@test.com', password: 'password123', name: 'Race User' });

    const refreshToken = registerRes.body.refreshToken;

    const [first, second] = await Promise.all([
      request(app).post('/api/auth/refresh').send({ refreshToken }),
      request(app).post('/api/auth/refresh').send({ refreshToken }),
    ]);

    const statuses = [first.status, second.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 403]);
  });
});
