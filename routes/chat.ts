import express from 'express';
import { Chat } from '../models/Chat';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

// Get all chats for current user
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const chats = await Chat.find({ userId: req.user!._id })
      .sort({ updatedAt: -1 })
      .limit(50);
    
    res.json({ chats });
  } catch (error) {
    logger.error('Error fetching chats:', error);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

// Get single chat with messages
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const chat = await Chat.findOne({ 
      _id: req.params.id, 
      userId: req.user!._id 
    });
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    res.json({ chat });
  } catch (error) {
    logger.error('Error fetching chat:', error);
    res.status(500).json({ error: 'Failed to fetch chat' });
  }
});

// Create new chat
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { title, firstMessage } = req.body;
    
    const chat = await Chat.create({
      userId: req.user!._id,
      title: title || 'New Chat',
      preview: firstMessage?.substring(0, 100) || '',
      messages: firstMessage ? [{
        role: 'user',
        content: firstMessage,
        timestamp: new Date(),
      }] : [],
    });
    
    logger.info(`Created new chat: ${chat._id} for user: ${req.user!._id}`);
    res.status(201).json({ chat });
  } catch (error) {
    logger.error('Error creating chat:', error);
    res.status(500).json({ error: 'Failed to create chat' });
  }
});

// Update chat (title, messages)
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { title, messages } = req.body;
    
    const chat = await Chat.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!._id },
      { 
        ...(title && { title }),
        ...(messages && { 
          messages,
          preview: messages[messages.length - 1]?.content?.substring(0, 100) || ''
        }),
      },
      { new: true }
    );
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    res.json({ chat });
  } catch (error) {
    logger.error('Error updating chat:', error);
    res.status(500).json({ error: 'Failed to update chat' });
  }
});

// Add message to chat
router.post('/:id/messages', authenticate, async (req: AuthRequest, res) => {
  try {
    const { role, content, metadata } = req.body;
    
    const chat = await Chat.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!._id },
      { 
        $push: { 
          messages: { 
            role, 
            content, 
            timestamp: new Date(),
            metadata,
          } 
        },
        $set: {
          preview: content?.substring(0, 100) || ''
        }
      },
      { new: true }
    );
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    res.json({ chat });
  } catch (error) {
    logger.error('Error adding message:', error);
    res.status(500).json({ error: 'Failed to add message' });
  }
});

// Delete chat
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const chat = await Chat.findOneAndDelete({ 
      _id: req.params.id, 
      userId: req.user!._id 
    });
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    logger.info(`Deleted chat: ${req.params.id}`);
    res.json({ message: 'Chat deleted successfully' });
  } catch (error) {
    logger.error('Error deleting chat:', error);
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

export default router;
