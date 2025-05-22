/**
 * Main video generation pipeline orchestrator
 */

import { AgentLoop } from '../utils/agent/agent-loop.js';
import { ReviewDecision } from '../utils/agent/review.js';
import { VideoGenerationConfig, VideoTopic, DirectorPlan, AnimationCode, VoiceScript, GeneratedVideo, PipelineResult, AgentResult } from './types.js';
import { VideoConfigManager } from './config.js';
import type { ResponseInputItem } from 'openai/resources/responses/responses.js';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

export class VideoGenerationPipeline {
  private config: VideoGenerationConfig;
  private agents: Map<string, AgentLoop>;
  private workingDirectory: string;
  private responseBuffer: Map<string, ResponseInputItem[]>;

  constructor(configManager: VideoConfigManager) {
    this.config = configManager.getConfig();
    this.workingDirectory = this.config.pipeline.workingDirectory;
    this.agents = new Map();
    this.responseBuffer = new Map();
    this.setupWorkingDirectory();
    this.initializeAgents();
  }

  private setupWorkingDirectory(): void {
    if (!existsSync(this.workingDirectory)) {
      mkdirSync(this.workingDirectory, { recursive: true });
    }
    
    // Create subdirectories
    const subdirs = ['topics', 'scripts', 'animations', 'audio', 'videos', 'temp'];
    subdirs.forEach(dir => {
      const path = join(this.workingDirectory, dir);
      if (!existsSync(path)) {
        mkdirSync(path, { recursive: true });
      }
    });
  }

  private initializeAgents(): void {
    Object.entries(this.config.agents).forEach(([agentType, agentConfig]) => {
      const agentLoop = new AgentLoop({
        model: agentConfig.model,
        provider: agentConfig.provider,
        instructions: agentConfig.instructions || '',
        approvalPolicy: 'full-auto',
        disableResponseStorage: true, // We manage our own conversation history
        onItem: (item) => this.handleAgentOutput(agentType, item),
        onLoading: (loading) => console.log(`[${agentType}] Loading: ${loading}`),
        additionalWritableRoots: [this.workingDirectory],
        getCommandConfirmation: () => Promise.resolve({ review: ReviewDecision.YES }), // Auto-approve for pipeline
        onLastResponseId: (responseId) => console.log(`[${agentType}] Response ID: ${responseId}`),
      });
      
      this.agents.set(agentType, agentLoop);
    });
  }

  private handleAgentOutput(agentType: string, item: ResponseInputItem): void {
    // Handle real-time agent outputs (streaming, progress updates, etc.)
    console.log(`[${agentType}]:`, item);
    
    // Buffer the response items for processing
    if (!this.responseBuffer.has(agentType)) {
      this.responseBuffer.set(agentType, []);
    }
    this.responseBuffer.get(agentType)!.push(item);
  }

  /**
   * Generate educational video topics based on a general theme
   */
  async generateTopics(theme: string, count: number = 5): Promise<AgentResult<VideoTopic[]>> {
    const topicAgent = this.agents.get('topicGenerator');
    if (!topicAgent) {
      return { success: false, error: 'Topic generator agent not initialized' };
    }

    const prompt = `Generate ${count} educational video topics related to "${theme}". Each topic should be:
- Novel and engaging for a general audience
- Suitable for ${this.config.pipeline.defaultVideoDuration}-second video explanation
- Visually representable with animations
- Scientifically accurate and educational

For each topic, provide:
1. Title (concise and engaging)
2. Description (2-3 sentences explaining the concept)
3. Complexity level (beginner/intermediate/advanced)
4. Estimated duration for full explanation
5. Key visual elements that could be animated

Return the response as a JSON array of topics with this structure:
{
  "topics": [
    {
      "id": "unique-id",
      "title": "Topic Title",
      "description": "Detailed description...",
      "complexity": "beginner|intermediate|advanced",
      "estimatedDuration": 30,
      "keywords": ["keyword1", "keyword2"]
    }
  ]
}`;

    try {
      const startTime = Date.now();
      
      // Clear previous responses for this agent
      this.responseBuffer.set('topicGenerator', []);
      
      await topicAgent.run([{
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: prompt }]
      }], undefined);

      // Wait a moment for all responses to arrive
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Extract JSON from buffered response
      const response = this.responseBuffer.get('topicGenerator') || [];
      console.log(`Debug: Got ${response.length} response items`);
      
      const responseText = this.extractTextFromResponse(response);
      console.log(`Debug: Extracted text (${responseText.length} chars):`, responseText.substring(0, 200));
      
      if (!responseText.trim()) {
        return { success: false, error: 'No response text received from topic generation agent' };
      }
      
      const parsedResponse = this.parseJSONResponse(responseText);
      
