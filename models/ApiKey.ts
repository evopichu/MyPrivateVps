import mongoose, { Schema, Document } from 'mongoose';

export type ApiProvider = 'openai' | 'anthropic' | 'google' | 'azure' | 'cohere' | 'ollama' | 'custom';

export interface IApiKey extends Document {
  userId: mongoose.Types.ObjectId;
  provider: ApiProvider;
  name: string;
  encryptedKey: string;
  keyHash: string;
  isActive: boolean;
  isDefault: boolean;
  lastUsed?: Date;
  usageStats?: {
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    lastMonthCost: number;
  };
  restrictions?: {
    allowedModels?: string[];
    maxRequestsPerDay?: number;
    maxTokensPerDay?: number;
    allowedOrigins?: string[];
  };
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const apiKeySchema = new Schema<IApiKey>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ['openai', 'anthropic', 'google', 'azure', 'cohere', 'ollama', 'custom'],
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    encryptedKey: {
      type: String,
      required: true,
    },
    keyHash: {
      type: String,
      required: true,
      unique: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    lastUsed: {
      type: Date,
    },
    usageStats: {
      totalRequests: { type: Number, default: 0 },
      totalTokens: { type: Number, default: 0 },
      totalCost: { type: Number, default: 0 },
      lastMonthCost: { type: Number, default: 0 },
    },
    restrictions: {
      allowedModels: [String],
      maxRequestsPerDay: Number,
      maxTokensPerDay: Number,
      allowedOrigins: [String],
    },
    expiresAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for user + provider lookups
apiKeySchema.index({ userId: 1, provider: 1 });
apiKeySchema.index({ userId: 1, isDefault: 1 });
apiKeySchema.index({ keyHash: 1 });
apiKeySchema.index({ isActive: 1, expiresAt: 1 });

export const ApiKey = mongoose.model<IApiKey>('ApiKey', apiKeySchema);
