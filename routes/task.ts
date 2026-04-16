import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate, schemas } from '../middleware/validator';
import { Task } from '../models/Task';
import { ExecutionLog } from '../models/ExecutionLog';
import { logger } from '../utils/logger';

const router = express.Router();

// Create a new task
router.post('/', authenticate, validate(schemas.createTask), async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    const taskData = req.body;

    const task = await Task.create({
      userId: user._id,
      ...taskData,
      parameters: new Map(Object.entries(taskData.parameters || {})),
      metadata: new Map(Object.entries(taskData.metadata || {})),
    });

    logger.info(`Task created for user ${user.email}: ${task._id}`);
    res.status(201).json(task);
  } catch (error) {
    logger.error('Create task error:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Get all tasks for current user
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    const { status, limit = 50, offset = 0 } = req.query;

    const query: any = { userId: user._id };
    if (status) {
      query.status = status;
    }

    const tasks = await Task.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(offset));

    res.json({ tasks, count: tasks.length });
  } catch (error) {
    logger.error('Get tasks error:', error);
    res.status(500).json({ error: 'Failed to retrieve tasks' });
  }
});

// Get a specific task
router.get('/:taskId', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    const { taskId } = req.params;

    const task = await Task.findOne({ _id: taskId, userId: user._id });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
  } catch (error) {
    logger.error('Get task error:', error);
    res.status(500).json({ error: 'Failed to retrieve task' });
  }
});

// Update task status
router.patch('/:taskId', authenticate, validate(schemas.updateTask), async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    const { taskId } = req.params;
    const updates = req.body;

    const task = await Task.findOne({ _id: taskId, userId: user._id });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Update task fields
    if (updates.status) {
      task.status = updates.status;
      if (updates.status === 'in_progress' && !task.startedAt) {
        task.startedAt = new Date();
      }
      if (['completed', 'failed', 'skipped'].includes(updates.status) && !task.completedAt) {
        task.completedAt = new Date();
      }
    }

    if (updates.result) {
      task.result = updates.result;
    }

    await task.save();
    logger.info(`Task updated: ${taskId}, status: ${updates.status}`);
    res.json(task);
  } catch (error) {
    logger.error('Update task error:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Delete a task
router.delete('/:taskId', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    const { taskId } = req.params;

    const task = await Task.findOneAndDelete({ _id: taskId, userId: user._id });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    logger.info(`Task deleted: ${taskId}`);
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    logger.error('Delete task error:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// Get execution logs for a task
router.get('/:taskId/logs', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    const { taskId } = req.params;

    const task = await Task.findOne({ _id: taskId, userId: user._id });
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const logs = await ExecutionLog.find({ taskId }).sort({ timestamp: -1 });

    res.json({ logs, count: logs.length });
  } catch (error) {
    logger.error('Get task logs error:', error);
    res.status(500).json({ error: 'Failed to retrieve execution logs' });
  }
});

export default router;
