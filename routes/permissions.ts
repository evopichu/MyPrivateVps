import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { PermissionConfig } from '../models/PermissionConfig';
import { logger } from '../utils/logger';

const router = express.Router();

// Get user's permission configuration
router.get('/config', authenticate, async (req: AuthRequest, res) => {
  try {
    let config = await PermissionConfig.findOne({ userId: req.user!._id });
    
    if (!config) {
      // Create default config
      config = await PermissionConfig.create({
        userId: req.user!._id,
        permissions: new Map(),
        defaultBehavior: 'ask',
      });
    }
    
    res.json({
      permissions: Object.fromEntries(config.permissions),
      defaultBehavior: config.defaultBehavior,
    });
  } catch (error) {
    logger.error('Get permission config error:', error);
    res.status(500).json({ error: 'Failed to retrieve permission configuration' });
  }
});

// Update permission configuration
router.put('/config', authenticate, async (req: AuthRequest, res) => {
  try {
    const { permissions, defaultBehavior } = req.body;
    
    let config = await PermissionConfig.findOne({ userId: req.user!._id });
    
    if (!config) {
      config = await PermissionConfig.create({
        userId: req.user!._id,
        permissions: new Map(Object.entries(permissions || {})),
        defaultBehavior: defaultBehavior || 'ask',
      });
    } else {
      if (permissions) {
        config.permissions = new Map(Object.entries(permissions));
      }
      if (defaultBehavior) {
        config.defaultBehavior = defaultBehavior;
      }
      await config.save();
    }
    
    logger.info(`Permission config updated for user: ${req.user!._id}`);
    res.json({ 
      message: 'Permission configuration updated successfully',
      permissions: Object.fromEntries(config.permissions),
      defaultBehavior: config.defaultBehavior,
    });
  } catch (error) {
    logger.error('Update permission config error:', error);
    res.status(500).json({ error: 'Failed to update permission configuration' });
  }
});

// Check if a permission is granted
router.post('/check', authenticate, async (req: AuthRequest, res) => {
  try {
    const { permissionId } = req.body;
    
    const config = await PermissionConfig.findOne({ userId: req.user!._id });
    
    if (!config) {
      return res.json({ granted: false, behavior: 'ask' });
    }
    
    const behavior = config.permissions.get(permissionId) || config.defaultBehavior;
    
    res.json({ 
      granted: behavior === 'always_allow',
      behavior,
    });
  } catch (error) {
    logger.error('Check permission error:', error);
    res.status(500).json({ error: 'Failed to check permission' });
  }
});

export default router;
