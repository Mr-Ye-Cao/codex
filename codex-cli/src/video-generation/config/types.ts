/**
 * Configuration types for the educational video generation pipeline
 */

export interface ModelConfig {
  provider: 'openai' | 'anthropic' | 'google' | 'local';
  model: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
  baseUrl?: string;
}

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  model: ModelConfig;
  systemPrompt?: string;
  maxRetries?: number;
}

export interface VideoConfig {
  duration: number; // in seconds
  fps: number;
  resolution: {
    width: number;
    height: number;
  };
  quality: 'low' | 'medium' | 'high' | 'ultra';
}

export interface AnimationFramework {
  name: 'manim' | 'threejs' | 'p5js';
  version?: string;
  setupCommand?: string;
  runCommand: string;
  outputFormat: string;
}

export interface PipelineStage {
  id: string;
  name: string;
  agent: string; // agent id
  inputs: string[];
  outputs: string[];
  timeout?: number; // in seconds
  retryOnFailure?: boolean;
}

export interface PipelineConfig {
  id: string;
  name: string;
  description: string;
  stages: PipelineStage[];
  agents: AgentConfig[];
  video: VideoConfig;
  animationFramework: AnimationFramework;
  outputDir: string;
  enableCritique?: boolean;
  critiqueAgent?: string; // agent id for critique
}

export interface WorkflowState {
  pipelineId: string;
  currentStage: string;
  topic: string;
  ideas?: string[];
  selectedIdeas?: number[];
  stageOutputs: Record<string, any>;
  errors: Array<{
    stage: string;
    error: string;
    timestamp: Date;
  }>;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
}

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AgentResponse {
  content: string;
  metadata?: Record<string, any>;
  toolCalls?: Array<{
    name: string;
    arguments: Record<string, any>;
    result?: any;
  }>;
}