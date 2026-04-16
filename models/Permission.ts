import mongoose, { Schema, Document } from 'mongoose';

export interface IPermission extends Document {
  userId: mongoose.Types.ObjectId;
  category: string;
  action: string;
  isGranted: boolean;
  persistent: boolean;
  expiresAt?: Date;
  grantedAt: Date;
  reason?: string;
}

const permissionSchema = new Schema<IPermission>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      required: true,
    },
    isGranted: {
      type: Boolean,
      default: false,
    },
    persistent: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
    },
    grantedAt: {
      type: Date,
      default: Date.now,
    },
    reason: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient permission lookups
permissionSchema.index({ userId: 1, category: 1, action: 1 });
permissionSchema.index({ userId: 1, expiresAt: 1 }, { sparse: true });

export const Permission = mongoose.model<IPermission>('Permission', permissionSchema);
