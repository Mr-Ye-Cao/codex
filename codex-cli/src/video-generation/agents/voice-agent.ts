/**
 * Voice Script Agent
 * Creates narration scripts synchronized with animations
 */

import { BaseAgent } from './base-agent';
import { DirectorOutput, ScenePlan } from './director-agent';

export interface VoiceInput {
  scenePlans: DirectorOutput;
  animationCode: string;
  targetAudience?: 'general' | 'student' | 'expert';
  tone?: 'educational' | 'conversational' | 'formal' | 'enthusiastic';
  pacingPreference?: 'slow' | 'moderate' | 'fast';
}

export interface VoiceSegment {
  segmentId: string;
  sceneId: string;
  text: string;
  startTime: number;
  endTime: number;
  duration: number;
  emphasis?: string[];
  pauseAfter?: number;
  emotion?: 'neutral' | 'excited' | 'thoughtful' | 'mysterious';
}

export interface VoiceOutput {
  script: VoiceSegment[];
  fullText: string;
  metadata: {
    totalWords: number;
    averageWordsPerSecond: number;
    totalDuration: number;
    suggestions: string[];
  };
}

export class VoiceAgent extends BaseAgent {
  async execute(inputs: Record<string, any>): Promise<Record<string, any>> {
    const {
      scenePlans,
      animationCode,
      targetAudience = 'general',
      tone = 'educational',
      pacingPreference = 'moderate'
    } = inputs as VoiceInput;
    
    const voiceScript = await this.generateVoiceScript(
      scenePlans,
      animationCode,
      targetAudience,
      tone,
      pacingPreference
    );
    
    // Save the script
    await this.saveToFile(
      `voice/${this.sanitizeFilename(scenePlans.overallStructure.title)}_script.json`,
      JSON.stringify(voiceScript, null, 2)
    );
    
    // Also save as plain text for easy reading
    await this.saveToFile(
      `voice/${this.sanitizeFilename(scenePlans.overallStructure.title)}_script.txt`,
      this.formatScriptAsText(voiceScript)
    );
    
    return {
      voiceScript
    };
  }
  
  private async generateVoiceScript(
    scenePlans: DirectorOutput,
    animationCode: string,
    targetAudience: string,
    tone: string,
    pacingPreference: string
  ): Promise<VoiceOutput> {
    const prompt = this.buildVoicePrompt(
      scenePlans,
      animationCode,
      targetAudience,
      tone,
      pacingPreference
    );
    
    const response = await this.sendMessage(prompt);
    
    try {
      const rawScript = this.parseJSON(response.content);
      return this.formatVoiceScript(rawScript, scenePlans.overallStructure.totalDuration);
    } catch (error) {
      console.error('Failed to parse voice script response:', error);
      throw new Error('Failed to generate voice script');
    }
  }
  
  private buildVoicePrompt(
    scenePlans: DirectorOutput,
    animationCode: string,
    targetAudience: string,
    tone: string,
    pacingPreference: string
  ): string {
    const wordsPerSecond = this.getWordsPerSecond(pacingPreference);
    
    return `Create a narration script for an educational video with these specifications:

Title: ${scenePlans.overallStructure.title}
Total Duration: ${scenePlans.overallStructure.totalDuration} seconds
Target Audience: ${targetAudience}
Tone: ${tone}
Pacing: ${pacingPreference} (aim for ~${wordsPerSecond} words per second)

Scene Details:
${scenePlans.scenePlans.map(scene => this.formatSceneForVoicePrompt(scene)).join('\n\n')}

Animation Code Reference:
\`\`\`python
${this.extractKeyMomentsFromCode(animationCode)}
\`\`\`

Guidelines:
1. Synchronize narration with visual elements appearing on screen
2. Use ${tone} language appropriate for ${targetAudience}
3. Include natural pauses during complex visual transitions
4. Build understanding progressively
5. Reference what's happening visually without being redundant
6. End each scene with a smooth transition to the next
7. Total word count should be approximately ${Math.floor(scenePlans.overallStructure.totalDuration * wordsPerSecond)}

Return the script as JSON with this structure:
{
  "segments": [
    {
      "segmentId": "seg_1",
      "sceneId": "scene_1",
      "text": "Narration text here",
      "startTime": 0,
      "endTime": 3.5,
      "emphasis": ["key", "words"],
      "pauseAfter": 0.5,
      "emotion": "neutral"
    }
  ],
  "metadata": {
    "totalWords": 150,
    "suggestions": ["Consider adding...", "The pacing at..."]
  }
}`;
  }
  
