import express from 'express';
import { authenticate, AuthRequest, requirePermission } from '../middleware/auth';
import { validate, schemas } from '../middleware/validator';
import { Permission } from '../models/Permission';
import { User } from '../models/User';
import { logger } from '../utils/logger';

const router = express.Router();

// Grant a permission
router.post('/', authenticate, validate(schemas.grantPermission), async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    const { category, action, persistent, expiresAt, reason } = req.body;

    // Check if permission already exists
    const existing = await Permission.findOne({
      userId: user._id,
      category,
      action,
    });

    if (existing) {
      existing.isGranted = true;
      existing.persistent = persistent;
      existing.expiresAt = expiresAt;
      existing.grantedAt = new Date();
      existing.reason = reason;
      await existing.save();
    } else {
      await Permission.create({
        userId: user._id,
        category,
        action,
        isGranted: true,
        persistent,
        expiresAt,
        reason,
      });
    }

    // Update user permissions list
    const permString = `${category}:${action}`;
    if (!user.permissions.includes(permString)) {
      user.permissions.push(permString);
      await user.save();
    }

    logger.info(`Permission granted to user ${user.email}: ${category}:${action}`);
    res.json({ message: 'Permission granted successfully' });
  } catch (error) {
    logger.error('Grant permission error:', error);
    res.status(500).json({ error: 'Failed to grant permission' });
  }
});

// Revoke a permission
router.delete('/:category/:action', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    const { category, action } = req.params;

    const permission = await Permission.findOneAndUpdate(
      { userId: user._id, category, action },
      { isGranted: false, grantedAt: new Date() }
    );

    if (!permission) {
      return res.status(404).json({ error: 'Permission not found' });
    }

    // Remove from user permissions list
    const permString = `${category}:${action}`;
    user.permissions = user.permissions.filter((p: string) => p !== permString);
    await user.save();

    logger.info(`Permission revoked for user ${user.email}: ${category}:${action}`);
    res.json({ message: 'Permission revoked successfully' });
  } catch (error) {
    logger.error('Revoke permission error:', error);
    res.status(500).json({ error: 'Failed to revoke permission' });
  }
});

// Get all permissions for current user
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    const permissions = await Permission.find({ userId: user._id });

    res.json({ permissions, count: permissions.length });
  } catch (error) {
    logger.error('Get permissions error:', error);
    res.status(500).json({ error: 'Failed to retrieve permissions' });
  }
});

// Check if user has a specific permission
router.get('/check/:category/:action', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    const { category, action } = req.params;

    const permission = await Permission.findOne({
      userId: user._id,
      category,
      action,
      isGranted: true,
    });

    // Check if permission has expired
    if (permission && permission.expiresAt && permission.expiresAt < new Date()) {
      permission.isGranted = false;
      await permission.save();
      return res.json({ hasPermission: false, reason: 'Permission expired' });
    }

    // Check user's permission list
    const permString = `${category}:${action}`;
    const hasListPermission = user.permissions.some(
      (p: string) => p === permString || p === `${category}:*` || p === '*'
    );

    res.json({
      hasPermission: !!permission || hasListPermission,
      permission: permission || null,
    });
  } catch (error) {
    logger.error('Check permission error:', error);
    res.status(500).json({ error: 'Failed to check permission' });
  }
});

export default router;
