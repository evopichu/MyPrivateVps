import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate, schemas } from '../middleware/validator';
import { User } from '../models/User';
import { encrypt, decrypt, hashApiKey } from '../utils/encryption';
import { logger } from '../utils/logger';

const router = express.Router();

// Get user profile
router.get('/profile', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    res.json({
      id: user._id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      provider: user.provider,
      isVerified: user.isVerified,
      permissions: user.permissions,
      preferences: Object.fromEntries(user.preferences),
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to retrieve profile' });
  }
});

// Update user preferences
router.put('/preferences', authenticate, validate(schemas.updateUserPreferences), async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    const { preferences } = req.body;

    user.preferences = new Map(Object.entries(preferences));
    await user.save();

    logger.info(`User preferences updated: ${user.email}`);
    res.json({ message: 'Preferences updated successfully' });
  } catch (error) {
    logger.error('Update preferences error:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// Store encrypted API key
router.post('/api-keys', authenticate, validate(schemas.storeApiKey), async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    const { provider, apiKey } = req.body;

    // Encrypt the API key before storing
    const encryptedKey = encrypt(apiKey);
    const keyHash = hashApiKey(apiKey);

    // Store encrypted key with hash as identifier
    user.apiKeys.set(`${provider}:${keyHash}`, encryptedKey);
    await user.save();

    logger.info(`API key stored for user: ${user.email}, provider: ${provider}`);
    res.json({ 
      message: 'API key stored successfully',
      keyHash,
    });
  } catch (error) {
    logger.error('Store API key error:', error);
    res.status(500).json({ error: 'Failed to store API key' });
  }
});

// Get API key hashes (not the actual keys)
router.get('/api-keys', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    const keyHashes = Array.from(user.apiKeys.keys() as string[]).map((key) => {
      const [provider, hash] = key.split(':');
      return { provider, keyHash: hash };
    });

    res.json({ apiKeys: keyHashes });
  } catch (error) {
    logger.error('Get API keys error:', error);
    res.status(500).json({ error: 'Failed to retrieve API keys' });
  }
});

// Delete API key
router.delete('/api-keys/:provider', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    const { provider } = req.params;

    // Find and delete all keys for this provider
    let deleted = false;
    for (const [key] of user.apiKeys.entries()) {
      if (key.startsWith(`${provider}:`)) {
        user.apiKeys.delete(key);
        deleted = true;
      }
    }

    if (!deleted) {
      return res.status(404).json({ error: 'API key not found' });
    }

    await user.save();
    logger.info(`API key deleted for user: ${user.email}, provider: ${provider}`);
    res.json({ message: 'API key deleted successfully' });
  } catch (error) {
    logger.error('Delete API key error:', error);
    res.status(500).json({ error: 'Failed to delete API key' });
  }
});

export default router;
