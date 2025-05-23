/**
 * Animation Coding Agent
 * Implements animations using Manim based on scene plans
 * Integrates with Codex's execution system for iterative development
 */

import { CodexIntegratedAgent } from './base-agent';
import { ScenePlan, DirectorOutput } from './director-agent';
import * as path from 'path';
import * as fs from 'fs';

export interface CodingInput {
  scenePlans: DirectorOutput;
  framework: 'manim' | 'threejs' | 'p5js';
  outputFormat: string;
  fps: number;
  resolution: {
    width: number;
    height: number;
  };
}

export interface CodingOutput {
  animationCode: string;
  codeFile: string;
  videoFile?: string;
  renderLog?: string;
  errors?: string[];
  iterations: number;
}

export class CodingAgent extends CodexIntegratedAgent {
  private maxIterations: number = 5;
  
  async execute(inputs: Record<string, any>): Promise<Record<string, any>> {
    const { scenePlans, framework = 'manim', outputFormat = 'mp4', fps = 60, resolution } = inputs as CodingInput;
    
    // For now, we'll focus on Manim implementation
    if (framework !== 'manim') {
      throw new Error(`Framework ${framework} not yet implemented`);
    }
    
    const result = await this.implementManimAnimation(scenePlans, fps, resolution);
    
    return result;
  }
  
  private async implementManimAnimation(
    directorOutput: DirectorOutput,
    fps: number,
    resolution: { width: number; height: number }
  ): Promise<CodingOutput> {
    let iterations = 0;
    let lastError: string | null = null;
    let animationCode = '';
    let codeFile = '';
    
    // First, ensure Manim is installed
    await this.ensureManimInstalled();
    
    while (iterations < this.maxIterations) {
      iterations++;
      
      try {
        // Generate or fix the animation code
        if (iterations === 1) {
          animationCode = await this.generateInitialCode(directorOutput);
        } else {
          animationCode = await this.fixCode(animationCode, lastError!);
        }
        
        // Save the code
        codeFile = await this.saveToFile(
          `animations/${this.sanitizeFilename(directorOutput.overallStructure.title)}.py`,
          animationCode
        );
        
        // Try to render the animation
        const renderResult = await this.renderAnimation(codeFile, fps, resolution);
        
        if (renderResult.success) {
          return {
            animationCode,
            codeFile,
            videoFile: renderResult.videoFile,
            renderLog: renderResult.log,
            iterations
          };
        } else {
          lastError = renderResult.error;
        }
      } catch (error: any) {
        lastError = error.message;
      }
    }
    
    // If we've exhausted iterations, return with errors
    return {
      animationCode,
      codeFile,
      errors: [lastError || 'Failed to generate working animation code'],
      iterations
    };
  }
  
  private async generateInitialCode(directorOutput: DirectorOutput): Promise<string> {
    const prompt = this.buildCodingPrompt(directorOutput);
    const response = await this.sendMessage(prompt);
    
    // Extract code from response
    const codeMatch = response.content.match(/```python\n([\s\S]*?)\n```/);
    if (codeMatch) {
      return codeMatch[1];
    }
    
    // If no code block found, assume entire response is code
    return response.content;
  }
  
  private buildCodingPrompt(directorOutput: DirectorOutput): string {
    const scenes = directorOutput.scenePlans;
    
    return `Create a Manim animation based on these scene plans:

Title: ${directorOutput.overallStructure.title}
Total Duration: ${directorOutput.overallStructure.totalDuration} seconds
Visual Style: ${directorOutput.overallStructure.visualStyle}
Color Scheme: ${directorOutput.overallStructure.colorScheme.join(', ')}

Scene Plans:
${scenes.map(scene => this.formatSceneForPrompt(scene)).join('\n\n')}

Technical Requirements:
${directorOutput.technicalRequirements.join('\n')}

Create a complete Manim script that:
1. Implements all scenes with proper timing
2. Uses smooth transitions between scenes
3. Follows Manim best practices
4. Includes proper imports and class structure
5. Handles all visual elements and animations
6. Uses the specified color scheme
7. Renders at ${directorOutput.overallStructure.totalDuration} seconds total

The main scene class should be named "EducationalVideo".

Return only the Python code, wrapped in \`\`\`python code blocks.`;
  }
  
