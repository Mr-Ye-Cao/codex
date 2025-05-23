/**
 * Creative Director Agent
 * Plans detailed visualizations and animations for educational concepts
 */

import { BaseAgent } from './base-agent';

export interface DirectorInput {
  selectedIdeas: Array<{
    title: string;
    description: string;
    keyPoints: string[];
    estimatedDuration: number;
  }>;
  videoDuration: number;
  style?: 'minimalist' | '3blue1brown' | 'detailed' | 'playful';
}

export interface ScenePlan {
  sceneId: string;
  title: string;
  duration: number;
  startTime: number;
  endTime: number;
  description: string;
  visualElements: Array<{
    type: string;
    description: string;
    animation: string;
    timing: {
      appear: number;
      disappear?: number;
    };
  }>;
  cameraMovements?: Array<{
    type: 'pan' | 'zoom' | 'rotate' | 'static';
    description: string;
    startTime: number;
    endTime: number;
  }>;
  transitions: {
    in: string;
    out: string;
  };
  narrationCues: string[];
}

export interface DirectorOutput {
  scenePlans: ScenePlan[];
  overallStructure: {
    title: string;
    totalDuration: number;
    numberOfScenes: number;
    visualStyle: string;
    colorScheme: string[];
  };
  technicalRequirements: string[];
}

export class DirectorAgent extends BaseAgent {
  async execute(inputs: Record<string, any>): Promise<Record<string, any>> {
    const { selectedIdeas, videoDuration, style = '3blue1brown' } = inputs as DirectorInput;
    
    const outputs: DirectorOutput[] = [];
    
    // Process each selected idea
    for (const idea of selectedIdeas) {
      const scenePlans = await this.createScenePlans(idea, videoDuration, style);
      outputs.push(scenePlans);
      
      // Save individual scene plan
      await this.saveToFile(
        `direction/${this.sanitizeFilename(idea.title)}_scenes.json`,
        JSON.stringify(scenePlans, null, 2)
      );
    }
    
    return {
      scenePlans: outputs
    };
  }
  
  private async createScenePlans(
    idea: DirectorInput['selectedIdeas'][0],
    duration: number,
    style: string
  ): Promise<DirectorOutput> {
    const prompt = this.buildDirectionPrompt(idea, duration, style);
    const response = await this.sendMessage(prompt);
    
    try {
      const rawPlan = this.parseJSON(response.content);
      return this.formatScenePlans(rawPlan, idea.title);
    } catch (error) {
      console.error('Failed to parse direction response:', error);
      throw new Error('Failed to create scene plans');
    }
  }
  
  private buildDirectionPrompt(
    idea: DirectorInput['selectedIdeas'][0],
    duration: number,
    style: string
  ): string {
    return `Create a detailed scene-by-scene visualization plan for an educational video about:
Title: ${idea.title}
Description: ${idea.description}
Duration: ${duration} seconds
Visual Style: ${style}

Key points to cover:
${idea.keyPoints.map((point, i) => `${i + 1}. ${point}`).join('\n')}

Design Requirements:
1. Break down the video into logical scenes (aim for 3-7 scenes)
2. Each scene should flow naturally into the next
3. Use visual metaphors and analogies where appropriate
4. Include specific timing for all elements
5. Consider the pacing - build complexity gradually
6. Make abstract concepts concrete through visualization
7. Use color and motion to guide attention

For each scene, provide:
- Scene title and description
- Exact duration and timing
- Detailed visual elements with animations
- Camera movements (if any)
- Transition effects
- Narration cues

Return as JSON with this structure:
{
  "overallStructure": {
    "title": "Video title",
    "totalDuration": ${duration},
    "numberOfScenes": 4,
    "visualStyle": "Description of visual approach",
    "colorScheme": ["#color1", "#color2", "#color3"]
  },
  "scenes": [
    {
      "sceneId": "scene_1",
      "title": "Scene title",
      "duration": 10,
      "startTime": 0,
      "endTime": 10,
      "description": "What happens in this scene",
      "visualElements": [
        {
          "type": "text/shape/graph/equation/3d-object",
          "description": "Detailed description",
          "animation": "How it moves/changes",
          "timing": {
            "appear": 0.5,
            "disappear": 9.5
          }
        }
      ],
      "cameraMovements": [
        {
          "type": "zoom",
          "description": "Zoom into the equation",
          "startTime": 2,
          "endTime": 4
        }
      ],
      "transitions": {
        "in": "fade",
        "out": "morph"
      },
      "narrationCues": ["Opening statement", "Explain concept", "Transition to next"]
    }
  ],
  "technicalRequirements": ["List of special effects or complex animations needed"]
}`;
  }
  
  private formatScenePlans(rawPlan: any, title: string): DirectorOutput {
    const scenes = rawPlan.scenes || [];
    
    return {
      overallStructure: {
        title: rawPlan.overallStructure?.title || title,
        totalDuration: rawPlan.overallStructure?.totalDuration || 30,
        numberOfScenes: scenes.length,
        visualStyle: rawPlan.overallStructure?.visualStyle || 'minimalist',
        colorScheme: rawPlan.overallStructure?.colorScheme || ['#1f1f1f', '#ffffff', '#3b82f6']
      },
      scenePlans: scenes.map((scene: any) => this.formatScene(scene)),
      technicalRequirements: rawPlan.technicalRequirements || []
    };
  }
  
  private formatScene(scene: any): ScenePlan {
    return {
      sceneId: scene.sceneId || `scene_${Date.now()}`,
      title: scene.title || 'Untitled Scene',
      duration: scene.duration || 5,
      startTime: scene.startTime || 0,
      endTime: scene.endTime || scene.startTime + scene.duration,
      description: scene.description || '',
      visualElements: this.formatVisualElements(scene.visualElements || []),
      cameraMovements: scene.cameraMovements || [],
      transitions: {
        in: scene.transitions?.in || 'fade',
        out: scene.transitions?.out || 'fade'
      },
      narrationCues: scene.narrationCues || []
    };
  }
  
  private formatVisualElements(elements: any[]): ScenePlan['visualElements'] {
    return elements.map(element => ({
      type: element.type || 'shape',
      description: element.description || '',
      animation: element.animation || 'static',
      timing: {
        appear: element.timing?.appear || 0,
        disappear: element.timing?.disappear
      }
    }));
  }
  
  private sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  }
  
  /**
   * Refine scene plans based on feedback
   */
  async refineScenePlans(
    scenePlans: DirectorOutput,
    feedback: string
  ): Promise<DirectorOutput> {
    const prompt = `Based on this feedback: "${feedback}"

Refine the following scene plans:
${JSON.stringify(scenePlans, null, 2)}

Maintain the same JSON structure but improve the scenes according to the feedback.`;
    
    const response = await this.sendMessage(prompt);
    const refinedPlan = this.parseJSON(response.content);
    
    return this.formatScenePlans(refinedPlan, scenePlans.overallStructure.title);
  }
}