/**
 * Main orchestrator for the video generation pipeline
 * Coordinates all agents and manages the workflow
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { PipelineConfig, WorkflowState, AgentConfig } from '../config/types';
import { ConfigLoader } from '../config/loader';
import { BaseAgent } from '../agents/base-agent';
import { IdeationAgent } from '../agents/ideation-agent';
import { DirectorAgent } from '../agents/director-agent';
import { CodingAgent } from '../agents/coding-agent';
import { VoiceAgent } from '../agents/voice-agent';
import { createTTSService } from '../utils/tts';
import { createVideoAssembler } from '../utils/video-assembly';
import { ExecEnv } from '../../../../codex-rs/core/src/exec_env';

export interface OrchestratorOptions {
  configPath?: string;
  workingDir?: string;
  execEnv?: ExecEnv;
  interactive?: boolean;
}

export interface StageResult {
  stageId: string;
  success: boolean;
  outputs?: Record<string, any>;
  error?: string;
  duration: number;
}

export class VideoGenerationOrchestrator extends EventEmitter {
  private config: PipelineConfig;
  private workingDir: string;
  private agents: Map<string, BaseAgent> = new Map();
  private state: WorkflowState;
  private execEnv?: ExecEnv;
  private interactive: boolean;
  
  constructor(options: OrchestratorOptions = {}) {
    super();
    
    // Load configuration
    const configLoader = new ConfigLoader(options.configPath);
    this.config = configLoader.getConfig();
    
    // Validate configuration
    const validation = configLoader.validate();
    if (!validation.valid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }
    
    // Set up working directory
    this.workingDir = options.workingDir || path.join(process.cwd(), 'video-generation-output');
    if (!fs.existsSync(this.workingDir)) {
      fs.mkdirSync(this.workingDir, { recursive: true });
    }
    
    this.execEnv = options.execEnv;
    this.interactive = options.interactive || false;
    
    // Initialize workflow state
    this.state = {
      pipelineId: this.config.id,
      currentStage: '',
      topic: '',
      stageOutputs: {},
      errors: [],
      startTime: new Date(),
      status: 'running'
    };
    
    // Initialize agents
    this.initializeAgents();
  }
  
  /**
   * Initialize all agents based on configuration
   */
  private initializeAgents(): void {
    for (const agentConfig of this.config.agents) {
      const agent = this.createAgent(agentConfig);
      if (agent) {
        this.agents.set(agentConfig.id, agent);
      }
    }
  }
  
  /**
   * Create an agent instance based on configuration
   */
  private createAgent(config: AgentConfig): BaseAgent | null {
    const agentDir = path.join(this.workingDir, config.id);
    if (!fs.existsSync(agentDir)) {
      fs.mkdirSync(agentDir, { recursive: true });
    }
    
    switch (config.id) {
      case 'ideation-agent':
        return new IdeationAgent(config, agentDir);
      case 'director-agent':
        return new DirectorAgent(config, agentDir);
      case 'coding-agent':
        return new CodingAgent(config, agentDir, this.execEnv!);
      case 'voice-agent':
        return new VoiceAgent(config, agentDir);
      default:
        console.warn(`Unknown agent type: ${config.id}`);
        return null;
    }
  }
  
  /**
   * Run the complete video generation pipeline
   */
  async run(topic: string): Promise<WorkflowState> {
    this.state.topic = topic;
    this.emit('pipeline:start', { topic, config: this.config });
    
    try {
      // Stage 1: Ideation
      const ideationResult = await this.runStage('ideation', { topic });
      if (!ideationResult.success) {
        throw new Error('Ideation failed');
      }
      
      // Interactive selection of ideas
      const selectedIdeas = await this.selectIdeas(ideationResult.outputs!.ideas);
      
      // Stage 2: Direction - process each selected idea
      const directionResults = [];
      for (const idea of selectedIdeas) {
        const directionResult = await this.runStage('direction', {
          selectedIdeas: [idea],
          videoDuration: this.config.video.duration
        });
        if (directionResult.success) {
          directionResults.push(directionResult.outputs!.scenePlans[0]);
        }
      }
      
      // Process each video plan
      const finalVideos = [];
      for (let i = 0; i < directionResults.length; i++) {
        const scenePlans = directionResults[i];
        const videoResult = await this.processVideo(scenePlans, i);
        if (videoResult) {
          finalVideos.push(videoResult);
        }
      }
      
      // Update final state
      this.state.endTime = new Date();
      this.state.status = finalVideos.length > 0 ? 'completed' : 'failed';
      this.state.stageOutputs.finalVideos = finalVideos;
      
      this.emit('pipeline:complete', {
        state: this.state,
        videos: finalVideos
      });
      
      // Save workflow state
      await this.saveState();
      
    } catch (error: any) {
      this.state.status = 'failed';
      this.state.errors.push({
        stage: this.state.currentStage,
        error: error.message,
        timestamp: new Date()
      });
      this.emit('pipeline:error', error);
      await this.saveState();
    }
    
    return this.state;
  }
  
  /**
   * Process a single video from scene plans to final output
   */
  private async processVideo(scenePlans: any, index: number): Promise<any> {
    try {
      // Stage 3: Animation coding
      const animationResult = await this.runStage('animation', {
        scenePlans,
        framework: this.config.animationFramework.name,
        outputFormat: this.config.animationFramework.outputFormat,
        fps: this.config.video.fps,
        resolution: this.config.video.resolution
      });
      
      if (!animationResult.success || !animationResult.outputs?.videoFile) {
        console.error('Animation generation failed');
        return null;
      }
      
      // Stage 4: Voice script
      const voiceResult = await this.runStage('voice-script', {
        scenePlans,
        animationCode: animationResult.outputs.animationCode
      });
      
      if (!voiceResult.success) {
        console.error('Voice script generation failed');
        return null;
      }
      
      // Stage 5: Voice synthesis
      const ttsResult = await this.runTTS(voiceResult.outputs!.voiceScript);
      
      if (!ttsResult.success || !ttsResult.outputs?.audioFile) {
        console.error('TTS generation failed');
        return null;
      }
      
      // Stage 6: Final assembly
      const assemblyResult = await this.assembleVideo(
        animationResult.outputs.videoFile,
        ttsResult.outputs.audioFile,
        `final_video_${index + 1}`
      );
      
      // Optional: Run critique
      if (this.config.enableCritique && assemblyResult.success) {
        await this.runCritique(assemblyResult.outputs!.finalVideo);
      }
      
      return assemblyResult.outputs;
      
    } catch (error: any) {
      console.error(`Error processing video ${index + 1}:`, error);
      return null;
    }
  }
  
  /**
   * Run a specific pipeline stage
   */
  private async runStage(stageId: string, inputs: Record<string, any>): Promise<StageResult> {
    const stage = this.config.stages.find(s => s.id === stageId);
    if (!stage) {
      throw new Error(`Stage not found: ${stageId}`);
    }
    
    this.state.currentStage = stageId;
    this.emit('stage:start', { stage, inputs });
    
    const startTime = Date.now();
    
    try {
      let outputs: Record<string, any> = {};
      
      if (stage.agent !== 'none') {
        const agent = this.agents.get(stage.agent);
        if (!agent) {
          throw new Error(`Agent not found: ${stage.agent}`);
        }
        
        outputs = await agent.execute(inputs);
      }
      
      // Store outputs in state
      this.state.stageOutputs[stageId] = outputs;
      
      const result: StageResult = {
        stageId,
        success: true,
        outputs,
        duration: Date.now() - startTime
      };
      
      this.emit('stage:complete', result);
      return result;
      
    } catch (error: any) {
      const result: StageResult = {
        stageId,
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };
      
      this.state.errors.push({
        stage: stageId,
        error: error.message,
        timestamp: new Date()
      });
      
      this.emit('stage:error', result);
      
      if (stage.retryOnFailure && stage.agent !== 'none') {
        console.log(`Retrying stage ${stageId}...`);
        return this.runStage(stageId, inputs);
      }
      
      return result;
    }
  }
  
  /**
   * Interactive selection of ideas
   */
  private async selectIdeas(ideas: any[]): Promise<any[]> {
    if (!this.interactive) {
      // In non-interactive mode, select first 3 ideas
      return ideas.slice(0, 3);
    }
    
    // Display ideas
    console.log('\nGenerated Ideas:');
    ideas.forEach((idea, index) => {
      console.log(`\n${index + 1}. ${idea.title}`);
      console.log(`   ${idea.description}`);
      console.log(`   Duration: ${idea.estimatedDuration}s | Difficulty: ${idea.difficulty}`);
    });
    
    // In a real implementation, this would use the CLI input system
    // For now, we'll simulate selection
    console.log('\nPlease select ideas (e.g., "1,3,5" or "all"):');
    
    // Simulated selection - in production, this would read from user input
    const selectedIndices = [0, 2]; // Select first and third ideas
    
    return selectedIndices.map(i => ideas[i]).filter(Boolean);
  }
  
  /**
   * Run TTS generation
   */
  private async runTTS(voiceScript: any): Promise<StageResult> {
    const stageId = 'voice-synthesis';
    this.emit('stage:start', { stage: { id: stageId }, inputs: { voiceScript } });
    
    const startTime = Date.now();
    
    try {
      const ttsService = createTTSService(this.workingDir);
      const result = await ttsService.generateAudio(voiceScript);
      
      const stageResult: StageResult = {
        stageId,
        success: true,
        outputs: {
          audioFile: result.combinedAudioFile
        },
        duration: Date.now() - startTime
      };
      
      this.emit('stage:complete', stageResult);
      return stageResult;
      
    } catch (error: any) {
      const stageResult: StageResult = {
        stageId,
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };
      
      this.emit('stage:error', stageResult);
      return stageResult;
    }
  }
  
  /**
   * Assemble final video
   */
  private async assembleVideo(
    videoPath: string,
    audioPath: string,
    outputName: string
  ): Promise<StageResult> {
    const stageId = 'final-assembly';
    this.emit('stage:start', { 
      stage: { id: stageId }, 
      inputs: { videoPath, audioPath } 
    });
    
    const startTime = Date.now();
    
    try {
      const assembler = createVideoAssembler(this.workingDir);
      const result = await assembler.assembleVideo(videoPath, audioPath, outputName);
      
      const stageResult: StageResult = {
        stageId,
        success: true,
        outputs: {
          finalVideo: result.finalVideo,
          metadata: result.metadata,
          duration: result.duration
        },
        duration: Date.now() - startTime
      };
      
      this.emit('stage:complete', stageResult);
      return stageResult;
      
    } catch (error: any) {
      const stageResult: StageResult = {
        stageId,
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };
      
      this.emit('stage:error', stageResult);
      return stageResult;
    }
  }
  
  /**
   * Run critique on final video
   */
  private async runCritique(videoPath: string): Promise<void> {
    if (!this.config.critiqueAgent) return;
    
    const critiqueAgent = this.agents.get(this.config.critiqueAgent);
    if (!critiqueAgent) return;
    
    try {
      const critique = await critiqueAgent.execute({
        videoPath,
        scenePlans: this.state.stageOutputs.direction,
        voiceScript: this.state.stageOutputs['voice-script']
      });
      
      this.state.stageOutputs.critique = critique;
      this.emit('critique:complete', critique);
      
    } catch (error) {
      console.error('Critique failed:', error);
    }
  }
  
  /**
   * Save workflow state to file
   */
  private async saveState(): Promise<void> {
    const statePath = path.join(this.workingDir, 'workflow_state.json');
    fs.writeFileSync(statePath, JSON.stringify(this.state, null, 2));
  }
  
  /**
   * Get current workflow state
   */
  getState(): WorkflowState {
    return this.state;
  }
  
  /**
   * Get configuration
   */
  getConfig(): PipelineConfig {
    return this.config;
  }
}

/**
 * Create and run a video generation pipeline
 */
export async function runVideoPipeline(
  topic: string,
  options?: OrchestratorOptions
): Promise<WorkflowState> {
  const orchestrator = new VideoGenerationOrchestrator(options);
  
  // Set up event listeners for progress tracking
  orchestrator.on('stage:start', ({ stage }) => {
    console.log(`\n🎬 Starting stage: ${stage.name || stage.id}`);
  });
  
  orchestrator.on('stage:complete', ({ stageId, duration }) => {
    console.log(`✅ Completed ${stageId} in ${(duration / 1000).toFixed(1)}s`);
  });
  
  orchestrator.on('stage:error', ({ stageId, error }) => {
    console.error(`❌ Error in ${stageId}: ${error}`);
  });
  
  orchestrator.on('pipeline:complete', ({ videos }) => {
    console.log(`\n🎉 Pipeline complete! Generated ${videos.length} video(s)`);
    videos.forEach((video: any, i: number) => {
      console.log(`  ${i + 1}. ${video.finalVideo}`);
    });
  });
  
  return await orchestrator.run(topic);
}