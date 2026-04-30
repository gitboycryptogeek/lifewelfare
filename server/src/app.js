require('./config/env').validateEnv();
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const cookieParser = require('cookie-parser');

const { testConnection } = require('./config/db');
const { errorHandler } = require('./middleware/errorHandler');
const { autoAudit } = require('./middleware/audit');

const authRoutes = require('./modules/auth/auth.routes');
const memberRoutes = require('./modules/members/members.routes');
const claimRoutes = require('./modules/claims/claims.routes');
const communicationRoutes = require('./modules/communications/communications.routes');
const reportRoutes = require('./modules/reports/reports.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const teamLeaderRoutes = require('./modules/team-leader/teamLeader.routes');
const prospectRoutes = require('./modules/prospects/prospects.routes');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

// Parse
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Static file serving for uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// Audit logging for mutating requests
app.use('/api', autoAudit);

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/members', memberRoutes);
app.use('/api/v1/claims', claimRoutes);
app.use('/api/v1/communications', communicationRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/team-leader', teamLeaderRoutes);
app.use('/api/v1/prospects', prospectRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ success: true, message: 'MLC Welfare API is running', timestamp: new Date().toISOString() });
});

// Serve React frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
  });
}

// Error handler (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

async function start() {
  await testConnection();
  app.listen(PORT, () => {
    console.log(`MLC Welfare API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  });
}

start();

module.exports = app;
