import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  googleId?: string;
  email: string;
  name: string;
  avatar?: string;
  provider: string;
  isVerified: boolean;
  isActive: boolean;
  role: 'user' | 'premium' | 'admin';
  permissions: string[];
  preferences: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  lastActivityAt?: Date;
  apiKeys: Map<string, string>;
}

const userSchema = new Schema<IUser>(
  {
    googleId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
    },
    avatar: {
      type: String,
    },
    provider: {
      type: String,
      default: 'local',
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    role: {
      type: String,
      enum: ['user', 'premium', 'admin'],
      default: 'user',
      index: true,
    },
    permissions: {
      type: [String],
      default: ['user'],
    },
    preferences: {
      type: Map,
      of: Schema.Types.Mixed,
      default: new Map(),
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    lastLoginAt: {
      type: Date,
    },
    lastActivityAt: {
      type: Date,
    },
    apiKeys: {
      type: Map,
      of: String,
      default: new Map(),
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 });
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ createdAt: -1 });

export const User = mongoose.model<IUser>('User', userSchema);
