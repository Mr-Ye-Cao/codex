# Educational Video Generation Pipeline

An AI-powered multi-agent system for automatically generating educational videos with animations and narration, inspired by 3Blue1Brown's visual teaching style.

## Overview

This pipeline orchestrates multiple AI agents to create educational videos through the following workflow:

1. **Topic Ideation** - Generate novel educational topics
2. **Creative Direction** - Plan detailed visualizations
3. **Animation Coding** - Implement animations using Manim/Three.js
4. **Voice Script Writing** - Create synchronized narration
5. **Voice Synthesis** - Generate audio narration
6. **Video Assembly** - Combine animation and audio

## Key Features

- **Flexible Agent Configuration** - Easily swap models and providers for different agents
- **Multiple Animation Frameworks** - Support for Manim, Three.js, and p5.js
- **Customizable Video Parameters** - Duration, resolution, FPS, quality
- **Interactive Mode** - Select ideas and customize generation process
- **Critique System** - Optional quality review and feedback
- **Scalable Architecture** - Designed for increased compute and longer videos

## Installation

```bash
# Install dependencies
npm install

# Install Manim (Python)
pip install manim

# Install FFmpeg (required for video processing)
# macOS
brew install ffmpeg

# Linux
sudo apt-get install ffmpeg

# Install additional TTS dependencies (optional)
# For OpenAI TTS, set OPENAI_API_KEY environment variable
```

## Quick Start

### Command Line Interface

```bash
# Generate videos on a topic (non-interactive)
npm run video-gen generate "black holes" --duration 30 --preset standard

# Interactive mode
npm run video-gen interactive

# Use custom configuration
npm run video-gen generate "quantum mechanics" --config ./my-config.json

# List available presets
npm run video-gen list-presets
```

### Programmatic Usage

```typescript
import { generateEducationalVideo } from './video-generation';

// Simple usage
const result = await generateEducationalVideo('black holes', {
  duration: 30,
  preset: 'standard'
});

// Advanced usage with custom configuration
import { VideoGenerationOrchestrator } from './video-generation';

const orchestrator = new VideoGenerationOrchestrator({
  configPath: './custom-config.json',
  workingDir: './output',
  interactive: true
});

const state = await orchestrator.run('relativity');
```

## Configuration

### Default Configuration

The pipeline comes with sensible defaults for educational video generation. Key parameters:

- **Video Duration**: 30 seconds
- **Resolution**: 1920x1080 (Full HD)
- **FPS**: 60
- **Quality**: High

### Custom Configuration

Create a JSON configuration file to customize agents, models, and parameters:

```json
{
  "id": "my-pipeline",
  "name": "Custom Educational Pipeline",
  "agents": [
    {
      "id": "ideation-agent",
      "model": {
        "provider": "openai",
        "model": "gpt-4-turbo-preview",
        "temperature": 0.8
      }
    }
  ],
  "video": {
    "duration": 45,
    "fps": 30,
    "resolution": {
      "width": 1280,
      "height": 720
    }
  }
}
```

### Available Presets

- **quick-demo**: 15s, 720p, medium quality
- **standard**: 30s, 1080p, high quality (default)
- **full-lecture**: 10min, 1080p, ultra quality
- **social-media**: 60s, vertical (1080x1920), high quality

## Agents

### Ideation Agent
Generates creative educational topics based on user input. Focuses on topics with high visual potential.

### Director Agent
Plans scene-by-scene visualizations, including timing, transitions, and camera movements.

### Coding Agent
Implements animations using Manim or other frameworks. Iteratively debugs code until successful rendering.

### Voice Agent
Creates narration scripts synchronized with visual elements, considering pacing and audience.

### Critique Agent
Reviews generated videos and provides feedback for quality improvement.

## Animation Frameworks

### Manim (Default)
Mathematical animations library created by 3Blue1Brown.

```python
# Example Manim code generated
class EducationalVideo(Scene):
    def construct(self):
        circle = Circle()
        self.play(Create(circle))
        self.wait(2)
```

### Three.js
For 3D animations and WebGL effects.

### p5.js
For creative coding and interactive visualizations.

## Environment Variables

```bash
# API Keys
OPENAI_API_KEY=your-key
ANTHROPIC_API_KEY=your-key

# Pipeline Configuration
VIDEO_DURATION=30
VIDEO_PRESET=standard

# TTS Configuration
TTS_PROVIDER=openai  # or 'system'
TTS_VOICE=alloy      # OpenAI voice selection
```

## Output Structure

```
video-output/
├── ideation/
│   └── ideas.json
├── direction/
│   └── scene_plans.json
├── animations/
│   ├── video_code.py
│   └── media/
├── voice/
│   ├── script.json
│   └── script.txt
├── audio/
│   ├── seg_1.mp3
│   └── combined_narration.mp3
├── final_video_1.mp4
└── workflow_state.json
```

## Advanced Features

### Model Flexibility

Override models for specific agents:

```bash
npm run video-gen generate "topic" --models '{
  "ideation-agent": {"model": "gpt-4", "temperature": 0.9},
  "coding-agent": {"model": "claude-3-opus", "temperature": 0.2}
}'
```

### Scaling Considerations

The pipeline is designed with future scaling in mind:

1. **Compute Scaling**: Agents can leverage more powerful models and longer generation times
2. **Video Length**: Configuration supports arbitrary video durations
3. **Quality Scaling**: Higher resolutions and frame rates with more compute
4. **Parallel Processing**: Multiple videos can be generated concurrently

### Critique and Feedback Loop

Enable critique for quality improvement:

```json
{
  "enableCritique": true,
  "critiqueAgent": "critique-agent"
}
```

## Examples

See the `examples/` directory for configuration examples:

- `config-black-holes.json` - Optimized for physics/astronomy topics
- `config-threejs.json` - Three.js 3D animation configuration

## Troubleshooting

### Common Issues

1. **Manim not found**: Ensure Manim is installed: `pip install manim`
2. **FFmpeg errors**: Install FFmpeg for your platform
3. **API rate limits**: Configure retry logic in agent settings
4. **Memory issues**: Reduce video resolution or duration

### Debug Mode

Set environment variable for verbose logging:
```bash
DEBUG=video-gen:* npm run video-gen generate "topic"
```

## Future Enhancements

- [ ] Real-time preview during generation
- [ ] Web UI for visual pipeline management
- [ ] Support for more animation frameworks
- [ ] Distributed rendering for faster generation
- [ ] Fine-tuned models for specific educational domains
- [ ] Interactive elements in videos
- [ ] Multi-language support

## Contributing

This is an experimental project. Contributions and ideas are welcome!

## License

This project is part of the Codex ecosystem and follows the same licensing terms.