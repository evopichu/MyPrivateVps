import mongoose, { Schema } from 'mongoose';

export interface IActivityLog {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  action: string;
  provider?: string;
  model?: string;
  tokensUsed?: number;
  cost?: number;
  duration: number;
  status: 'success' | 'error';
  errorMessage?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const activityLogSchema = new Schema<IActivityLog>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
    },
    provider: {
      type: String,
    },
    model: {
      type: String,
    },
    tokensUsed: {
      type: Number,
    },
    cost: {
      type: Number,
    },
    duration: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['success', 'error'],
      required: true,
    },
    errorMessage: {
      type: String,
    },
    metadata: {
      type: Map<String, any>,
      default: new Map(),
    },
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

// Index for user activity queries
activityLogSchema.index({ userId: 1, timestamp: -1 });
activityLogSchema.index({ provider: 1, timestamp: -1 });

export const ActivityLog = mongoose.model<IActivityLog>('ActivityLog', activityLogSchema);
