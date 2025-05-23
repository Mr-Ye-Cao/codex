# Integrating Video Generation with Codex CLI

This document shows how to integrate the video generation pipeline with the existing Codex CLI.

## Option 1: Add as a Subcommand to Main CLI

In `codex-cli/src/cli.tsx`, add the video generation command:

```typescript
import { videoCommand } from './video-generation/pipeline/cli';

// In the main CLI setup
program
  .addCommand(videoCommand)
  .description('Generate educational videos using AI agents');
```

Then users can run:
```bash
codex video-gen generate "black holes"
codex video-gen interactive
```

## Option 2: Slash Command Integration

Add a new slash command in `codex-cli/src/utils/slash-commands.ts`:

```typescript
{
  name: '/video',
  description: 'Generate an educational video on the current topic',
  handler: async (args: string[]) => {
    const topic = args.join(' ') || 'the current topic';
    const { generateEducationalVideo } = await import('./video-generation');
    
    const result = await generateEducationalVideo(topic, {
      duration: 30,
      outputDir: './video-output'
    });
    
    if (result.success) {
      return `Generated ${result.videos?.length} video(s) in ./video-output`;
    } else {
      return `Video generation failed: ${result.error}`;
    }
  }
}
```

## Option 3: Agent Tool Integration

Create a new tool for the Codex agent to generate videos:

```typescript
// In agent tools configuration
{
  name: 'generate_video',
  description: 'Generate an educational video with animations',
  parameters: {
    topic: { type: 'string', required: true },
    duration: { type: 'number', default: 30 },
    style: { type: 'string', enum: ['minimalist', '3blue1brown', 'detailed'] }
  },
  handler: async (params) => {
    const { generateEducationalVideo } = await import('./video-generation');
    return await generateEducationalVideo(params.topic, {
      duration: params.duration
    });
  }
}
```

## Option 4: Example Task Definition

Create a YAML task in `codex-cli/examples/educational-video/`:

```yaml
# task.yaml
name: Educational Video Generation
description: Generate an educational video with Manim animations
input_files: []
output_files:
  - video-output/final_video_1.mp4

instructions: |
  Generate an educational video about {topic} that:
  1. Uses Manim for mathematical animations
  2. Includes narration explaining the concepts
  3. Is approximately {duration} seconds long
  4. Follows 3Blue1Brown's visual style
  
  The video should be engaging and clearly explain the concept
  to a general audience with some mathematical background.

parameters:
  topic: "black holes and spacetime"
  duration: 30
```

## Environment Setup

Add to `.env` or environment configuration:

```bash
# Video Generation Settings
VIDEO_GEN_ENABLED=true
VIDEO_DEFAULT_DURATION=30
VIDEO_OUTPUT_DIR=./generated-videos

# Model Configuration for Video Agents
VIDEO_IDEATION_MODEL=gpt-4-turbo-preview
VIDEO_CODING_MODEL=gpt-4-turbo-preview
VIDEO_DIRECTOR_MODEL=claude-3-opus-20240229
```

## Usage Examples

### From within a Codex session:

```
User: Generate a video about quantum entanglement
Assistant: I'll generate an educational video about quantum entanglement for you.

[Uses the video generation pipeline to create the video]

I've successfully generated a 30-second educational video about quantum entanglement. 
The video includes:
- Visual animations showing entangled particles
- Clear narration explaining the concept
- Mathematical representations of quantum states

The video has been saved to: ./video-output/final_video_1.mp4
```

### Batch Processing:

```typescript
// Process multiple topics
const topics = [
  'special relativity',
  'quantum tunneling',
  'chaos theory'
];

for (const topic of topics) {
  await codexAgent.execute(`/video ${topic} --duration 45`);
}
```

## Best Practices

1. **Resource Management**: Video generation is compute-intensive. Consider:
   - Setting reasonable timeouts
   - Implementing queue management for multiple requests
   - Monitoring GPU/CPU usage

2. **Error Handling**: The pipeline may fail at various stages:
   - Model API rate limits
   - Manim rendering errors
   - FFmpeg processing issues

3. **Storage**: Generated videos can be large. Implement:
   - Automatic cleanup of old videos
   - Cloud storage integration
   - Compression options

4. **User Feedback**: Provide progress updates during generation:
   - Stage completion notifications
   - Estimated time remaining
   - Preview frames during rendering