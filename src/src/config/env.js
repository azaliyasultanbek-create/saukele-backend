const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'REDIS_URL',
  'FRONTEND_URL'
];

const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('Missing required environment variables:');
  missingVars.forEach((varName) => console.error(` - ${varName}`));
  process.exit(1);
}

if (process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be at least 32 characters long');
  process.exit(1);
}

module.exports = {
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
  redisUrl: process.env.REDIS_URL,
  // Gmail SMTP
  smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
  smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  smtpFromEmail: process.env.SMTP_FROM_EMAIL || 'sultanbekazalia0@gmail.com',
  smtpFromName: process.env.SMTP_FROM_NAME || 'Saukele',
  // Настройки отправителя
  emailFromName: process.env.EMAIL_FROM_NAME || 'Saukele',
  frontendUrl: process.env.FRONTEND_URL,
  databasePoolMin: parseInt(process.env.DATABASE_POOL_MIN || '2', 10),
  databasePoolMax: parseInt(process.env.DATABASE_POOL_MAX || '10', 10),
  kaspiApiKey: process.env.KASPI_API_KEY,
  kaspiWebhookSecret: process.env.KASPI_WEBHOOK_SECRET,
  adminApiKey: process.env.ADMIN_API_KEY,
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10)
};