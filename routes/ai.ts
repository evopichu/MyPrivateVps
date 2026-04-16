import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate, schemas } from '../middleware/validator';
import { ApiKey } from '../models/ApiKey';
import { AIModel } from '../models/AIModel';
import { ActivityLog } from '../models/ActivityLog';
import { AIProviderService, AIRequest } from '../services/aiProvider';
import { ModelCacheService } from '../services/modelCache';
import { encrypt, hashApiKey } from '../utils/encryption';
import { logger } from '../utils/logger';

const router = express.Router();
const modelCache = new ModelCacheService();

// Store encrypted API key
router.post('/api-keys', authenticate, validate(schemas.storeApiKey), async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    const { provider, apiKey } = req.body;

    // Check if API key already exists for this provider
    const keyHash = hashApiKey(apiKey);
    const existing = await ApiKey.findOne({ userId: user._id, keyHash });

    if (existing) {
      return res.status(409).json({ error: 'API key already exists for this provider' });
    }

    // Encrypt the API key
    const encryptedKey = encrypt(apiKey);

    await ApiKey.create({
      userId: user._id,
      provider,
      encryptedKey,
      keyHash,
      isActive: true,
    });

    logger.info(`API key stored for user ${user.email}, provider: ${provider}`);
    res.status(201).json({ message: 'API key stored successfully' });
  } catch (error) {
    logger.error('Store API key error:', error);
    res.status(500).json({ error: 'Failed to store API key' });
  }
});

// Get user's API keys (providers only, not actual keys)
router.get('/api-keys', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    const apiKeys = await ApiKey.find({ userId: user._id, isActive: true });

    const keyInfo = apiKeys.map((key) => ({
      provider: key.provider,
      keyHash: key.keyHash,
      lastUsed: key.lastUsed,
      createdAt: key.createdAt,
    }));

    res.json({ apiKeys: keyInfo });
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

    const result = await ApiKey.findOneAndDelete({ userId: user._id, provider });

    if (!result) {
      return res.status(404).json({ error: 'API key not found' });
    }

    logger.info(`API key deleted for user ${user.email}, provider: ${provider}`);
    res.json({ message: 'API key deleted successfully' });
  } catch (error) {
    logger.error('Delete API key error:', error);
    res.status(500).json({ error: 'Failed to delete API key' });
  }
});

// Get available models for a provider
router.get('/models/:provider', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    const { provider } = req.params;

    // Check if user has API key for this provider
    const apiKey = await ApiKey.findOne({ userId: user._id, provider, isActive: true });
    if (!apiKey) {
      return res.status(404).json({ error: 'No API key found for this provider' });
    }

    // Try to get from cache first
    const cachedModels = await modelCache.getCachedModels(provider);
    if (cachedModels.length > 0) {
      return res.json({ models: cachedModels, source: 'cache' });
    }

    // Fetch from provider
    const service = new AIProviderService(provider, process.env[`${provider.toUpperCase()}_API_BASE`] || '');
    const models = await service.fetchModels(apiKey.encryptedKey);

    // Cache the models
    await modelCache.cacheModels(provider, models);

    // Log activity
    await ActivityLog.create({
      userId: user._id,
      action: 'fetch_models',
      provider,
      duration: 0,
      status: 'success',
    });

    res.json({ models, source: 'provider' });
  } catch (error) {
    logger.error('Get models error:', error);
    
    // Log error activity
    await ActivityLog.create({
      userId: req.user._id,
      action: 'fetch_models',
      provider: req.params.provider,
      duration: 0,
      status: 'error',
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

// Invalidate model cache for a provider
router.post('/models/:provider/invalidate', authenticate, async (req: AuthRequest, res) => {
  try {
    const { provider } = req.params;
    await modelCache.invalidateCache(provider);
    res.json({ message: 'Cache invalidated successfully' });
  } catch (error) {
    logger.error('Invalidate cache error:', error);
    res.status(500).json({ error: 'Failed to invalidate cache' });
  }
});

// Make AI request
router.post('/chat', authenticate, async (req: AuthRequest, res) => {
  const startTime = Date.now();
  try {
    const user = req.user;
    const { provider, model, messages, temperature, max_tokens, stream } = req.body;

    // Validate request
    if (!provider || !model || !messages) {
      return res.status(400).json({ error: 'Missing required fields: provider, model, messages' });
    }

    // Get user's API key
    const apiKey = await ApiKey.findOne({ userId: user._id, provider, isActive: true });
    if (!apiKey) {
      return res.status(404).json({ error: 'No API key found for this provider' });
    }

    // Update last used timestamp
    apiKey.lastUsed = new Date();
    await apiKey.save();

    // Make the request
    const service = new AIProviderService(provider, process.env[`${provider.toUpperCase()}_API_BASE`] || '');
    const request: AIRequest = { model, messages, temperature, max_tokens, stream };
    const response = await service.makeRequest(apiKey.encryptedKey, request);

    const duration = Date.now() - startTime;

    // Calculate cost
    const modelDoc = await AIModel.findOne({ provider, modelId: model });
    let cost = 0;
    if (modelDoc?.pricing) {
      const inputCost = (response.usage.prompt_tokens / 1000) * modelDoc.pricing.inputPricePer1k;
      const outputCost = (response.usage.completion_tokens / 1000) * modelDoc.pricing.outputPricePer1k;
      cost = inputCost + outputCost;
    }

    // Log activity
    await ActivityLog.create({
      userId: user._id,
      action: 'ai_request',
      provider,
      model,
      tokensUsed: response.usage.total_tokens,
      cost,
      duration,
      status: 'success',
    });

    res.json(response);
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('AI request error:', error);

    // Log error activity
    await ActivityLog.create({
      userId: req.user._id,
      action: 'ai_request',
      provider: req.body.provider,
      model: req.body.model,
      duration,
      status: 'error',
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({ error: 'AI request failed' });
  }
});

// Get activity logs
router.get('/activity', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    const { limit = 50, offset = 0, provider } = req.query;

    const query: any = { userId: user._id };
    if (provider) {
      query.provider = provider;
    }

    const logs = await ActivityLog.find(query)
      .sort({ timestamp: -1 })
      .limit(Number(limit))
      .skip(Number(offset));

    res.json({ logs, count: logs.length });
  } catch (error) {
    logger.error('Get activity logs error:', error);
    res.status(500).json({ error: 'Failed to retrieve activity logs' });
  }
});

// Get usage statistics
router.get('/usage', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    const { period = '30d' } = req.query;

    const startDate = new Date();
    if (period === '7d') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === '30d') {
      startDate.setDate(startDate.getDate() - 30);
    } else if (period === '90d') {
      startDate.setDate(startDate.getDate() - 90);
    }

    const stats = await ActivityLog.aggregate([
      {
        $match: {
          userId: user._id,
          timestamp: { $gte: startDate },
          status: 'success',
        },
      },
      {
        $group: {
          _id: '$provider',
          totalRequests: { $sum: 1 },
          totalTokens: { $sum: '$tokensUsed' },
          totalCost: { $sum: '$cost' },
          avgDuration: { $avg: '$duration' },
        },
      },
    ]);

    res.json({ stats, period });
  } catch (error) {
    logger.error('Get usage statistics error:', error);
    res.status(500).json({ error: 'Failed to retrieve usage statistics' });
  }
});

export default router;
