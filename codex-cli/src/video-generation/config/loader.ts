/**
 * Configuration loader for the video generation pipeline
 */

import * as fs from 'fs';
import * as path from 'path';
import { PipelineConfig, ModelConfig } from './types';
import { defaultPipelineConfig, presets } from './default';

export class ConfigLoader {
  private config: PipelineConfig;
  
  constructor(configPath?: string) {
    if (configPath && fs.existsSync(configPath)) {
      const customConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      this.config = this.mergeConfigs(defaultPipelineConfig, customConfig);
    } else {
      this.config = { ...defaultPipelineConfig };
    }
  }
  
  /**
   * Deep merge configurations, with custom config overriding defaults
   */
  private mergeConfigs(defaultConfig: any, customConfig: any): any {
    const result = { ...defaultConfig };
    
    for (const key in customConfig) {
      if (customConfig[key] === null || customConfig[key] === undefined) {
        continue;
      }
      
      if (typeof customConfig[key] === 'object' && !Array.isArray(customConfig[key])) {
        result[key] = this.mergeConfigs(defaultConfig[key] || {}, customConfig[key]);
      } else {
        result[key] = customConfig[key];
      }
    }
    
    return result;
  }
  
  /**
   * Apply a preset configuration
   */
  applyPreset(presetName: keyof typeof presets): ConfigLoader {
    const preset = presets[presetName];
    if (preset) {
      this.config = this.mergeConfigs(this.config, preset);
    }
    return this;
  }
  
  /**
   * Override specific configuration values
   */
  override(overrides: Partial<PipelineConfig>): ConfigLoader {
    this.config = this.mergeConfigs(this.config, overrides);
    return this;
  }
  
  /**
   * Set video duration
   */
  setVideoDuration(seconds: number): ConfigLoader {
    this.config.video.duration = seconds;
    return this;
  }
  
  /**
   * Set model for a specific agent
   */
  setAgentModel(agentId: string, model: Partial<ModelConfig>): ConfigLoader {
    const agent = this.config.agents.find(a => a.id === agentId);
    if (agent) {
      agent.model = { ...agent.model, ...model };
    }
    return this;
  }
  
  /**
   * Set animation framework
   */
  setAnimationFramework(framework: 'manim' | 'threejs' | 'p5js'): ConfigLoader {
    // Update framework configuration based on selection
    switch (framework) {
      case 'threejs':
        this.config.animationFramework = {
          name: 'threejs',
          setupCommand: 'npm install three @types/three',
          runCommand: 'node {input_file}',
          outputFormat: 'mp4'
        };
        break;
      case 'p5js':
        this.config.animationFramework = {
          name: 'p5js',
          setupCommand: 'npm install p5',
          runCommand: 'node {input_file}',
          outputFormat: 'mp4'
        };
        break;
      default:
        // Keep manim as default
        break;
    }
    return this;
  }
  
  /**
   * Enable or disable critique
   */
  setCritique(enabled: boolean): ConfigLoader {
    this.config.enableCritique = enabled;
    return this;
  }
  
  /**
   * Get the final configuration
   */
  getConfig(): PipelineConfig {
    return this.config;
  }
  
  /**
   * Save configuration to file
   */
  save(filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(this.config, null, 2));
  }
  
  /**
   * Validate configuration
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check that all agents referenced in stages exist
    for (const stage of this.config.stages) {
      if (stage.agent !== 'none' && !this.config.agents.find(a => a.id === stage.agent)) {
        errors.push(`Stage '${stage.id}' references non-existent agent '${stage.agent}'`);
      }
    }
    
    // Check video configuration
    if (this.config.video.duration <= 0) {
      errors.push('Video duration must be positive');
    }
    
    if (this.config.video.fps <= 0 || this.config.video.fps > 120) {
      errors.push('Video FPS must be between 1 and 120');
    }
    
    // Check that output directory is specified
    if (!this.config.outputDir) {
      errors.push('Output directory must be specified');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

/**
 * Helper function to create a configuration from environment variables
 */
export function createConfigFromEnv(): ConfigLoader {
  const loader = new ConfigLoader();
  
  // Override with environment variables if present
  if (process.env.VIDEO_DURATION) {
    loader.setVideoDuration(parseInt(process.env.VIDEO_DURATION));
  }
  
  if (process.env.VIDEO_PRESET) {
    loader.applyPreset(process.env.VIDEO_PRESET as keyof typeof presets);
  }
  
  if (process.env.OPENAI_API_KEY) {
    loader.config.agents.forEach(agent => {
      if (agent.model.provider === 'openai') {
        agent.model.apiKey = process.env.OPENAI_API_KEY;
      }
    });
  }
  
  if (process.env.ANTHROPIC_API_KEY) {
    loader.config.agents.forEach(agent => {
      if (agent.model.provider === 'anthropic') {
        agent.model.apiKey = process.env.ANTHROPIC_API_KEY;
      }
    });
  }
  
  return loader;
}