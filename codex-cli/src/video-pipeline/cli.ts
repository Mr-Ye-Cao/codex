/**
 * CLI interface for video generation pipeline
 */

// CLI imports are handled by the main CLI using meow
import { VideoGenerationPipeline } from './pipeline.js';
import { VideoConfigManager } from './config.js';
import { VideoTopic, PipelineResult } from './types.js';
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import inquirer from 'inquirer';

export interface CLIOptions {
  config?: string;
  topic?: string;
  count?: number;
  duration?: number;
  quality?: 'draft' | 'standard' | 'high' | 'ultra';
  models?: 'fast' | 'balanced' | 'quality' | 'experimental';
  interactive?: boolean;
  output?: string;
}

export class VideoPipelineCLI {
  private configManager: VideoConfigManager;
  private pipeline: VideoGenerationPipeline;

  constructor(options: CLIOptions = {}) {
    this.configManager = new VideoConfigManager(options.config);
    
    // Apply CLI options to config
    if (options.duration) {
      this.configManager.setVideoDuration(options.duration);
    }
    
    if (options.quality) {
      this.configManager.setQualityPreset(options.quality);
    }
    
    if (options.models) {
      this.configManager.setModelPreset(options.models);
    }

    this.pipeline = new VideoGenerationPipeline(this.configManager);
  }

