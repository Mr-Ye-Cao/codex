/**
 * Configuration management for video generation pipeline
 */

import { VideoGenerationConfig } from './types.js';
import { readFileSync, existsSync } from 'fs';

export const DEFAULT_VIDEO_CONFIG: VideoGenerationConfig = {
  pipeline: {
    maxRetries: 3,
    timeout: 300000, // 5 minutes
    parallelExecution: false,
    defaultVideoDuration: 30, // 30 seconds
    workingDirectory: './video-workspace',
  },

  agents: {
    topicGenerator: {
      model: 'gpt-4o',
      provider: 'openai',
      temperature: 0.8,
      instructions: `You are a creative educational content strategist. Generate engaging topics for educational videos that are:
- Novel and thought-provoking
- Suitable for visual explanation
- Scientifically accurate
- Engaging for general audiences
Focus on physics, mathematics, computer science, and related fields.`,
      tools: [],
      maxTokens: 2000,
    },

    director: {
      model: 'gpt-4o',
      provider: 'openai',
      temperature: 0.7,
      instructions: `You are a creative director for educational videos. Your job is to:
- Break down complex concepts into visual scenes
- Design engaging animations and transitions
- Create clear visual narratives
- Ensure educational value and entertainment
Think like a filmmaker who specializes in educational content.`,
      tools: [],
      maxTokens: 4000,
    },

    animator: {
      model: 'gpt-4o',
      provider: 'openai',
      temperature: 0.3,
      instructions: `You are an expert Manim programmer. Your job is to:
- Write clean, efficient Manim code
- Follow best practices and performance optimization
- Handle edge cases and error recovery
- Generate code that produces the exact visual described
- Iterate on code based on execution feedback
You must be precise and technical while ensuring the code actually runs.`,
      tools: ['bash', 'edit_file', 'read_file', 'create_file'],
      maxTokens: 6000,
    },

    voiceScript: {
      model: 'gpt-4o',
      provider: 'openai',
      temperature: 0.6,
      instructions: `You are a professional educational video scriptwriter. Create:
- Clear, engaging narration
- Proper timing with visual elements
- Educational but accessible language
- Smooth transitions between concepts
- Scripts that enhance visual understanding`,
      tools: [],
      maxTokens: 3000,
    },
  },

  animation: {
    framework: 'manim',
    outputFormat: 'mp4',
    resolution: '1080p',
    fps: 30,
  },

  tts: {
    provider: 'openai',
    voice: 'alloy',
    speed: 1.0,
  },
};

export class VideoConfigManager {
  private config: VideoGenerationConfig;

  constructor(configPath?: string) {
    this.config = this.loadConfig(configPath);
  }

  private loadConfig(configPath?: string): VideoGenerationConfig {
    if (configPath && existsSync(configPath)) {
      try {
        const configFile = readFileSync(configPath, 'utf-8');
        const userConfig = JSON.parse(configFile) as Partial<VideoGenerationConfig>;
        return this.mergeConfigs(DEFAULT_VIDEO_CONFIG, userConfig);
      } catch (error) {
        console.warn(`Failed to load config from ${configPath}, using defaults:`, error);
      }
    }
    return { ...DEFAULT_VIDEO_CONFIG };
  }

  private mergeConfigs(
    base: VideoGenerationConfig,
    override: Partial<VideoGenerationConfig>
  ): VideoGenerationConfig {
    return {
      pipeline: { ...base.pipeline, ...override.pipeline },
      agents: {
        topicGenerator: { ...base.agents.topicGenerator, ...override.agents?.topicGenerator },
        director: { ...base.agents.director, ...override.agents?.director },
        animator: { ...base.agents.animator, ...override.agents?.animator },
        voiceScript: { ...base.agents.voiceScript, ...override.agents?.voiceScript },
      },
      animation: { ...base.animation, ...override.animation },
      tts: { ...base.tts, ...override.tts },
      extensions: { ...base.extensions, ...override.extensions },
    };
  }

