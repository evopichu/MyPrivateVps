import express, { Request, Response } from 'express';
import { Queue } from '../models/Queue';
import { Task } from '../models/Task';
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

    const { status, limit = 20 } = req.query;
    const query: any = { userId };
    
    if (status) query.status = status;

    const queues = await Queue.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string))
      .lean();

    res.json(queues);
  } catch (error) {
    logger.error('Error fetching queues:', error);
    res.status(500).json({ error: 'Failed to fetch queues' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const queue = await Queue.findOne({ _id: id, userId }).lean();
    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    res.json(queue);
  } catch (error) {
    logger.error('Error fetching queue:', error);
    res.status(500).json({ error: 'Failed to fetch queue' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, description, mode = 'sequential', chatId, items = [] } = req.body;

    const queue = await Queue.create({
      userId,
      name,
      description,
      mode,
      chatId,
      items: items.map((item: any, index: number) => ({
        ...item,
        position: index,
        status: 'waiting',
        addedAt: new Date(),
      })),
      progress: { completed: 0, failed: 0, total: items.length },
    });

    logger.info(`Created queue ${queue._id} for user ${userId}`);
    res.status(201).json(queue);
  } catch (error) {
    logger.error('Error creating queue:', error);
    res.status(500).json({ error: 'Failed to create queue' });
  }
});

router.post('/:id/items', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { taskId, dependencies = [], conditionalExecution = false, condition } = req.body;

    const queue = await Queue.findOne({ _id: id, userId });
    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    const position = queue.items.length;
    queue.items.push({
      taskId,
      position,
      status: 'waiting',
      dependencies,
      conditionalExecution,
      condition,
      addedAt: new Date(),
    });
    queue.progress.total = queue.items.length;
    
    await queue.save();

    logger.info(`Added item to queue ${id}`);
    res.json(queue);
  } catch (error) {
    logger.error('Error adding queue item:', error);
    res.status(500).json({ error: 'Failed to add item to queue' });
  }
});

router.put('/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;
    const { status } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validStatuses = ['idle', 'running', 'paused', 'completed', 'failed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updates: any = { status };
    if (status === 'running') updates.startedAt = new Date();
    if (['completed', 'failed'].includes(status)) updates.completedAt = new Date();

    const queue = await Queue.findOneAndUpdate(
      { _id: id, userId },
      { $set: updates },
      { new: true }
    );

    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    logger.info(`Updated queue ${id} status to ${status}`);
    res.json(queue);
  } catch (error) {
    logger.error('Error updating queue status:', error);
    res.status(500).json({ error: 'Failed to update queue status' });
  }
});

router.put('/:id/items/:itemId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    const { id, itemId } = req.params;
    const { status } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const queue = await Queue.findOne({ _id: id, userId });
    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    const item = queue.items.find((i: any) => i._id?.toString() === itemId);
    if (!item) {
      return res.status(404).json({ error: 'Queue item not found' });
    }

    item.status = status;
    if (status === 'processing') item.startedAt = new Date();
    if (['completed', 'failed', 'skipped'].includes(status)) {
      item.completedAt = new Date();
      if (status === 'completed') queue.progress.completed++;
      if (status === 'failed') queue.progress.failed++;
    }

    await queue.save();

    logger.info(`Updated queue item ${itemId} status to ${status}`);
    res.json(queue);
  } catch (error) {
    logger.error('Error updating queue item:', error);
    res.status(500).json({ error: 'Failed to update queue item' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const queue = await Queue.findOneAndDelete({ _id: id, userId });
    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    logger.info(`Deleted queue ${id}`);
    res.json({ message: 'Queue deleted successfully' });
  } catch (error) {
    logger.error('Error deleting queue:', error);
    res.status(500).json({ error: 'Failed to delete queue' });
  }
});

export default router;
