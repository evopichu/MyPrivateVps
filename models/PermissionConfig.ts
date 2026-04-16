import mongoose, { Schema, Document } from 'mongoose';

export interface IPermissionConfig extends Document {
  userId: mongoose.Types.ObjectId;
  permissions: Map<string, 'always_allow' | 'always_deny' | 'ask'>;
  defaultBehavior: 'always_allow' | 'always_deny' | 'ask';
  createdAt: Date;
  updatedAt: Date;
}

const permissionConfigSchema = new Schema<IPermissionConfig>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    permissions: {
      type: Map,
      of: String,
      default: new Map(),
    },
    defaultBehavior: {
      type: String,
      enum: ['always_allow', 'always_deny', 'ask'],
      default: 'ask',
    },
  },
  {
    timestamps: true,
  }
);

export const PermissionConfig = mongoose.model<IPermissionConfig>(
  'PermissionConfig',
  permissionConfigSchema
);
