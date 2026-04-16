import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
  user?: any;
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized - Please login' });
    }

    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

export async function requirePermission(category: string, action: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      
      if (!user || !user.permissions) {
        return res.status(403).json({ error: 'Forbidden - No permissions found' });
      }

      const hasPermission = user.permissions.some(
        (perm: string) => perm === `${category}:${action}` || perm === `${category}:*` || perm === '*'
      );

      if (!hasPermission) {
        logger.warn(`Permission denied for user ${user.email} - ${category}:${action}`);
        return res.status(403).json({ 
          error: 'Forbidden - Insufficient permissions',
          required: `${category}:${action}`
        });
      }

      next();
    } catch (error) {
      logger.error('Permission check error:', error);
      res.status(500).json({ error: 'Permission check failed' });
    }
  };
}