  private formatSceneForVoicePrompt(scene: ScenePlan): string {
    return `Scene: ${scene.title} (${scene.startTime}s - ${scene.endTime}s)
Description: ${scene.description}
Key Visual Moments:
${scene.visualElements.map(ve => 
  `  - At ${ve.timing.appear}s: ${ve.type} appears - ${ve.description}`
).join('\n')}
Narration Cues: ${scene.narrationCues.join(', ')}`;
  }
  
  private extractKeyMomentsFromCode(animationCode: string): string {
    // Extract key animation moments from the code
    // This is a simplified version - in production, we'd parse the code more thoroughly
    const lines = animationCode.split('\n');
    const keyMoments: string[] = [];
    
    for (const line of lines) {
      if (line.includes('self.play') || line.includes('self.wait') || line.includes('Create') || line.includes('Transform')) {
        keyMoments.push(line.trim());
      }
    }
    
    return keyMoments.slice(0, 20).join('\n'); // Limit to first 20 moments
  }
  
  private getWordsPerSecond(pacing: string): number {
    const pacingMap = {
      slow: 2.0,
      moderate: 2.5,
      fast: 3.0
    };
    return pacingMap[pacing as keyof typeof pacingMap] || 2.5;
  }
  
  private formatVoiceScript(rawScript: any, totalDuration: number): VoiceOutput {
    const segments = this.formatSegments(rawScript.segments || []);
    const fullText = segments.map(seg => seg.text).join(' ');
    const totalWords = fullText.split(/\s+/).length;
    
    return {
      script: segments,
      fullText,
      metadata: {
        totalWords,
        averageWordsPerSecond: totalWords / totalDuration,
        totalDuration,
        suggestions: rawScript.metadata?.suggestions || []
      }
    };
  }
  
  private formatSegments(rawSegments: any[]): VoiceSegment[] {
    return rawSegments.map((seg, index) => ({
      segmentId: seg.segmentId || `seg_${index + 1}`,
      sceneId: seg.sceneId || 'unknown',
      text: seg.text || '',
      startTime: seg.startTime || 0,
      endTime: seg.endTime || seg.startTime + 3,
      duration: seg.endTime - seg.startTime,
      emphasis: seg.emphasis || [],
      pauseAfter: seg.pauseAfter,
      emotion: seg.emotion || 'neutral'
    }));
  }
  
  private formatScriptAsText(voiceOutput: VoiceOutput): string {
    let text = `VOICE SCRIPT: ${voiceOutput.metadata.totalDuration}s total\n`;
    text += `Total Words: ${voiceOutput.metadata.totalWords}\n`;
    text += `Average Speed: ${voiceOutput.metadata.averageWordsPerSecond.toFixed(1)} words/second\n\n`;
    
    for (const segment of voiceOutput.script) {
      text += `[${segment.startTime.toFixed(1)}s - ${segment.endTime.toFixed(1)}s] Scene: ${segment.sceneId}\n`;
      text += `${segment.text}\n`;
      if (segment.pauseAfter) {
        text += `[PAUSE ${segment.pauseAfter}s]\n`;
      }
      text += '\n';
    }
    
    if (voiceOutput.metadata.suggestions.length > 0) {
      text += '\nSUGGESTIONS:\n';
      voiceOutput.metadata.suggestions.forEach((suggestion, i) => {
        text += `${i + 1}. ${suggestion}\n`;
      });
    }
    
    return text;
  }
  
  private sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  }
  
  /**
   * Adjust script timing based on actual video rendering
   */
  async adjustTiming(
    voiceScript: VoiceOutput,
    actualVideoTimings: Array<{ event: string; timestamp: number }>
  ): Promise<VoiceOutput> {
    const prompt = `Adjust the timing of this voice script based on actual video timings:

Current Script:
${JSON.stringify(voiceScript.script, null, 2)}

Actual Video Timings:
${JSON.stringify(actualVideoTimings, null, 2)}

Adjust the start and end times of each segment to better match the video.
Maintain the same text but optimize timing for synchronization.

Return the adjusted segments in the same JSON format.`;
    
    const response = await this.sendMessage(prompt);
    const adjustedSegments = this.parseJSON(response.content);
    
    return {
      ...voiceScript,
      script: this.formatSegments(adjustedSegments.segments || adjustedSegments)
    };
  }
}