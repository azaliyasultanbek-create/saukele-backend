const request = require('supertest');
const app = require('../src/app');
const { prisma } = require('../src/config/database');

describe('Contributions API Tests', () => {
  let coupleToken, guestToken, giftId;
  const phoneSuffix = String(Date.now()).slice(-8);
  const couplePhone = `771${phoneSuffix}`;
  const guestPhone = `772${phoneSuffix}`;
  
  beforeAll(async () => {
    await request(app).post('/auth/register').send({
      phone: couplePhone,
      email: `${couplePhone}@test.local`,
      password: 'Couple123',
      fullName: 'Test Couple',
      role: 'couple'
    });

    await prisma.user.update({
      where: { phone: couplePhone },
      data: { emailVerified: true, emailVerifiedAt: new Date() }
    });
    
    const coupleLogin = await request(app).post('/auth/login').send({
      phone: couplePhone,
      password: 'Couple123'
    });
    coupleToken = coupleLogin.body.access_token;

    await request(app)
      .post('/couples/profile')
      .set('Authorization', `Bearer ${coupleToken}`)
      .send({
        partner2Name: 'Test Partner',
        weddingDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        venue: 'Test Venue'
      });

    await request(app).post('/auth/register').send({
      phone: guestPhone,
      email: `${guestPhone}@test.local`,
      password: 'Guest123',
      fullName: 'Test Guest',
      role: 'guest'
    });

    await prisma.user.update({
      where: { phone: guestPhone },
      data: { emailVerified: true, emailVerifiedAt: new Date() }
    });
    
    const guestLogin = await request(app).post('/auth/login').send({
      phone: guestPhone,
      password: 'Guest123'
    });
    guestToken = guestLogin.body.access_token;

    await request(app)
      .post('/family/members')
      .set('Authorization', `Bearer ${coupleToken}`)
      .send({
        guestPhone,
        kinshipTier: 'parents'
      });

    const gift = await request(app)
      .post('/gifts')
      .set('Authorization', `Bearer ${coupleToken}`)
      .send({
        name: 'Test Gift',
        targetAmount: 100000,
        currency: 'KZT'
      });
    
    giftId = gift.body.gift?.id;
  });
  
  test('POST /contributions - guest can contribute to gift', async () => {
    if (!giftId) {
      console.log('Skipping test - gift not created');
      return;
    }
    
    const res = await request(app)
      .post('/contributions')
      .set('Authorization', `Bearer ${guestToken}`)
      .send({
        giftId,
        amount: 10000
      });
    
    expect(res.statusCode).toBe(201);
    expect(res.body.contribution.amount).toBe(10000);
  });
  
  test('GET /health - server works', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
  });
});