  getConfig(): VideoGenerationConfig {
    return this.config;
  }

  updateConfig(updates: Partial<VideoGenerationConfig>): void {
    this.config = this.mergeConfigs(this.config, updates);
  }

  // Convenience methods for common configuration changes
  setVideoDuration(duration: number): void {
    this.config.pipeline.defaultVideoDuration = duration;
  }

  setAnimationFramework(framework: 'manim' | 'threejs' | 'both'): void {
    this.config.animation.framework = framework;
  }

  setAgentModel(agentType: keyof VideoGenerationConfig['agents'], model: string, provider: string): void {
    this.config.agents[agentType].model = model;
    this.config.agents[agentType].provider = provider;
  }

  enableParallelExecution(enabled: boolean = true): void {
    this.config.pipeline.parallelExecution = enabled;
  }

  // Quality presets
  setQualityPreset(preset: 'draft' | 'standard' | 'high' | 'ultra'): void {
    const presets = {
      draft: { resolution: '720p' as const, fps: 24, videoDuration: 15 },
      standard: { resolution: '1080p' as const, fps: 30, videoDuration: 30 },
      high: { resolution: '1080p' as const, fps: 60, videoDuration: 60 },
      ultra: { resolution: '4k' as const, fps: 60, videoDuration: 120 },
    };

    const config = presets[preset];
    this.config.animation.resolution = config.resolution;
    this.config.animation.fps = config.fps;
    this.config.pipeline.defaultVideoDuration = config.videoDuration;
  }

  // Model presets for different use cases
  setModelPreset(preset: 'fast' | 'balanced' | 'quality' | 'experimental'): void {
    const presets = {
      fast: {
        topicGenerator: { model: 'gpt-4o-mini', provider: 'openai' },
        director: { model: 'gpt-4o-mini', provider: 'openai' },
        animator: { model: 'gpt-4o', provider: 'openai' },
        voiceScript: { model: 'gpt-4o-mini', provider: 'openai' },
      },
      balanced: {
        topicGenerator: { model: 'gpt-4o', provider: 'openai' },
        director: { model: 'gpt-4o', provider: 'openai' },
        animator: { model: 'gpt-4o', provider: 'openai' },
        voiceScript: { model: 'gpt-4o', provider: 'openai' },
      },
      quality: {
        topicGenerator: { model: 'o1-preview', provider: 'openai' },
        director: { model: 'o1-preview', provider: 'openai' },
        animator: { model: 'gpt-4o', provider: 'openai' },
        voiceScript: { model: 'gpt-4o', provider: 'openai' },
      },
      experimental: {
        topicGenerator: { model: 'claude-3-5-sonnet-20241022', provider: 'anthropic' },
        director: { model: 'claude-3-5-sonnet-20241022', provider: 'anthropic' },
        animator: { model: 'gpt-4o', provider: 'openai' },
        voiceScript: { model: 'claude-3-5-sonnet-20241022', provider: 'anthropic' },
      },
    };

    const modelConfig = presets[preset];
    Object.entries(modelConfig).forEach(([agentType, config]) => {
      this.setAgentModel(agentType as keyof VideoGenerationConfig['agents'], config.model, config.provider);
    });
  }

  // Export config for sharing or backup
  exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  // Validate configuration
  validateConfig(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate required fields
    if (!this.config.pipeline.workingDirectory) {
      errors.push('Working directory is required');
    }

    if (this.config.pipeline.defaultVideoDuration <= 0) {
      errors.push('Video duration must be positive');
    }

    // Validate agent configurations
    Object.entries(this.config.agents).forEach(([agentType, config]) => {
      if (!config.model || !config.provider) {
        errors.push(`Agent ${agentType} must have model and provider configured`);
      }
    });

    // Validate animation settings
    if (!['manim', 'threejs', 'both'].includes(this.config.animation.framework)) {
      errors.push('Invalid animation framework');
    }

    return { isValid: errors.length === 0, errors };
  }
}