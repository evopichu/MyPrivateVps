import mongoose, { Schema, Document } from 'mongoose';

export interface IQueueItem {
  taskId: mongoose.Types.ObjectId;
  position: number;
  status: 'waiting' | 'processing' | 'completed' | 'failed' | 'skipped';
  dependencies: mongoose.Types.ObjectId[];
  conditionalExecution: boolean;
  condition?: {
    type: 'previous_success' | 'previous_failure' | 'custom';
    expression?: string;
  };
  addedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface IQueue extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  items: IQueueItem[];
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  mode: 'sequential' | 'parallel' | 'conditional';
  currentPosition: number;
  progress: {
    completed: number;
    failed: number;
    total: number;
  };
  chatId?: mongoose.Types.ObjectId;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

const queueItemSchema = new Schema<IQueueItem>({
  taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
  position: { type: Number, required: true },
  status: {
    type: String,
    enum: ['waiting', 'processing', 'completed', 'failed', 'skipped'],
    default: 'waiting',
  },
  dependencies: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
  conditionalExecution: { type: Boolean, default: false },
  condition: {
    type: {
      type: String,
      enum: ['previous_success', 'previous_failure', 'custom'],
    },
    expression: String,
  },
  addedAt: { type: Date, default: Date.now },
  startedAt: Date,
  completedAt: Date,
});

const queueSchema = new Schema<IQueue>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    items: {
      type: [queueItemSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ['idle', 'running', 'paused', 'completed', 'failed'],
      default: 'idle',
    },
    mode: {
      type: String,
      enum: ['sequential', 'parallel', 'conditional'],
      default: 'sequential',
    },
    currentPosition: {
      type: Number,
      default: 0,
    },
    progress: {
      completed: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },
    chatId: {
      type: Schema.Types.ObjectId,
      ref: 'Chat',
      index: true,
    },
    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
      default: new Map(),
    },
    startedAt: Date,
    completedAt: Date,
  },
  {
    timestamps: true,
  }
);

queueSchema.index({ userId: 1, status: 1 });
queueSchema.index({ userId: 1, createdAt: -1 });
queueSchema.index({ chatId: 1, createdAt: -1 });
queueSchema.index({ status: 1, updatedAt: -1 });

export const Queue = mongoose.model<IQueue>('Queue', queueSchema);
