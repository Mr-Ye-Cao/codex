/**
 * Video Generation Pipeline - Main exports
 */

// Core types
export * from './types.js';

// Configuration management
export { VideoConfigManager, DEFAULT_VIDEO_CONFIG } from './config.js';

// Main pipeline
export { VideoGenerationPipeline } from './pipeline.js';

// Animation execution
export { type ExecutionResult, type AnimationExecutorOptions } from './animation-executor.js';

// Media processing
export { MediaProcessor, type TTSResult, type VideoAssemblyResult } from './media-processor.js';

// CLI interface
export { VideoPipelineCLI, type CLIOptions } from './cli.js';

// Utility functions
export { createVideoWorkspace, validateVideoEnvironment, getDefaultConfigPath } from './utils.js';

/**
 * Quick start function for creating a video generation pipeline
 */
import { VideoConfigManager } from './config.js';
import { VideoGenerationPipeline } from './pipeline.js';
import { MediaProcessor } from './media-processor.js';
import { validateVideoEnvironment } from './utils.js';

export async function createVideoPipeline(configPath?: string) {
  const configManager = new VideoConfigManager(configPath);
  const config = configManager.getConfig();
  
  // Validate environment
  const validation = await validateVideoEnvironment();
  if (!validation.isValid) {
    throw new Error(`Environment validation failed: ${validation.errors.join(', ')}`);
  }
  
  const pipeline = new VideoGenerationPipeline(configManager);
  const mediaProcessor = new MediaProcessor(config);
  
  return {
    pipeline,
    mediaProcessor,
    configManager,
    config,
  };
}

/**
 * Simple function to generate a single video
 */
export async function generateEducationalVideo(topic: string, options: {
  duration?: number;
  quality?: 'draft' | 'standard' | 'high' | 'ultra';
  models?: 'fast' | 'balanced' | 'quality' | 'experimental';
  configPath?: string;
} = {}) {
  const configManager = new VideoConfigManager(options.configPath);
  
  // Apply options
  if (options.duration) {
    configManager.setVideoDuration(options.duration);
  }
  
  if (options.quality) {
    configManager.setQualityPreset(options.quality);
  }
  
  if (options.models) {
    configManager.setModelPreset(options.models);
  }
  
  const { pipeline } = await createVideoPipeline();
  
  // Generate topics
  const topicsResult = await pipeline.generateTopics(topic, 1);
  if (!topicsResult.success || !topicsResult.data || topicsResult.data.length === 0) {
    throw new Error(`Failed to generate topics: ${topicsResult.error}`);
  }
  
  const firstTopic = topicsResult.data[0];
  if (!firstTopic) {
    throw new Error('No topics generated');
  }
  
  // Generate video
  const result = await pipeline.generateVideos([firstTopic]);
  if (!result.success || result.videos.length === 0) {
    throw new Error(`Failed to generate video: ${result.errors?.join(', ')}`);
  }
  
  return result.videos[0];
}