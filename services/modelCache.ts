import { AIModel } from '../models/AIModel';
import { logger } from '../utils/logger';

export class ModelCacheService {
  private cacheTTL: number;

  constructor() {
    this.cacheTTL = parseInt(process.env.MODEL_CACHE_TTL || '3600') * 1000; // Convert to milliseconds
  }

  async getCachedModels(provider: string): Promise<any[]> {
    try {
      const cached = await AIModel.find({
        provider,
        isAvailable: true,
        ttl: { $gt: new Date() },
      }).sort({ cachedAt: -1 });

      if (cached.length > 0) {
        logger.info(`Retrieved ${cached.length} cached models for ${provider}`);
        return cached;
      }

      return [];
    } catch (error) {
      logger.error('Error fetching cached models:', error);
      return [];
    }
  }

  async cacheModels(provider: string, models: any[]): Promise<void> {
    try {
      const ttl = new Date(Date.now() + this.cacheTTL);

      // Delete old cached models for this provider
      await AIModel.deleteMany({ provider });

      // Insert new models
      const modelDocs = models.map((model) => ({
        provider,
        modelId: model.id,
        modelName: model.name,
        description: model.description,
        contextWindow: model.context_window,
        pricing: model.pricing,
        capabilities: model.capabilities,
        isAvailable: true,
        cachedAt: new Date(),
        ttl,
      }));

      await AIModel.insertMany(modelDocs);
      logger.info(`Cached ${models.length} models for ${provider}`);
    } catch (error) {
      logger.error('Error caching models:', error);
    }
  }

  async invalidateCache(provider: string): Promise<void> {
    try {
      await AIModel.deleteMany({ provider });
      logger.info(`Invalidated cache for ${provider}`);
    } catch (error) {
      logger.error('Error invalidating cache:', error);
    }
  }

  async clearExpiredCache(): Promise<void> {
    try {
      const result = await AIModel.deleteMany({ ttl: { $lt: new Date() } });
      if (result.deletedCount > 0) {
        logger.info(`Cleared ${result.deletedCount} expired model entries`);
      }
    } catch (error) {
      logger.error('Error clearing expired cache:', error);
    }
  }
}
