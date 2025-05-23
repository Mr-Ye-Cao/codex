#!/usr/bin/env ts-node

/**
 * Example script demonstrating the video generation pipeline
 */

import { generateEducationalVideo, VideoGenerationOrchestrator } from '../index';

async function simpleExample() {
  console.log('=== Simple Example: Generate a 30-second video about black holes ===\n');
  
  const result = await generateEducationalVideo('black holes', {
    duration: 30,
    outputDir: './example-output/simple'
  });
  
  if (result.success) {
    console.log('✅ Videos generated successfully!');
    result.videos?.forEach((video, i) => {
      console.log(`  ${i + 1}. ${video}`);
    });
  } else {
    console.error('❌ Generation failed:', result.error);
  }
}

async function advancedExample() {
  console.log('\n=== Advanced Example: Custom configuration with event monitoring ===\n');
  
  const orchestrator = new VideoGenerationOrchestrator({
    workingDir: './example-output/advanced',
    interactive: false
  });
  
  // Monitor events
  orchestrator.on('stage:start', ({ stage }) => {
    console.log(`🎬 Stage started: ${stage.name || stage.id}`);
  });
  
  orchestrator.on('stage:complete', ({ stageId, duration, outputs }) => {
    console.log(`✅ Stage completed: ${stageId} (${(duration/1000).toFixed(1)}s)`);
    if (outputs?.ideas) {
      console.log(`   Generated ${outputs.ideas.length} ideas`);
    }
  });
  
  orchestrator.on('stage:error', ({ stageId, error }) => {
    console.error(`❌ Stage error in ${stageId}: ${error}`);
  });
  
  // Run pipeline
  const result = await orchestrator.run('quantum entanglement');
  
  console.log('\n📊 Final Status:', result.status);
  console.log('⏱️  Total Time:', 
    ((result.endTime?.getTime() || 0) - result.startTime.getTime()) / 1000, 'seconds'
  );
}

async function batchExample() {
  console.log('\n=== Batch Example: Generate multiple videos ===\n');
  
  const topics = [
    'time dilation near black holes',
    'hawking radiation',
    'gravitational lensing'
  ];
  
  const results = await Promise.all(
    topics.map(topic => 
      generateEducationalVideo(topic, {
        duration: 15,
        preset: 'quick-demo',
        outputDir: `./example-output/batch/${topic.replace(/\s+/g, '-')}`
      })
    )
  );
  
  console.log('\n📊 Batch Results:');
  results.forEach((result, i) => {
    console.log(`${topics[i]}: ${result.success ? '✅ Success' : '❌ Failed'}`);
  });
}

// Main execution
async function main() {
  console.log('🎬 Educational Video Generation Pipeline - Examples\n');
  
  try {
    // Run simple example
    await simpleExample();
    
    // Run advanced example
    await advancedExample();
    
    // Run batch example
    await batchExample();
    
    console.log('\n✨ All examples completed!');
  } catch (error) {
    console.error('\n❌ Example failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { simpleExample, advancedExample, batchExample };