      if (!parsedResponse.success || !parsedResponse.data?.topics) {
        return { success: false, error: `Failed to parse topic generation response: ${parsedResponse.error || 'No topics found'}` };
      }

      // Add unique IDs if not present
      const topics: VideoTopic[] = parsedResponse.data.topics.map((topic: any) => ({
        ...topic,
        id: topic.id || uuidv4()
      }));

      // Save topics to working directory
      const topicsPath = join(this.workingDirectory, 'topics', `topics-${Date.now()}.json`);
      writeFileSync(topicsPath, JSON.stringify({ theme, topics }, null, 2));

      return {
        success: true,
        data: topics,
        metadata: {
          model: this.config.agents.topicGenerator.model,
          duration: Date.now() - startTime
        }
      };

    } catch (error) {
      return { 
        success: false, 
        error: `Topic generation failed: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }

  /**
   * Create a director's plan for visualizing a topic
   */
  async createDirectorPlan(topic: VideoTopic): Promise<AgentResult<DirectorPlan>> {
    const directorAgent = this.agents.get('director');
    if (!directorAgent) {
      return { success: false, error: 'Director agent not initialized' };
    }

    const prompt = `Create a detailed visual plan for an educational video about: "${topic.title}"

Topic Description: ${topic.description}
Target Duration: ${this.config.pipeline.defaultVideoDuration} seconds
Complexity: ${topic.complexity}

Your task is to break this concept into visual scenes that will be animated. Consider:
1. How to introduce the concept visually
2. What visual metaphors or analogies work best
3. How to build understanding progressively
4. What animations would be most effective
5. How to conclude with impact

Return a JSON response with this structure:
{
  "plan": {
    "topicId": "${topic.id}",
    "overview": "High-level creative vision...",
    "visualStyle": "Description of visual style...",
    "pacing": "slow|medium|fast",
    "targetAudience": "Description of target audience...",
    "scenes": [
      {
        "id": "scene-1",
        "duration": 8,
        "description": "What happens in this scene...",
        "visualElements": ["element1", "element2"],
        "transitions": ["transition descriptions"],
        "voiceoverText": "Approximate narration text..."
      }
    ]
  }
}

Make sure the total duration of all scenes equals approximately ${this.config.pipeline.defaultVideoDuration} seconds.`;

    try {
      const startTime = Date.now();
      
      // Clear previous responses for this agent
      this.responseBuffer.set('director', []);
      
      await directorAgent.run([{
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: prompt }]
      }], undefined);

      // Wait a moment for all responses to arrive
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Extract JSON from buffered response
      const response = this.responseBuffer.get('director') || [];
      const responseText = this.extractTextFromResponse(response);
      const parsedResponse = this.parseJSONResponse(responseText);
      
      if (!parsedResponse.success || !parsedResponse.data.plan) {
        return { success: false, error: 'Failed to parse director plan response' };
      }

      const plan: DirectorPlan = {
        ...parsedResponse.data.plan,
        scenes: parsedResponse.data.plan.scenes.map((scene: any) => ({
          ...scene,
          id: scene.id || uuidv4()
        }))
      };

      // Save plan to working directory
      const planPath = join(this.workingDirectory, 'scripts', `plan-${topic.id}.json`);
      writeFileSync(planPath, JSON.stringify(plan, null, 2));

      return {
        success: true,
        data: plan,
        metadata: {
          model: this.config.agents.director.model,
          duration: Date.now() - startTime
        }
      };

    } catch (error) {
      return { 
        success: false, 
        error: `Director planning failed: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }

  /**
   * Generate animation code for a scene using the coding agent
   */
  async generateAnimationCode(plan: DirectorPlan, sceneId: string): Promise<AgentResult<AnimationCode>> {
    const animatorAgent = this.agents.get('animator');
    if (!animatorAgent) {
      return { success: false, error: 'Animator agent not initialized' };
    }

    const scene = plan.scenes.find(s => s.id === sceneId);
    if (!scene) {
      return { success: false, error: `Scene ${sceneId} not found in plan` };
    }

    const framework = this.config.animation.framework === 'both' ? 'manim' : this.config.animation.framework;
    
    const prompt = `Generate ${framework} animation code for this scene:

Scene: ${scene.description}
Duration: ${scene.duration} seconds
Visual Elements: ${scene.visualElements.join(', ')}
Transitions: ${scene.transitions.join(', ')}
Resolution: ${this.config.animation.resolution}
FPS: ${this.config.animation.fps}

Requirements:
1. Create a complete, executable ${framework} script
2. Handle the exact duration specified
3. Include all visual elements mentioned
4. Ensure smooth transitions
5. Follow best practices for performance
6. Include error handling

${framework === 'manim' ? `
Use Manim's Scene class and create a scene named "Scene${sceneId.replace(/[^a-zA-Z0-9]/g, '')}".
Output should be a complete Python file that can be executed with: manim -pql scene.py Scene${sceneId.replace(/[^a-zA-Z0-9]/g, '')}
` : `
Create a complete Three.js scene with proper initialization, animation loop, and export functionality.
`}

Return the code in this JSON format:
{
  "code": {
    "sceneId": "${sceneId}",
    "framework": "${framework}",
    "code": "Complete code here...",
    "dependencies": ["list", "of", "dependencies"],
    "outputPath": "path/to/output/file"
  }
}`;

    try {
      const startTime = Date.now();
      
      // Create scene-specific working directory
      const sceneDir = join(this.workingDirectory, 'animations', sceneId);
      if (!existsSync(sceneDir)) {
        mkdirSync(sceneDir, { recursive: true });
      }

      // Clear previous responses for this agent
      this.responseBuffer.set('animator', []);
      
      await animatorAgent.run([{
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: prompt }]
      }], undefined);

      // Wait a moment for all responses to arrive
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Extract JSON from buffered response
      const response = this.responseBuffer.get('animator') || [];
      const responseText = this.extractTextFromResponse(response);
      const parsedResponse = this.parseJSONResponse(responseText);
      
      if (!parsedResponse.success || !parsedResponse.data.code) {
        return { success: false, error: 'Failed to parse animation code response' };
      }

      const animationCode: AnimationCode = parsedResponse.data.code;
      
      // Save code to file
      const codeFileName = framework === 'manim' ? 'scene.py' : 'scene.js';
      const codePath = join(sceneDir, codeFileName);
      writeFileSync(codePath, animationCode.code);

      // Update output path to actual file location
      animationCode.outputPath = join(sceneDir, 'output');
      if (!existsSync(animationCode.outputPath)) {
        mkdirSync(animationCode.outputPath, { recursive: true });
      }

      return {
        success: true,
        data: animationCode,
        metadata: {
          model: this.config.agents.animator.model,
          duration: Date.now() - startTime
        }
      };

    } catch (error) {
      return { 
        success: false, 
        error: `Animation code generation failed: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }

  /**
   * Generate voice script for the entire video
   */
  async generateVoiceScript(plan: DirectorPlan): Promise<AgentResult<VoiceScript>> {
    const voiceAgent = this.agents.get('voiceScript');
    if (!voiceAgent) {
      return { success: false, error: 'Voice script agent not initialized' };
    }

    const prompt = `Create a professional voice script for this educational video:

Video Overview: ${plan.overview}
Visual Style: ${plan.visualStyle}
Target Audience: ${plan.targetAudience}
Total Duration: ${this.config.pipeline.defaultVideoDuration} seconds

Scenes:
${plan.scenes.map((scene, index) => `
Scene ${index + 1} (${scene.duration}s): ${scene.description}
Visual Elements: ${scene.visualElements.join(', ')}
Suggested Voiceover: ${scene.voiceoverText || 'TBD'}
`).join('\n')}

Requirements:
1. Create engaging, educational narration
2. Time the script precisely to match scene durations
3. Use language appropriate for the target audience
4. Include natural pauses and emphasis
5. Ensure smooth transitions between scenes
6. Match the visual elements being shown

Return the script in this JSON format:
{
  "script": {
    "scenes": [
      {
        "sceneId": "scene-id",
        "text": "Narration text for this scene...",
        "timing": {
          "start": 0,
          "end": 8
        },
        "emphasis": ["important", "words"],
        "pauses": [2.5, 5.0]
      }
    ],
    "totalDuration": ${this.config.pipeline.defaultVideoDuration},
    "style": "educational"
  }
}`;

    try {
      const startTime = Date.now();
      
      // Clear previous responses for this agent
      this.responseBuffer.set('voiceScript', []);
      
      await voiceAgent.run([{
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: prompt }]
      }], undefined);

      // Wait a moment for all responses to arrive
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Extract JSON from buffered response
      const response = this.responseBuffer.get('voiceScript') || [];
      const responseText = this.extractTextFromResponse(response);
      const parsedResponse = this.parseJSONResponse(responseText);
      
      if (!parsedResponse.success || !parsedResponse.data.script) {
        return { success: false, error: 'Failed to parse voice script response' };
      }

      const voiceScript: VoiceScript = parsedResponse.data.script;
      
      // Save script to working directory
      const scriptPath = join(this.workingDirectory, 'scripts', `voice-script-${plan.topicId}.json`);
      writeFileSync(scriptPath, JSON.stringify(voiceScript, null, 2));

      return {
        success: true,
        data: voiceScript,
        metadata: {
          model: this.config.agents.voiceScript.model,
          duration: Date.now() - startTime
        }
      };

    } catch (error) {
      return { 
        success: false, 
        error: `Voice script generation failed: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }

  /**
   * Run the complete pipeline for selected topics
   */
  async generateVideos(topics: VideoTopic[]): Promise<PipelineResult> {
    const startTime = Date.now();
    const results: GeneratedVideo[] = [];
    const errors: string[] = [];
    const agentExecutionTimes: Record<string, number> = {};

    for (const topic of topics) {
      try {
        console.log(`\n🎬 Starting video generation for: ${topic.title}`);

        // Step 1: Create director plan
        console.log('📋 Creating director plan...');
        const planResult = await this.createDirectorPlan(topic);
        if (!planResult.success || !planResult.data) {
          errors.push(`Failed to create plan for ${topic.title}: ${planResult.error}`);
          continue;
        }
        agentExecutionTimes['director'] = (agentExecutionTimes['director'] || 0) + (planResult.metadata?.duration || 0);

        // Step 2: Generate animation code for each scene
        console.log('🎨 Generating animation code...');
        const animationCodes: AnimationCode[] = [];
        for (const scene of planResult.data.scenes) {
          const codeResult = await this.generateAnimationCode(planResult.data, scene.id);
          if (!codeResult.success || !codeResult.data) {
            errors.push(`Failed to generate animation for scene ${scene.id}: ${codeResult.error}`);
            continue;
          }
          animationCodes.push(codeResult.data);
          agentExecutionTimes['animator'] = (agentExecutionTimes['animator'] || 0) + (codeResult.metadata?.duration || 0);
        }

        // Step 2.5: Execute animation code to generate video files
        if (animationCodes.length > 0) {
          console.log('🎬 Executing animation code...');
          const { AnimationExecutor } = await import('./animation-executor.js');
          const animatorAgent = this.agents.get('animator');
          if (animatorAgent) {
            const executor = new AnimationExecutor(this.config, animatorAgent);
            
            for (const animationCode of animationCodes) {
              console.log(`   Rendering scene: ${animationCode.sceneId}`);
              const execResult = await executor.executeAnimation(animationCode);
              
              if (execResult.success) {
                console.log(`   ✅ Scene rendered: ${execResult.outputPath}`);
              } else {
                console.log(`   ❌ Scene failed: ${execResult.error}`);
                errors.push(`Failed to execute animation for scene ${animationCode.sceneId}: ${execResult.error}`);
              }
            }
          }
        }

        // Step 3: Generate voice script
        console.log('🎙️ Creating voice script...');
        const scriptResult = await this.generateVoiceScript(planResult.data);
        if (!scriptResult.success || !scriptResult.data) {
          errors.push(`Failed to generate voice script for ${topic.title}: ${scriptResult.error}`);
          continue;
        }
        agentExecutionTimes['voiceScript'] = (agentExecutionTimes['voiceScript'] || 0) + (scriptResult.metadata?.duration || 0);

        // TODO: Steps 4-6 will be implemented in the next phase:
        // - Execute animation code to generate video files
        // - Generate TTS audio
        // - Combine video and audio

        // For now, create a placeholder result
        const video: GeneratedVideo = {
          id: uuidv4(),
          topicId: topic.id,
          videoPath: join(this.workingDirectory, 'videos', `${topic.id}.mp4`),
          audioPath: join(this.workingDirectory, 'audio', `${topic.id}.mp3`),
          finalPath: join(this.workingDirectory, 'videos', `final-${topic.id}.mp4`),
          metadata: {
            duration: this.config.pipeline.defaultVideoDuration,
            resolution: this.config.animation.resolution,
            framework: this.config.animation.framework,
            generatedAt: new Date(),
            models: {
              director: this.config.agents.director.model,
              animator: this.config.agents.animator.model,
              voiceScript: this.config.agents.voiceScript.model,
            }
          }
        };

        results.push(video);
        console.log(`✅ Completed pipeline for: ${topic.title}`);

      } catch (error) {
        errors.push(`Unexpected error processing ${topic.title}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {
      success: errors.length < topics.length, // Success if at least one video was processed
      videos: results,
      errors: errors.length > 0 ? errors : undefined,
      metrics: {
        totalDuration: Date.now() - startTime,
        agentExecutionTimes,
      }
    };
  }

  private extractTextFromResponse(response: ResponseInputItem[]): string {
    return response
      .filter(item => item.type === 'message' && item.role === 'assistant')
      .flatMap(item => ('content' in item) ? (item.content || []) : [])
      .filter(content => content.type === 'output_text')
      .map(content => ('text' in content) ? content.text || '' : '')
      .join('');
  }

  private parseJSONResponse(text: string): { success: boolean; data: any; error?: string } {
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      const jsonText = jsonMatch ? (jsonMatch[1] || '') : text;
      
      const data = JSON.parse(jsonText);
      return { success: true, data };
    } catch (error) {
      return { 
        success: false, 
        data: null, 
        error: `JSON parsing failed: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }
}