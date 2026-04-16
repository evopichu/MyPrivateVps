import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function validate(schema: Joi.ObjectSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body);

    if (error) {
      logger.warn('Validation error:', error.details);
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map((detail) => ({
          field: detail.path.join('.'),
          message: detail.message,
        })),
      });
    }

    req.body = value;
    next();
  };
}

export const schemas = {
  // User schemas
  updateUserPreferences: Joi.object({
    preferences: Joi.object().pattern(Joi.string(), Joi.any()).required(),
  }),

  storeApiKey: Joi.object({
    provider: Joi.string().valid('openai', 'anthropic', 'custom').required(),
    apiKey: Joi.string().required(),
  }),

  // Task schemas
  createTask: Joi.object({
    objective: Joi.string().required(),
    actionType: Joi.string().required(),
    parameters: Joi.object().default({}),
    dependencies: Joi.array().items(Joi.string()).default([]),
    requiredPermissions: Joi.array().items(Joi.string()).default([]),
    metadata: Joi.object().default({}),
  }),

  updateTask: Joi.object({
    status: Joi.string().valid('pending', 'in_progress', 'completed', 'failed', 'skipped'),
    result: Joi.object({
      success: Joi.boolean(),
      data: Joi.object(),
      error: Joi.string(),
      executionTime: Joi.number(),
    }),
  }),

  // Permission schemas
  grantPermission: Joi.object({
    category: Joi.string().required(),
    action: Joi.string().required(),
    persistent: Joi.boolean().default(false),
    expiresAt: Joi.date().optional(),
    reason: Joi.string().optional(),
  }),
};
