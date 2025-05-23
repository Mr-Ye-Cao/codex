/**
 * CLI interface for the video generation pipeline
 */

import { Command } from 'commander';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { runVideoPipeline, VideoGenerationOrchestrator } from './orchestrator';
import { ConfigLoader } from '../config/loader';
import { presets } from '../config/default';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt: string): Promise<string> => {
  return new Promise(resolve => {
    rl.question(prompt, resolve);
  });
};

/**
 * Interactive mode for video generation
 */
async function interactiveMode() {
  console.log('🎬 Educational Video Generation Pipeline');
  console.log('======================================\n');
  
  // Ask for topic
  const topic = await question('Enter a topic for educational videos (e.g., "black holes", "relativity"): ');
  
  if (!topic.trim()) {
    console.error('Topic cannot be empty');
    process.exit(1);
  }
  
  // Ask for configuration preferences
  console.log('\nConfiguration Options:');
  console.log('1. Quick Demo (15s, 720p)');
  console.log('2. Standard (30s, 1080p) [default]');
  console.log('3. Full Lecture (10min, 1080p)');
  console.log('4. Social Media (60s, vertical)');
  console.log('5. Custom');
  
  const configChoice = await question('\nSelect configuration (1-5) [2]: ') || '2';
  
  let options: any = {};
  
  switch (configChoice) {
    case '1':
      options.preset = 'quick-demo';
      break;
    case '3':
      options.preset = 'full-lecture';
      break;
    case '4':
      options.preset = 'social-media';
      break;
    case '5':
      const duration = await question('Video duration in seconds [30]: ');
      if (duration) {
        options.videoDuration = parseInt(duration);
      }
      break;
  }
  
  // Ask about output directory
  const outputDir = await question('\nOutput directory [./video-output]: ') || './video-output';
  options.workingDir = path.resolve(outputDir);
  
  console.log('\n🚀 Starting video generation pipeline...\n');
  
  rl.close();
  
  try {
    // Create orchestrator with interactive mode enabled
    const orchestrator = new VideoGenerationOrchestrator({
      ...options,
      interactive: true
    });
    
    // Apply preset if specified
    if (options.preset) {
      const configLoader = new ConfigLoader();
      configLoader.applyPreset(options.preset);
      if (options.videoDuration) {
        configLoader.setVideoDuration(options.videoDuration);
      }
    }
    
    const result = await orchestrator.run(topic);
    
    if (result.status === 'completed') {
      console.log('\n✨ Video generation completed successfully!');
      console.log(`Output directory: ${options.workingDir}`);
    } else {
      console.error('\n❌ Video generation failed');
      if (result.errors.length > 0) {
        console.error('Errors:');
        result.errors.forEach(err => {
          console.error(`  - ${err.stage}: ${err.error}`);
        });
      }
    }
  } catch (error: any) {
    console.error('\n❌ Pipeline error:', error.message);
    process.exit(1);
  }
}

/**
 * Create the CLI command
 */
export function createVideoCLI(): Command {
  const program = new Command();
  
  program
    .name('video-gen')
    .description('Generate educational videos using AI agents')
    .version('1.0.0');
  
  program
    .command('generate')
    .description('Generate educational videos on a topic')
    .argument('<topic>', 'Topic for the educational videos')
    .option('-c, --config <path>', 'Path to custom configuration file')
    .option('-o, --output <dir>', 'Output directory', './video-output')
    .option('-d, --duration <seconds>', 'Video duration in seconds', '30')
    .option('-p, --preset <name>', 'Use a preset configuration (quick-demo, full-lecture, social-media)')
    .option('--no-critique', 'Disable critique agent')
    .option('--models <json>', 'Override model configurations as JSON')
    .action(async (topic, options) => {
      try {
        const orchestratorOptions: any = {
          configPath: options.config,
          workingDir: path.resolve(options.output),
          interactive: false
        };
        
        // Create config loader
        const configLoader = new ConfigLoader(options.config);
        
        // Apply preset
        if (options.preset && presets[options.preset as keyof typeof presets]) {
          configLoader.applyPreset(options.preset as keyof typeof presets);
        }
        
        // Set duration
        if (options.duration) {
          configLoader.setVideoDuration(parseInt(options.duration));
        }
        
        // Disable critique if requested
        if (!options.critique) {
          configLoader.setCritique(false);
        }
        
        // Override models if specified
        if (options.models) {
          try {
            const modelOverrides = JSON.parse(options.models);
            for (const [agentId, modelConfig] of Object.entries(modelOverrides)) {
              configLoader.setAgentModel(agentId, modelConfig as any);
            }
          } catch (error) {
            console.error('Invalid model configuration JSON');
            process.exit(1);
          }
        }
        
        console.log(`🎬 Generating educational videos about: ${topic}`);
        console.log(`📁 Output directory: ${orchestratorOptions.workingDir}\n`);
        
        const result = await runVideoPipeline(topic, orchestratorOptions);
        
        if (result.status === 'completed') {
          console.log('\n✅ Success! Videos generated:');
          const videos = result.stageOutputs.finalVideos || [];
          videos.forEach((video: any, i: number) => {
            console.log(`  ${i + 1}. ${video.finalVideo}`);
          });
        } else {
          console.error('\n❌ Generation failed');
          process.exit(1);
        }
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });
  
  program
    .command('interactive')
    .description('Run in interactive mode')
    .action(interactiveMode);
  
  program
    .command('list-presets')
    .description('List available configuration presets')
    .action(() => {
      console.log('Available presets:\n');
      for (const [name, config] of Object.entries(presets)) {
        console.log(`${name}:`);
        console.log(`  Duration: ${config.video.duration}s`);
        console.log(`  Resolution: ${config.video.resolution.width}x${config.video.resolution.height}`);
        console.log(`  Quality: ${config.video.quality}\n`);
      }
    });
  
  program
    .command('validate-config')
    .description('Validate a configuration file')
    .argument('<config-file>', 'Path to configuration file')
    .action((configFile) => {
      try {
        const configLoader = new ConfigLoader(configFile);
        const validation = configLoader.validate();
        
        if (validation.valid) {
          console.log('✅ Configuration is valid');
        } else {
          console.error('❌ Configuration is invalid:');
          validation.errors.forEach(error => {
            console.error(`  - ${error}`);
          });
          process.exit(1);
        }
      } catch (error: any) {
        console.error('Error loading configuration:', error.message);
        process.exit(1);
      }
    });
  
  return program;
}

// Export for use in main CLI
export const videoCommand = createVideoCLI();