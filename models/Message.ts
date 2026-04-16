import mongoose, { Schema, Document } from 'mongoose';

export interface IAttachment {
  type: 'file' | 'image' | 'code' | 'url';
  name: string;
  content?: string;
  url?: string;
  mimeType?: string;
  size?: number;
}

export interface IMessage extends Document {
  _id: mongoose.Types.ObjectId;
  chatId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: IAttachment[];
  metadata?: {
    model?: string;
    provider?: string;
    tokensUsed?: number;
    inputTokens?: number;
    outputTokens?: number;
    cost?: number;
    duration?: number;
    executionRef?: mongoose.Types.ObjectId;
    taskRef?: mongoose.Types.ObjectId;
    feedback?: 'positive' | 'negative';
    edited?: boolean;
    editHistory?: Array<{
      content: string;
      editedAt: Date;
    }>;
  };
  createdAt: Date;
  updatedAt: Date;
}

const attachmentSchema = new Schema<IAttachment>({
  type: { type: String, enum: ['file', 'image', 'code', 'url'], required: true },
  name: { type: String, required: true },
  content: { type: String },
  url: { type: String },
  mimeType: { type: String },
  size: { type: Number },
});

const messageSchema = new Schema<IMessage>(
  {
    chatId: {
      type: Schema.Types.ObjectId,
      ref: 'Chat',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['user', 'assistant', 'system'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
    metadata: {
      model: String,
      provider: String,
      tokensUsed: Number,
      inputTokens: Number,
      outputTokens: Number,
      cost: Number,
      duration: Number,
      executionRef: { type: Schema.Types.ObjectId, ref: 'Task' },
      taskRef: { type: Schema.Types.ObjectId, ref: 'Task' },
      feedback: { type: String, enum: ['positive', 'negative'] },
      edited: { type: Boolean, default: false },
      editHistory: [{
        content: String,
        editedAt: Date,
      }],
    },
  },
  {
    timestamps: true,
  }
);

messageSchema.index({ chatId: 1, createdAt: -1 });
messageSchema.index({ userId: 1, createdAt: -1 });
messageSchema.index({ chatId: 1, role: 1 });
messageSchema.index({ 'metadata.model': 1, createdAt: -1 });

export const Message = mongoose.model<IMessage>('Message', messageSchema);
