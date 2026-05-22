const request = require('supertest');
process.env.ADMIN_API_KEY = 'test_admin_key';
const app = require('../src/app');
describe('Admin API Tests', () => {
  test('GET /admin/queues - should reject missing admin key', async () => {
    const res = await request(app).get('/admin/queues');

    expect(res.statusCode).toBe(403);
  });

  test('GET /admin/queues - should return email queue counts with admin key', async () => {
    const res = await request(app)
      .get('/admin/queues')
      .set('x-admin-api-key', 'test_admin_key');

    expect(res.statusCode).toBe(200);
    expect(res.body.queues).toHaveProperty('emails');
  });
});
