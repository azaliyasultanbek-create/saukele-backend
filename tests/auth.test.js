const request = require('supertest');
const app = require('../src/app');
const { prisma } = require('../src/config/database');

describe('Auth API Tests', () => {
  const uniquePhone = `77${String(Date.now()).slice(-9)}`;

  const testUser = {
    phone: uniquePhone,
    email: `${uniquePhone}@test.local`,
    password: 'Test123456',
    fullName: 'Test Student',
    role: 'guest'
  };

  test('POST /auth/register - should create new user', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send(testUser);

    expect(res.statusCode).toBe(201);
    expect(res.body.user.emailVerified).toBe(false);
  });

  test('POST /auth/login - should block unverified user', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({
        phone: testUser.phone,
        password: testUser.password
      });

    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
  });

  test('POST /auth/login - should login successfully', async () => {
    await prisma.user.update({
      where: { phone: testUser.phone },
      data: { emailVerified: true, emailVerifiedAt: new Date() }
    });

    const res = await request(app)
      .post('/auth/login')
      .send({
        phone: testUser.phone,
        password: testUser.password
      });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('access_token');

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: res.body.refresh_token }
    });
    expect(storedToken).toBeTruthy();
    expect(storedToken.isRevoked).toBe(false);
  });

  test('POST /auth/refresh - should rotate refresh token', async () => {
    const login = await request(app)
      .post('/auth/login')
      .send({
        phone: testUser.phone,
        password: testUser.password
      });

    const res = await request(app)
      .post('/auth/refresh')
      .send({ refresh_token: login.body.refresh_token });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('access_token');
    expect(res.body).toHaveProperty('refresh_token');
    expect(res.body.refresh_token).not.toBe(login.body.refresh_token);

    const oldToken = await prisma.refreshToken.findUnique({
      where: { token: login.body.refresh_token }
    });
    const newToken = await prisma.refreshToken.findUnique({
      where: { token: res.body.refresh_token }
    });

    expect(oldToken.isRevoked).toBe(true);
    expect(newToken).toBeTruthy();
    expect(newToken.isRevoked).toBe(false);
  });

  test('POST /auth/login - should fail with wrong password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({
        phone: testUser.phone,
        password: 'wrongpassword'
      });

    expect(res.statusCode).toBe(401);
  });
  test('GET /gifts - should fail without token', async () => {
    const res = await request(app).get('/gifts');
    expect(res.statusCode).toBe(401);
  });

  test('POST /gifts - guest should get 403', async () => {
    const login = await request(app).post('/auth/login').send({
      phone: testUser.phone,
      password: testUser.password
    });

    const token = login.body.access_token;

    const res = await request(app)
      .post('/gifts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Forbidden Gift',
        targetAmount: 10000
      });

    expect(res.statusCode).toBe(403);
  });

  test('GET /health - server should respond', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
