import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Message } from '../models/Message';
import { Chat } from '../models/Chat';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

router.use(authenticate);

router.get('/chat/:chatId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    const { chatId } = req.params;
    const { limit = 50, before, after } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const chat = await Chat.findOne({ _id: chatId, userId });
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const query: any = { chatId, userId };
    
    if (before) {
      query.createdAt = { $lt: new Date(before as string) };
    }
    if (after) {
      query.createdAt = { ...query.createdAt, $gt: new Date(after as string) };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string))
      .lean();

    res.json({
      messages: messages.reverse(),
      count: messages.length,
      hasMore: messages.length === parseInt(limit as string),
    });
  } catch (error) {
    logger.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const message = await Message.findOne({ _id: id, userId }).lean();
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json(message);
  } catch (error) {
    logger.error('Error fetching message:', error);
    res.status(500).json({ error: 'Failed to fetch message' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { chatId, role, content, attachments, metadata } = req.body;

    const chat = await Chat.findOne({ _id: chatId, userId });
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const message = await Message.create({
      chatId,
      userId,
      role,
      content,
      attachments,
      metadata,
    });

    await Chat.findByIdAndUpdate(chatId, {
      $inc: { messageCount: 1 },
      $set: { 
        lastMessageAt: new Date(),
        preview: content.substring(0, 100),
      },
    });

    logger.info(`Created message ${message._id} in chat ${chatId}`);
    res.status(201).json(message);
  } catch (error) {
    logger.error('Error creating message:', error);
    res.status(500).json({ error: 'Failed to create message' });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { content } = req.body;
    const message = await Message.findOne({ _id: id, userId });
    
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.role !== 'user') {
      return res.status(403).json({ error: 'Only user messages can be edited' });
    }

    const oldContent = message.content;
    message.content = content;
    message.metadata = {
      ...message.metadata,
      edited: true,
      editHistory: [
        ...(message.metadata?.editHistory || []),
        { content: oldContent, editedAt: new Date() },
      ],
    };
    
    await message.save();

    logger.info(`Updated message ${id}`);
    res.json(message);
  } catch (error) {
    logger.error('Error updating message:', error);
    res.status(500).json({ error: 'Failed to update message' });
  }
});

router.post('/:id/feedback', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;
    const { feedback } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!['positive', 'negative'].includes(feedback)) {
      return res.status(400).json({ error: 'Invalid feedback value' });
    }

    const message = await Message.findOneAndUpdate(
      { _id: id, userId },
      { $set: { 'metadata.feedback': feedback } },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    logger.info(`Added feedback to message ${id}: ${feedback}`);
    res.json(message);
  } catch (error) {
    logger.error('Error adding feedback:', error);
    res.status(500).json({ error: 'Failed to add feedback' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const message = await Message.findOne({ _id: id, userId });
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    await Message.findByIdAndDelete(id);
    await Chat.findByIdAndUpdate(message.chatId, {
      $inc: { messageCount: -1 },
    });

    logger.info(`Deleted message ${id}`);
    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    logger.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

export default router;
