import mongoose, { Schema, Document } from 'mongoose';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export type LogCategory = 'auth' | 'api' | 'task' | 'chat' | 'execution' | 'system' | 'admin' | 'security';

export interface ISystemLog extends Document {
  _id: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  level: LogLevel;
  category: LogCategory;
  action: string;
  message: string;
  entity?: {
    type: 'user' | 'task' | 'chat' | 'message' | 'apikey' | 'permission' | 'queue' | 'admin';
    id?: mongoose.Types.ObjectId;
    name?: string;
  };
  metadata?: Record<string, any>;
  context?: {
    ip?: string;
    userAgent?: string;
    endpoint?: string;
    method?: string;
    requestId?: string;
  };
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  duration?: number;
  timestamp: Date;
  createdAt: Date;
}

const systemLogSchema = new Schema<ISystemLog>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    level: {
      type: String,
      enum: ['debug', 'info', 'warn', 'error', 'fatal'],
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ['auth', 'api', 'task', 'chat', 'execution', 'system', 'admin', 'security'],
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    message: {
      type: String,
      required: true,
    },
    entity: {
      type: {
        type: String,
        enum: ['user', 'task', 'chat', 'message', 'apikey', 'permission', 'queue', 'admin'],
      },
      id: { type: Schema.Types.ObjectId },
      name: String,
    },
    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
      default: new Map(),
    },
    context: {
      ip: String,
      userAgent: String,
      endpoint: String,
      method: String,
      requestId: String,
    },
    error: {
      message: String,
      stack: String,
      code: String,
    },
    duration: Number,
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

systemLogSchema.index({ level: 1, category: 1, timestamp: -1 });
systemLogSchema.index({ userId: 1, timestamp: -1 });
systemLogSchema.index({ category: 1, action: 1, timestamp: -1 });
systemLogSchema.index({ 'entity.type': 1, 'entity.id': 1 });
systemLogSchema.index({ timestamp: -1 }, { expireAfterSeconds: 2592000 });

export const SystemLog = mongoose.model<ISystemLog>('SystemLog', systemLogSchema);
