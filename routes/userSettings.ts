import express, { Request, Response } from 'express';
import { UserSettings } from '../models/UserSettings';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let settings = await UserSettings.findOne({ userId });
    
    if (!settings) {
      settings = await UserSettings.create({ userId });
      logger.info(`Created default settings for user ${userId}`);
    }

    res.json(settings);
  } catch (error) {
    logger.error('Error fetching user settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.put('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const allowedFields = [
      'theme', 'uiPreferences', 'layout', 'animations', 
      'defaultMode', 'language', 'timezone', 'dateFormat',
      'notifications', 'autoSave'
    ];

    const updates: any = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const settings = await UserSettings.findOneAndUpdate(
      { userId },
      { $set: updates },
      { new: true, upsert: true }
    );

    logger.info(`Updated settings for user ${userId}`);
    res.json(settings);
  } catch (error) {
    logger.error('Error updating user settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

router.patch('/:section', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    const { section } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validSections = ['theme', 'uiPreferences', 'layout', 'animations', 'notifications', 'autoSave'];
    if (!validSections.includes(section)) {
      return res.status(400).json({ error: 'Invalid settings section' });
    }

    const settings = await UserSettings.findOneAndUpdate(
      { userId },
      { $set: { [section]: req.body } },
      { new: true, upsert: true }
    );

    logger.info(`Updated ${section} settings for user ${userId}`);
    res.json(settings);
  } catch (error) {
    logger.error('Error updating user settings section:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

router.delete('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await UserSettings.findOneAndDelete({ userId });
    const defaultSettings = await UserSettings.create({ userId });
    
    logger.info(`Reset settings for user ${userId}`);
    res.json(defaultSettings);
  } catch (error) {
    logger.error('Error resetting user settings:', error);
    res.status(500).json({ error: 'Failed to reset settings' });
  }
});

export default router;
