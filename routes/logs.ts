import express, { Request, Response } from 'express';
import { SystemLog } from '../models/SystemLog';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    const isAdmin = req.user?.role === 'admin';
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { 
      level, 
      category, 
      action, 
      startDate, 
      endDate, 
      limit = 50, 
      skip = 0 
    } = req.query;

    const query: any = isAdmin ? {} : { userId };
    
    if (level) query.level = level;
    if (category) query.category = category;
    if (action) query.action = action;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate as string);
      if (endDate) query.timestamp.$lte = new Date(endDate as string);
    }

    const logs = await SystemLog.find(query)
      .sort({ timestamp: -1 })
      .skip(parseInt(skip as string))
      .limit(parseInt(limit as string))
      .lean();

    const total = await SystemLog.countDocuments(query);

    res.json({
      logs,
      total,
      limit: parseInt(limit as string),
      skip: parseInt(skip as string),
    });
  } catch (error) {
    logger.error('Error fetching system logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    const isAdmin = req.user?.role === 'admin';
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { days = 7 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days as string));

    const query: any = { 
      timestamp: { $gte: startDate },
      ...(!isAdmin && { userId })
    };

    const stats = await SystemLog.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            level: '$level',
            category: '$category',
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: '$_id.category',
          levels: {
            $push: {
              level: '$_id.level',
              count: '$count',
            },
          },
          total: { $sum: '$count' },
        },
      },
    ]);

    const timeline = await SystemLog.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$timestamp' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({ stats, timeline });
  } catch (error) {
    logger.error('Error fetching log stats:', error);
    res.status(500).json({ error: 'Failed to fetch log stats' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    const isAdmin = req.user?.role === 'admin';
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const query: any = { _id: id };
    if (!isAdmin) query.userId = userId;

    const log = await SystemLog.findOne(query).lean();
    if (!log) {
      return res.status(404).json({ error: 'Log not found' });
    }

    res.json(log);
  } catch (error) {
    logger.error('Error fetching log:', error);
    res.status(500).json({ error: 'Failed to fetch log' });
  }
});

export default router;
