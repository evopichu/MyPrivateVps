import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { connectDatabase } from './config/database';
import { initializePassport } from './config/passport';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import taskRoutes from './routes/task';
import permissionRoutes from './routes/permission';
import permissionConfigRoutes from './routes/permissions';
import aiRoutes from './routes/ai';
import chatRoutes from './routes/chat';
import userSettingsRoutes from './routes/userSettings';
import messageRoutes from './routes/messages';
import queueRoutes from './routes/queue';
import logsRoutes from './routes/logs';

// Load .env from parent directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false // Disable CSP for OAuth to work
}));
app.use(cors({
  origin: [
    process.env.CORS_ORIGIN || 'http://localhost:5173',
    'http://localhost:5174',
    'file://' // Allow Electron file protocol
  ],
  credentials: true
}));

// Request logging
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use(rateLimiter);

// Initialize passport
initializePassport(app);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/permissions-config', permissionConfigRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/settings', userSettingsRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/queues', queueRoutes);
app.use('/api/logs', logsRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    await connectDatabase();

    app.listen(PORT, () => {
      logger.info(`Backend server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