  private formatSceneForPrompt(scene: ScenePlan): string {
    return `Scene: ${scene.title} (${scene.startTime}s - ${scene.endTime}s)
Description: ${scene.description}
Visual Elements:
${scene.visualElements.map(ve => 
  `  - ${ve.type}: ${ve.description} (appear at ${ve.timing.appear}s, ${ve.animation})`
).join('\n')}
${scene.cameraMovements && scene.cameraMovements.length > 0 ? 
  `Camera Movements:\n${scene.cameraMovements.map(cm => 
    `  - ${cm.type}: ${cm.description} (${cm.startTime}s - ${cm.endTime}s)`
  ).join('\n')}` : ''}
Transitions: In=${scene.transitions.in}, Out=${scene.transitions.out}`;
  }
  
  private async fixCode(previousCode: string, error: string): Promise<string> {
    const prompt = `The following Manim code has an error:

\`\`\`python
${previousCode}
\`\`\`

Error message:
${error}

Please fix the code to resolve this error. Make minimal changes and ensure the animation still matches the original requirements.

Return only the fixed Python code, wrapped in \`\`\`python code blocks.`;
    
    const response = await this.sendMessage(prompt);
    
    const codeMatch = response.content.match(/```python\n([\s\S]*?)\n```/);
    if (codeMatch) {
      return codeMatch[1];
    }
    
    return response.content;
  }
  
  private async ensureManimInstalled(): Promise<void> {
    try {
      await this.executeCommand('python -c "import manim"');
    } catch {
      console.log('Manim not found, installing...');
      await this.executeCommand('pip install manim');
    }
  }
  
  private async renderAnimation(
    codeFile: string,
    fps: number,
    resolution: { width: number; height: number }
  ): Promise<{ success: boolean; videoFile?: string; log?: string; error?: string }> {
    try {
      // Determine quality flag based on resolution
      let qualityFlag = '-qm'; // medium quality
      if (resolution.width >= 1920) {
        qualityFlag = '-qh'; // high quality
      } else if (resolution.width <= 854) {
        qualityFlag = '-ql'; // low quality
      }
      
      // Construct the manim command
      const outputDir = path.dirname(codeFile);
      const command = `cd ${outputDir} && manim render ${qualityFlag} --fps ${fps} -r ${resolution.width},${resolution.height} ${path.basename(codeFile)} EducationalVideo`;
      
      const output = await this.executeCommand(command);
      
      // Find the output video file
      const mediaDir = path.join(outputDir, 'media', 'videos', path.basename(codeFile, '.py'));
      const videoFiles = fs.readdirSync(mediaDir).filter(f => f.endsWith('.mp4'));
      
      if (videoFiles.length > 0) {
        const videoFile = path.join(mediaDir, videoFiles[0]);
        return {
          success: true,
          videoFile,
          log: output
        };
      } else {
        return {
          success: false,
          error: 'No video file generated',
          log: output
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  private sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  }
  
  /**
   * Generate code for a specific framework
   */
  async generateFrameworkCode(
    framework: 'manim' | 'threejs' | 'p5js',
    scenePlans: DirectorOutput
  ): Promise<string> {
    const frameworkPrompts = {
      manim: 'Create a Manim (Python) animation',
      threejs: 'Create a Three.js (JavaScript) animation',
      p5js: 'Create a p5.js (JavaScript) animation'
    };
    
    const prompt = `${frameworkPrompts[framework]} based on these scene plans:
${JSON.stringify(scenePlans, null, 2)}

Return only the code in the appropriate language.`;
    
    const response = await this.sendMessage(prompt);
    return response.content;
  }
}