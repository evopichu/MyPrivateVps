import mongoose, { Schema, Document } from 'mongoose';

export interface IExecutionLog extends Document {
  userId: mongoose.Types.ObjectId;
  taskId: string;
  action: string;
  status: 'started' | 'completed' | 'failed';
  duration: number;
  error?: string;
  metadata: Record<string, any>;
  timestamp: Date;
}

const executionLogSchema = new Schema<IExecutionLog>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    taskId: {
      type: String,
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['started', 'completed', 'failed'],
      required: true,
    },
    duration: {
      type: Number,
      required: true,
    },
    error: {
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
executionLogSchema.index({ userId: 1, timestamp: -1 });

export const ExecutionLog = mongoose.model<IExecutionLog>('ExecutionLog', executionLogSchema);
