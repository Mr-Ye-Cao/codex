/**
 * Video Generation Pipeline
 * Export main components for integration with Codex CLI
 */

// Configuration
export * from './config/types';
export { ConfigLoader, createConfigFromEnv } from './config/loader';
export { defaultPipelineConfig, presets } from './config/default';

// Agents
export { BaseAgent, CodexIntegratedAgent } from './agents/base-agent';
export { IdeationAgent } from './agents/ideation-agent';
export { DirectorAgent } from './agents/director-agent';
export { CodingAgent } from './agents/coding-agent';
export { VoiceAgent } from './agents/voice-agent';

// Utilities
export { TTSService, createTTSService } from './utils/tts';
export { VideoAssembler, createVideoAssembler } from './utils/video-assembly';

// Pipeline
export { 
  VideoGenerationOrchestrator, 
  runVideoPipeline,
  OrchestratorOptions,
  StageResult
} from './pipeline/orchestrator';

export { createVideoCLI, videoCommand } from './pipeline/cli';

// Main entry point for easy integration
export async function generateEducationalVideo(
  topic: string,
  options?: {
    config?: string;
    outputDir?: string;
    duration?: number;
    preset?: 'quick-demo' | 'full-lecture' | 'social-media';
    interactive?: boolean;
  }
): Promise<{ success: boolean; videos?: string[]; error?: string }> {
  try {
    const orchestratorOptions: any = {
      configPath: options?.config,
      workingDir: options?.outputDir || './video-output',
      interactive: options?.interactive || false
    };
    
    // Apply configuration overrides
    if (options?.preset || options?.duration) {
      const configLoader = new ConfigLoader(options?.config);
      
      if (options.preset) {
        configLoader.applyPreset(options.preset);
      }
      
      if (options.duration) {
        configLoader.setVideoDuration(options.duration);
      }
      
      // Save temporary config
      const tempConfigPath = `${orchestratorOptions.workingDir}/temp-config.json`;
      configLoader.save(tempConfigPath);
      orchestratorOptions.configPath = tempConfigPath;
    }
    
    const result = await runVideoPipeline(topic, orchestratorOptions);
    
    if (result.status === 'completed') {
      const videos = result.stageOutputs.finalVideos?.map((v: any) => v.finalVideo) || [];
      return { success: true, videos };
    } else {
      const errors = result.errors.map(e => `${e.stage}: ${e.error}`).join('; ');
      return { success: false, error: errors };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}