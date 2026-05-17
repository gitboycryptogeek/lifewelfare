const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { verifyToken } = require('../../middleware/auth');
const otpCtrl = require('./otp.controller');

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many OTP requests, please try again in 15 minutes' },
});

// Verify OTP after staff/admin credential check
router.post(
  '/verify-login',
  otpLimiter,
  [
    body('otpSessionToken').notEmpty().withMessage('Session token is required'),
    body('code')
      .isLength({ min: 6, max: 6 })
      .isNumeric()
      .withMessage('A 6-digit verification code is required'),
  ],
  otpCtrl.verifyLoginOtp
);

// Member passwordless login — request OTP
router.post(
  '/request-member-login',
  otpLimiter,
  [body('identifier').notEmpty().withMessage('Email or phone number is required')],
  otpCtrl.requestMemberOtp
);

// Member passwordless login — verify OTP
router.post(
  '/verify-member-login',
  otpLimiter,
  [
    body('identifier').notEmpty().withMessage('Email or phone number is required'),
    body('code')
      .isLength({ min: 6, max: 6 })
      .isNumeric()
      .withMessage('A 6-digit verification code is required'),
  ],
  otpCtrl.verifyMemberOtp
);

// Forgot password — request OTP
router.post(
  '/request-forgot-password',
  otpLimiter,
  [body('identifier').notEmpty().withMessage('Email or phone number is required')],
  otpCtrl.requestForgotPasswordOtp
);

// Forgot password — verify OTP and set new password
router.post(
  '/reset-password',
  otpLimiter,
  [
    body('identifier').notEmpty().withMessage('Email or phone number is required'),
    body('code')
      .isLength({ min: 6, max: 6 })
      .isNumeric()
      .withMessage('A 6-digit verification code is required'),
    body('new_password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
  ],
  otpCtrl.resetPasswordWithOtp
);

// Request OTP for a protected action (change password, edit member, disburse)
router.post(
  '/request-action',
  verifyToken,
  otpLimiter,
  [
    body('purpose')
      .isIn(['change_password', 'edit_member', 'disburse'])
      .withMessage('Invalid purpose'),
  ],
  otpCtrl.requestActionOtp
);

module.exports = router;
