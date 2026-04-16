import mongoose, { Schema, Document } from 'mongoose';

export interface IAIModel extends Document {
  userId?: mongoose.Types.ObjectId;
  provider: string;
  modelId: string;
  modelName: string;
  description?: string;
  contextWindow?: number;
  maxTokens?: number;
  pricing?: {
    inputPricePer1k: number;
    outputPricePer1k: number;
    currency: string;
  };
  capabilities?: string[];
  supportedFeatures?: string[];
  isAvailable: boolean;
  isUserConfigured: boolean;
  config?: {
    apiEndpoint?: string;
    customHeaders?: Record<string, string>;
    timeout?: number;
    retries?: number;
  };
  cachedAt: Date;
  ttl: Date;
  createdAt: Date;
  updatedAt: Date;
}

const aiModelSchema = new Schema<IAIModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      sparse: true,
    },
    provider: {
      type: String,
      required: true,
      index: true,
    },
    modelId: {
      type: String,
      required: true,
    },
    modelName: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    contextWindow: {
      type: Number,
    },
    maxTokens: {
      type: Number,
    },
    pricing: {
      inputPricePer1k: Number,
      outputPricePer1k: Number,
      currency: { type: String, default: 'USD' },
    },
    capabilities: [{
      type: String,
    }],
    supportedFeatures: [{
      type: String,
    }],
    isAvailable: {
      type: Boolean,
      default: true,
    },
    isUserConfigured: {
      type: Boolean,
      default: false,
    },
    config: {
      apiEndpoint: String,
      customHeaders: { type: Map, of: String },
      timeout: { type: Number, default: 30000 },
      retries: { type: Number, default: 3 },
    },
    cachedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    ttl: {
      type: Date,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for provider + model lookups
aiModelSchema.index({ provider: 1, modelId: 1 });
aiModelSchema.index({ userId: 1, provider: 1 });
aiModelSchema.index({ isAvailable: 1, provider: 1 });
aiModelSchema.index({ ttl: 1 }, { expireAfterSeconds: 0 });

export const AIModel = mongoose.model<IAIModel>('AIModel', aiModelSchema);
