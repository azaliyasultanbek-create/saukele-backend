const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
const env = require('./config/env');
const app = express();
const swaggerDocument = YAML.load(path.join(__dirname, '../openapi.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
const authLimiter = rateLimit({
 windowMs: 60 * 1000, 
max: 5, 
  message: {
    code: 'TOO_MANY_REQUESTS',
    message: 'Too many login/register attempts. Please try again after 15 minutes.',
    timestamp: new Date().toISOString()
  },
  skipSuccessfulRequests: true 
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://saukele.kz', 'https://admin.saukele.kz']
    : '*',
  credentials: true
}));
app.use((req, res, next) => {
  console.log(`\n ${req.method} ${req.url}`);
  console.log('   Headers:', req.headers['content-type']);
  console.log('   Body:', req.body);
  next();
});
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.post('/test-body', (req, res) => {
  console.log(' /test-body received body:', req.body);
  res.json({ 
    message: 'Body received!', 
    body: req.body,
    contentType: req.headers['content-type']
  });
});
const authRoutes = require('./routes/authRoutes');
app.use('/auth', authLimiter, authRoutes); 
const giftRoutes = require('./routes/giftRoutes');
app.use('/gifts', giftRoutes);
const coupleRoutes = require('./routes/coupleRoutes');
app.use('/couples', coupleRoutes);
const contributionRoutes = require('./routes/contributionRoutes');
app.use('/contributions', contributionRoutes);
const familyRoutes = require('./routes/familyRoutes');
app.use('/family', familyRoutes);
const adminRoutes = require('./routes/adminRoutes');
app.use('/admin', adminRoutes);
const escrowRoutes = require('./routes/escrowRoutes');
app.use('/escrow', escrowRoutes);

const { getSupportedCurrencies, getRate, refreshRates } = require('./services/currencyService');
app.get('/currencies', (req, res) => {
  const currencies = getSupportedCurrencies();
  const rates = {};
  currencies.forEach(c => {
    rates[c.code] = getRate(c.code);
  });
  res.json({
    base: 'KZT',
    currencies,
    rates,
    updatedAt: new Date().toISOString()
  });
});
app.use((req, res) => {
  res.status(404).json({ 
    code: 'NOT_FOUND',
    message: `Cannot ${req.method} ${req.url}`,
    timestamp: new Date().toISOString()
  });
});
app.use((err, req, res, next) => {
  console.error(' Error:', err.stack);
  res.status(500).json({ 
    code: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

module.exports = app;
