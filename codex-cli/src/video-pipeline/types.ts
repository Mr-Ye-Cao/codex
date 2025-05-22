/**
 * Core types for the video generation pipeline
 */

export interface VideoGenerationConfig {
  // Pipeline settings
  pipeline: {
    maxRetries: number;
    timeout: number;
    parallelExecution: boolean;
    defaultVideoDuration: number; // seconds
    workingDirectory: string;
  };

  // Agent configurations
  agents: {
    topicGenerator: AgentConfig;
    director: AgentConfig;
    animator: AgentConfig;
    voiceScript: AgentConfig;
  };

  // Animation framework settings
  animation: {
    framework: 'manim' | 'threejs' | 'both';
    mananimPath?: string;
    outputFormat: 'mp4' | 'webm' | 'mov';
    resolution: '720p' | '1080p' | '4k';
    fps: number;
  };

  // TTS settings
  tts: {
    provider: 'openai' | 'elevenlabs' | 'azure';
    voice: string;
    speed: number;
  };

  // Future extensibility
  extensions?: {
    critiqueAgent?: AgentConfig;
    qualityAssurance?: AgentConfig;
    customTools?: string[];
  };
}

export interface AgentConfig {
  model: string;
  provider: string;
  temperature?: number;
  instructions?: string;
  tools?: string[];
  maxTokens?: number;
}

export interface VideoTopic {
  id: string;
  title: string;
  description: string;
  complexity: 'beginner' | 'intermediate' | 'advanced';
  estimatedDuration: number;
  keywords: string[];
}

export interface DirectorPlan {
  topicId: string;
  overview: string;
  scenes: Scene[];
  visualStyle: string;
  pacing: 'slow' | 'medium' | 'fast';
  targetAudience: string;
}

export interface Scene {
  id: string;
  duration: number; // seconds
  description: string;
  visualElements: string[];
  transitions: string[];
  voiceoverText?: string;
}

export interface AnimationCode {
  sceneId: string;
  framework: 'manim' | 'threejs';
  code: string;
  dependencies: string[];
  outputPath: string;
}

export interface VoiceScript {
  scenes: VoiceScriptScene[];
  totalDuration: number;
  style: 'educational' | 'casual' | 'formal';
}

export interface VoiceScriptScene {
  sceneId: string;
  text: string;
  timing: {
    start: number;
    end: number;
  };
  emphasis?: string[];
  pauses?: number[];
}

export interface GeneratedVideo {
  id: string;
  topicId: string;
  videoPath: string;
  audioPath: string;
  finalPath: string;
  metadata: {
    duration: number;
    resolution: string;
    framework: string;
    generatedAt: Date;
    models: Record<string, string>;
  };
}

export interface PipelineResult {
  success: boolean;
  videos: GeneratedVideo[];
  errors?: string[];
  metrics: {
    totalDuration: number;
    agentExecutionTimes: Record<string, number>;
    totalCost?: number;
  };
}

// Agent communication types
export interface AgentMessage {
  id: string;
  agentType: 'topic' | 'director' | 'animator' | 'voice';
  content: any;
  timestamp: Date;
  responseId?: string;
}

export interface AgentResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    model: string;
    duration: number;
    tokensUsed?: number;
  };
}