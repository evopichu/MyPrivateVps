import mongoose, { Schema, Document } from 'mongoose';

export interface IChat extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  title: string;
  preview?: string;
  messageCount: number;
  lastMessageAt?: Date;
  settings?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
  };
  metadata?: {
    tags?: string[];
    category?: string;
    isPinned?: boolean;
    isArchived?: boolean;
    totalTokens?: number;
    estimatedCost?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const chatSchema = new Schema<IChat>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    preview: {
      type: String,
      trim: true,
    },
    messageCount: {
      type: Number,
      default: 0,
    },
    lastMessageAt: {
      type: Date,
    },
    settings: {
      model: String,
      temperature: { type: Number, default: 0.7 },
      maxTokens: Number,
      systemPrompt: String,
    },
    metadata: {
      tags: [String],
      category: String,
      isPinned: { type: Boolean, default: false },
      isArchived: { type: Boolean, default: false },
      totalTokens: { type: Number, default: 0 },
      estimatedCost: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
chatSchema.index({ userId: 1, updatedAt: -1 });
chatSchema.index({ userId: 1, 'metadata.isPinned': 1, updatedAt: -1 });
chatSchema.index({ userId: 1, 'metadata.isArchived': 1, updatedAt: -1 });
chatSchema.index({ userId: 1, 'metadata.tags': 1 });
chatSchema.index({ lastMessageAt: -1 });

export const Chat = mongoose.model<IChat>('Chat', chatSchema);
