/**
 * Default configuration for the educational video generation pipeline
 */

import { PipelineConfig } from './types';

export const defaultPipelineConfig: PipelineConfig = {
  id: 'educational-video-pipeline',
  name: 'Educational Video Generation Pipeline',
  description: 'Multi-agent pipeline for creating educational videos with animations and narration',
  
  agents: [
    {
      id: 'ideation-agent',
      name: 'Topic Ideation Agent',
      description: 'Generates novel and interesting educational topics',
      model: {
        provider: 'openai',
        model: 'gpt-4-turbo-preview',
        temperature: 0.8,
        maxTokens: 2000
      },
      systemPrompt: `You are an educational content expert specializing in creating engaging topics for visual learning. 
Your goal is to identify topics that:
1. Are intellectually stimulating and novel
2. Benefit greatly from visual animation
3. Can be explained clearly in the given time constraint
4. Appeal to curious learners

Focus on physics, mathematics, computer science, and natural phenomena.`
    },
    {
      id: 'director-agent',
      name: 'Creative Director Agent',
      description: 'Plans creative visualizations for educational concepts',
      model: {
        provider: 'anthropic',
        model: 'claude-3-opus-20240229',
        temperature: 0.7,
        maxTokens: 4000
      },
      systemPrompt: `You are a creative director for educational animations, inspired by 3Blue1Brown's visual style.
Your role is to:
1. Break down complex concepts into visual scenes
2. Design smooth transitions between ideas
3. Use visual metaphors and analogies effectively
4. Plan camera movements and object animations
5. Ensure visual clarity and pedagogical effectiveness

Provide detailed scene-by-scene breakdowns with timing.`
    },
    {
      id: 'coding-agent',
      name: 'Animation Coding Agent',
      description: 'Implements animations using Manim or other frameworks',
      model: {
        provider: 'openai',
        model: 'gpt-4-turbo-preview',
        temperature: 0.3,
        maxTokens: 8000
      },
      systemPrompt: `You are an expert programmer specializing in mathematical animations using Manim.
Your responsibilities:
1. Translate creative direction into working Manim code
2. Ensure smooth animations and proper timing
3. Debug and fix any rendering issues
4. Optimize for visual quality and performance
5. Follow Manim best practices and conventions

Always test your code and iterate until it renders successfully.`,
      maxRetries: 5
    },
    {
      id: 'voice-agent',
      name: 'Voice Script Agent',
      description: 'Creates narration scripts synchronized with animations',
      model: {
        provider: 'openai',
        model: 'gpt-4-turbo-preview',
        temperature: 0.6,
        maxTokens: 3000
      },
      systemPrompt: `You are a science communicator writing narration for educational animations.
Your script should:
1. Synchronize perfectly with the visual elements
2. Use clear, engaging language appropriate for the audience
3. Build understanding progressively
4. Include natural pauses for visual emphasis
5. Balance information density with comprehension

Provide timestamps for each narration segment.`
    },
    {
      id: 'critique-agent',
      name: 'Quality Critique Agent',
      description: 'Reviews and provides feedback on generated videos',
      model: {
        provider: 'anthropic',
        model: 'claude-3-sonnet-20240229',
        temperature: 0.4,
        maxTokens: 2000
      },
      systemPrompt: `You are an educational content reviewer providing constructive feedback.
Evaluate:
1. Visual clarity and effectiveness
2. Pedagogical value and accuracy
3. Pacing and information flow
4. Audio-visual synchronization
5. Overall engagement and quality

Provide specific, actionable feedback for improvement.`
    }
  ],
  
  stages: [
    {
      id: 'ideation',
      name: 'Topic Ideation',
      agent: 'ideation-agent',
      inputs: ['topic'],
      outputs: ['ideas'],
      timeout: 60
    },
    {
      id: 'direction',
      name: 'Creative Direction',
      agent: 'director-agent',
      inputs: ['selected_ideas'],
      outputs: ['scene_plans'],
      timeout: 120
    },
    {
      id: 'animation',
      name: 'Animation Coding',
      agent: 'coding-agent',
      inputs: ['scene_plans'],
      outputs: ['animation_code', 'video_file'],
      timeout: 600,
      retryOnFailure: true
    },
    {
      id: 'voice-script',
      name: 'Voice Script Writing',
      agent: 'voice-agent',
      inputs: ['scene_plans', 'animation_code'],
      outputs: ['voice_script'],
      timeout: 120
    },
    {
      id: 'voice-synthesis',
      name: 'Voice Synthesis',
      agent: 'none', // This will use TTS API directly
      inputs: ['voice_script'],
      outputs: ['audio_file'],
      timeout: 60
    },
    {
      id: 'final-assembly',
      name: 'Video Assembly',
      agent: 'none', // This will use FFmpeg directly
      inputs: ['video_file', 'audio_file'],
      outputs: ['final_video'],
      timeout: 120
    }
  ],
  
  video: {
    duration: 30, // 30 seconds by default
    fps: 60,
    resolution: {
      width: 1920,
      height: 1080
    },
    quality: 'high'
  },
  
  animationFramework: {
    name: 'manim',
    version: 'latest',
    setupCommand: 'pip install manim',
    runCommand: 'manim render -qh --fps {fps} {input_file} {scene_name}',
    outputFormat: 'mp4'
  },
  
  outputDir: './video-output',
  enableCritique: true,
  critiqueAgent: 'critique-agent'
};

// Preset configurations for different use cases
export const presets = {
  'quick-demo': {
    video: {
      duration: 15,
      fps: 30,
      resolution: { width: 1280, height: 720 },
      quality: 'medium'
    }
  },
  'full-lecture': {
    video: {
      duration: 600, // 10 minutes
      fps: 60,
      resolution: { width: 1920, height: 1080 },
      quality: 'ultra'
    }
  },
  'social-media': {
    video: {
      duration: 60,
      fps: 30,
      resolution: { width: 1080, height: 1920 }, // Vertical
      quality: 'high'
    }
  }
};