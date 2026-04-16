import mongoose, { Schema, Document } from 'mongoose';

export interface ITask extends Document {
  userId: mongoose.Types.ObjectId;
  chatId?: mongoose.Types.ObjectId;
  objective: string;
  actionType: string;
  parameters: Record<string, any>;
  dependencies: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  result?: {
    success: boolean;
    data?: Record<string, any>;
    error?: string;
    executionTime: number;
    output?: string;
    logs?: string[];
  };
  steps?: Array<{
    order: number;
    description: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    startedAt?: Date;
    completedAt?: Date;
    result?: any;
  }>;
  requiredPermissions: string[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  scheduledFor?: Date;
}

const taskSchema = new Schema<ITask>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    chatId: {
      type: Schema.Types.ObjectId,
      ref: 'Chat',
      index: true,
    },
    objective: {
      type: String,
      required: true,
    },
    actionType: {
      type: String,
      required: true,
    },
    parameters: {
      type: Map<String, any>,
      default: new Map(),
    },
    dependencies: [{
      type: String,
    }],
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'failed', 'skipped', 'cancelled'],
      default: 'pending',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
      index: true,
    },
    result: {
      success: Boolean,
      data: Map<String, any>,
      error: String,
      executionTime: Number,
      output: String,
      logs: [String],
    },
    steps: [{
      order: Number,
      description: String,
      status: { type: String, enum: ['pending', 'in_progress', 'completed', 'failed'] },
      startedAt: Date,
      completedAt: Date,
      result: Schema.Types.Mixed,
    }],
    requiredPermissions: [{
      type: String,
    }],
    metadata: {
      type: Map<String, any>,
      default: new Map(),
    },
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    scheduledFor: {
      type: Date,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for user + status queries
taskSchema.index({ userId: 1, status: 1 });
taskSchema.index({ userId: 1, createdAt: -1 });
taskSchema.index({ chatId: 1, createdAt: -1 });
taskSchema.index({ userId: 1, priority: 1, createdAt: -1 });
taskSchema.index({ scheduledFor: 1, status: 1 });

export const Task = mongoose.model<ITask>('Task', taskSchema);
