import mongoose, { Schema, Document } from 'mongoose';

export interface IUserSettings extends Document {
  userId: mongoose.Types.ObjectId;
  theme: 'dark' | 'light' | 'system';
  uiPreferences: {
    sidebarCollapsed: boolean;
    showTimestamps: boolean;
    fontSize: 'small' | 'medium' | 'large';
    compactMode: boolean;
    showAvatars: boolean;
    codeBlockTheme: string;
  };
  layout: {
    chatPanelWidth: number;
    taskPanelWidth: number;
    sidebarPosition: 'left' | 'right';
    panelLayout: 'stacked' | 'split' | 'tabs';
  };
  animations: {
    enabled: boolean;
    speed: 'slow' | 'normal' | 'fast';
    reduceMotion: boolean;
    transitionEffects: boolean;
  };
  defaultMode: 'chat' | 'execute';
  language: string;
  timezone: string;
  dateFormat: string;
  notifications: {
    enabled: boolean;
    sound: boolean;
    desktop: boolean;
    taskCompletion: boolean;
    errors: boolean;
  };
  autoSave: {
    enabled: boolean;
    interval: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const userSettingsSchema = new Schema<IUserSettings>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    theme: {
      type: String,
      enum: ['dark', 'light', 'system'],
      default: 'dark',
    },
    uiPreferences: {
      sidebarCollapsed: { type: Boolean, default: false },
      showTimestamps: { type: Boolean, default: true },
      fontSize: { type: String, enum: ['small', 'medium', 'large'], default: 'medium' },
      compactMode: { type: Boolean, default: false },
      showAvatars: { type: Boolean, default: true },
      codeBlockTheme: { type: String, default: 'dark' },
    },
    layout: {
      chatPanelWidth: { type: Number, default: 50 },
      taskPanelWidth: { type: Number, default: 50 },
      sidebarPosition: { type: String, enum: ['left', 'right'], default: 'left' },
      panelLayout: { type: String, enum: ['stacked', 'split', 'tabs'], default: 'split' },
    },
    animations: {
      enabled: { type: Boolean, default: true },
      speed: { type: String, enum: ['slow', 'normal', 'fast'], default: 'normal' },
      reduceMotion: { type: Boolean, default: false },
      transitionEffects: { type: Boolean, default: true },
    },
    defaultMode: {
      type: String,
      enum: ['chat', 'execute'],
      default: 'chat',
    },
    language: {
      type: String,
      default: 'en',
    },
    timezone: {
      type: String,
      default: 'UTC',
    },
    dateFormat: {
      type: String,
      default: 'MM/DD/YYYY',
    },
    notifications: {
      enabled: { type: Boolean, default: true },
      sound: { type: Boolean, default: true },
      desktop: { type: Boolean, default: true },
      taskCompletion: { type: Boolean, default: true },
      errors: { type: Boolean, default: true },
    },
    autoSave: {
      enabled: { type: Boolean, default: true },
      interval: { type: Number, default: 30000 },
    },
  },
  {
    timestamps: true,
  }
);

userSettingsSchema.index({ userId: 1 });

export const UserSettings = mongoose.model<IUserSettings>('UserSettings', userSettingsSchema);