  /**
   * Main CLI entry point
   */
  async run(topic: string, options: CLIOptions): Promise<void> {
    console.log('🎬 Video Generation Pipeline');
    console.log('============================\n');

    try {
      // Validate configuration
      const validation = this.configManager.validateConfig();
      if (!validation.isValid) {
        console.error('❌ Configuration validation failed:');
        validation.errors.forEach(error => console.error(`  - ${error}`));
        process.exit(1);
      }

      if (options.interactive) {
        await this.runInteractiveMode(topic);
      } else {
        await this.runDirectMode(topic, options);
      }

    } catch (error) {
      console.error('💥 Pipeline failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  private async runInteractiveMode(initialTopic: string): Promise<void> {
    console.log('🤖 Interactive Mode\n');

    // Step 1: Get or confirm topic
    const topicAnswer = await inquirer.prompt([{
      type: 'input',
      name: 'topic',
      message: 'What educational topic would you like to create videos about?',
      default: initialTopic,
    }]);

    const topic = topicAnswer.topic;

    // Step 2: Generate topic ideas
    console.log(`\n🧠 Generating video ideas for "${topic}"...`);
    const topicsResult = await this.pipeline.generateTopics(topic, 5);
    
    if (!topicsResult.success || !topicsResult.data) {
      console.error('❌ Failed to generate topics:', topicsResult.error);
      return;
    }

    // Step 3: Let user select topics
    console.log('\n📋 Generated Topics:');
    topicsResult.data.forEach((t, index) => {
      console.log(`\n${index + 1}. ${t.title}`);
      console.log(`   ${t.description}`);
      console.log(`   Complexity: ${t.complexity} | Duration: ~${t.estimatedDuration}s`);
    });

    const selectionAnswer = await inquirer.prompt([{
      type: 'checkbox',
      name: 'selectedIndices',
      message: 'Select which topics to create videos for:',
      choices: topicsResult.data.map((t, index) => ({
        name: `${index + 1}. ${t.title}`,
        value: index,
        checked: false,
      })),
    }]);

    const selectedTopics = selectionAnswer.selectedIndices.map((index: number) => topicsResult.data![index]);

    if (selectedTopics.length === 0) {
      console.log('No topics selected. Exiting.');
      return;
    }

    // Step 4: Confirm generation
    const confirmAnswer = await inquirer.prompt([{
      type: 'confirm',
      name: 'proceed',
      message: `Generate ${selectedTopics.length} video(s)? This may take several minutes.`,
      default: true,
    }]);

    if (!confirmAnswer.proceed) {
      console.log('Generation cancelled.');
      return;
    }

    // Step 5: Generate videos
    await this.generateVideosWithProgress(selectedTopics);
  }

  private async runDirectMode(topic: string, options: CLIOptions): Promise<void> {
    console.log('⚡ Direct Mode\n');

    const count = options.count || 3;
    
    console.log(`🧠 Generating ${count} video ideas for "${topic}"...`);
    const topicsResult = await this.pipeline.generateTopics(topic, count);
    
    if (!topicsResult.success || !topicsResult.data) {
      console.error('❌ Failed to generate topics:', topicsResult.error);
      return;
    }

    console.log(`\n📋 Will generate videos for all ${topicsResult.data.length} topics:`);
    topicsResult.data.forEach((t, index) => {
      console.log(`${index + 1}. ${t.title}`);
    });

    await this.generateVideosWithProgress(topicsResult.data);
  }

  private async generateVideosWithProgress(topics: VideoTopic[]): Promise<void> {
    console.log(`\n🎬 Starting video generation for ${topics.length} topic(s)...\n`);

    const startTime = Date.now();
    const result = await this.pipeline.generateVideos(topics);

    console.log('\n' + '='.repeat(50));
    console.log('📊 GENERATION COMPLETE');
    console.log('='.repeat(50));

    if (result.success) {
      console.log(`✅ Successfully generated ${result.videos.length} video(s)`);
    } else {
      console.log(`⚠️  Partial success: ${result.videos.length} video(s) generated with some errors`);
    }

    console.log(`⏱️  Total time: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    
    // Show agent execution times
    if (Object.keys(result.metrics.agentExecutionTimes).length > 0) {
      console.log('\n🤖 Agent Performance:');
      Object.entries(result.metrics.agentExecutionTimes).forEach(([agent, time]) => {
        console.log(`  ${agent}: ${(time / 1000).toFixed(1)}s`);
      });
    }

    // Show generated videos
    if (result.videos.length > 0) {
      console.log('\n🎥 Generated Videos:');
      result.videos.forEach((video, index) => {
        console.log(`  ${index + 1}. ${video.finalPath}`);
        console.log(`     Topic: ${topics.find(t => t.id === video.topicId)?.title}`);
        console.log(`     Duration: ${video.metadata.duration}s`);
        console.log(`     Framework: ${video.metadata.framework}`);
        console.log(`     Resolution: ${video.metadata.resolution}`);
      });
    }

    // Show errors
    if (result.errors && result.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    // Save results
    const resultsPath = join(this.configManager.getConfig().pipeline.workingDirectory, 'results', `results-${Date.now()}.json`);
    this.saveResults(result, resultsPath);
    console.log(`\n💾 Results saved to: ${resultsPath}`);
  }

  private saveResults(result: PipelineResult, path: string): void {
    try {
      const dir = join(path, '..');
      if (!existsSync(dir)) {
        require('fs').mkdirSync(dir, { recursive: true });
      }
      writeFileSync(path, JSON.stringify(result, null, 2));
    } catch (error) {
      console.warn('Failed to save results:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Show current configuration
   */
  showConfig(): void {
    const config = this.configManager.getConfig();
    
    console.log('🔧 Current Configuration');
    console.log('========================\n');
    
    console.log('Pipeline Settings:');
    console.log(`  Video Duration: ${config.pipeline.defaultVideoDuration}s`);
    console.log(`  Max Retries: ${config.pipeline.maxRetries}`);
    console.log(`  Working Directory: ${config.pipeline.workingDirectory}`);
    console.log(`  Parallel Execution: ${config.pipeline.parallelExecution ? 'Enabled' : 'Disabled'}\n`);
    
    console.log('Animation Settings:');
    console.log(`  Framework: ${config.animation.framework}`);
    console.log(`  Resolution: ${config.animation.resolution}`);
    console.log(`  FPS: ${config.animation.fps}`);
    console.log(`  Output Format: ${config.animation.outputFormat}\n`);
    
    console.log('Agent Models:');
    Object.entries(config.agents).forEach(([agent, config]) => {
      console.log(`  ${agent}: ${config.model} (${config.provider})`);
    });
    
    console.log(`\nTTS: ${config.tts.provider} (${config.tts.voice})`);
  }

  /**
   * List available presets
   */
  showPresets(): void {
    console.log('📋 Available Presets');
    console.log('====================\n');
    
    console.log('Quality Presets:');
    console.log('  draft    - 720p, 24fps, 15s videos (fast)');
    console.log('  standard - 1080p, 30fps, 30s videos (balanced)');
    console.log('  high     - 1080p, 60fps, 60s videos (quality)');
    console.log('  ultra    - 4K, 60fps, 120s videos (best)\n');
    
    console.log('Model Presets:');
    console.log('  fast         - GPT-4o-mini for most agents (fastest)');
    console.log('  balanced     - GPT-4o for all agents (recommended)');
    console.log('  quality      - o1-preview for creative agents (best quality)');
    console.log('  experimental - Claude 3.5 Sonnet for creative agents (alternative)');
  }
}

// CLI integration is handled directly in the main cli.tsx file