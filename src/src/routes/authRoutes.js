const express = require('express');
const { authenticate } = require('../middleware/auth');
const {
  validateRegister,
  register,
  login,
  refresh,
  logout,
  me,
  forgotPassword,
  resetPassword,
  verifyEmail
} = require('../controllers/authController');

const router = express.Router();

router.post('/register', validateRegister, register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/verify-email', verifyEmail);
router.get('/verify-email', verifyEmail);

router.post('/logout', authenticate, logout);
router.get('/me', authenticate, me);

module.exports = router;
