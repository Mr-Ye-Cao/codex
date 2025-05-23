/**
 * Text-to-Speech utilities for generating voice narration
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { VoiceOutput, VoiceSegment } from '../agents/voice-agent';

const execAsync = promisify(exec);

export interface TTSConfig {
  provider: 'openai' | 'elevenlabs' | 'google' | 'system';
  voice?: string;
  model?: string;
  speed?: number;
  apiKey?: string;
}

export interface TTSResult {
  audioFiles: Array<{
    segmentId: string;
    filepath: string;
    duration: number;
  }>;
  combinedAudioFile?: string;
}

export class TTSService {
  private config: TTSConfig;
  private outputDir: string;
  
  constructor(config: TTSConfig, outputDir: string) {
    this.config = config;
    this.outputDir = outputDir;
  }
  
  /**
   * Generate audio from voice script
   */
  async generateAudio(voiceScript: VoiceOutput): Promise<TTSResult> {
    const audioFiles: TTSResult['audioFiles'] = [];
    
    // Create audio output directory
    const audioDir = path.join(this.outputDir, 'audio');
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }
    
    // Generate audio for each segment
    for (const segment of voiceScript.script) {
      const audioFile = await this.generateSegmentAudio(segment, audioDir);
      audioFiles.push(audioFile);
    }
    
    // Combine all audio segments
    const combinedAudioFile = await this.combineAudioSegments(audioFiles, audioDir);
    
    return {
      audioFiles,
      combinedAudioFile
    };
  }
  
  /**
   * Generate audio for a single segment
   */
  private async generateSegmentAudio(
    segment: VoiceSegment,
    outputDir: string
  ): Promise<TTSResult['audioFiles'][0]> {
    const filename = `${segment.segmentId}.mp3`;
    const filepath = path.join(outputDir, filename);
    
    switch (this.config.provider) {
      case 'openai':
        await this.generateOpenAITTS(segment.text, filepath);
        break;
      case 'system':
        await this.generateSystemTTS(segment.text, filepath);
        break;
      default:
        throw new Error(`TTS provider ${this.config.provider} not implemented`);
    }
    
    // Get actual duration of generated audio
    const duration = await this.getAudioDuration(filepath);
    
    // If pause is needed, add silence
    if (segment.pauseAfter && segment.pauseAfter > 0) {
      await this.addSilence(filepath, segment.pauseAfter);
    }
    
    return {
      segmentId: segment.segmentId,
      filepath,
      duration
    };
  }
  
  /**
   * Generate TTS using OpenAI API
   */
  private async generateOpenAITTS(text: string, outputPath: string): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error('OpenAI API key required for TTS');
    }
    
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.config.model || 'tts-1',
        input: text,
        voice: this.config.voice || 'alloy',
        speed: this.config.speed || 1.0
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI TTS failed: ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(outputPath, Buffer.from(buffer));
  }
  
  /**
   * Generate TTS using system command (macOS/Linux)
   */
  private async generateSystemTTS(text: string, outputPath: string): Promise<void> {
    // Use different commands based on platform
    const platform = process.platform;
    
    if (platform === 'darwin') {
      // macOS - use 'say' command
      const voice = this.config.voice || 'Alex';
      const rate = (this.config.speed || 1.0) * 175; // Default rate is ~175 wpm
      await execAsync(`say -v ${voice} -r ${rate} -o ${outputPath} --data-format=mp3 "${text}"`);
    } else if (platform === 'linux') {
      // Linux - use espeak or festival
      const speed = Math.floor((this.config.speed || 1.0) * 175);
      // First generate wav with espeak, then convert to mp3
      const wavPath = outputPath.replace('.mp3', '.wav');
      await execAsync(`espeak -s ${speed} -w ${wavPath} "${text}"`);
      await execAsync(`ffmpeg -i ${wavPath} ${outputPath} && rm ${wavPath}`);
    } else {
      throw new Error(`System TTS not supported on platform: ${platform}`);
    }
  }
  
  /**
   * Get duration of audio file in seconds
   */
  private async getAudioDuration(filepath: string): Promise<number> {
    try {
      const { stdout } = await execAsync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${filepath}`
      );
      return parseFloat(stdout.trim());
    } catch (error) {
      console.error('Error getting audio duration:', error);
      return 0;
    }
  }
  
  /**
   * Add silence to the end of an audio file
   */
  private async addSilence(filepath: string, duration: number): Promise<void> {
    const tempFile = filepath.replace('.mp3', '_temp.mp3');
    
    // Generate silence and concatenate
    await execAsync(
      `ffmpeg -i ${filepath} -f lavfi -t ${duration} -i anullsrc=r=44100:cl=stereo -filter_complex "[0:a][1:a]concat=n=2:v=0:a=1" ${tempFile} -y`
    );
    
    // Replace original file
    fs.renameSync(tempFile, filepath);
  }
  
  /**
   * Combine multiple audio segments into one file
   */
  private async combineAudioSegments(
    audioFiles: TTSResult['audioFiles'],
    outputDir: string
  ): Promise<string> {
    if (audioFiles.length === 0) {
      throw new Error('No audio files to combine');
    }
    
    const outputPath = path.join(outputDir, 'combined_narration.mp3');
    
    if (audioFiles.length === 1) {
      // Just copy the single file
      fs.copyFileSync(audioFiles[0].filepath, outputPath);
      return outputPath;
    }
    
    // Create a file list for ffmpeg
    const listFile = path.join(outputDir, 'audio_list.txt');
    const listContent = audioFiles
      .map(af => `file '${path.basename(af.filepath)}'`)
      .join('\n');
    fs.writeFileSync(listFile, listContent);
    
    // Concatenate all audio files
    await execAsync(
      `cd ${outputDir} && ffmpeg -f concat -safe 0 -i audio_list.txt -c copy combined_narration.mp3 -y`
    );
    
    // Clean up list file
    fs.unlinkSync(listFile);
    
    return outputPath;
  }
  
  /**
   * Generate audio with timing adjustments to match video
   */
  async generateTimedAudio(
    voiceScript: VoiceOutput,
    targetTimings: Array<{ segmentId: string; targetDuration: number }>
  ): Promise<TTSResult> {
    const audioFiles: TTSResult['audioFiles'] = [];
    const audioDir = path.join(this.outputDir, 'audio');
    
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }
    
    for (const segment of voiceScript.script) {
      const audioFile = await this.generateSegmentAudio(segment, audioDir);
      
      // Find target timing for this segment
      const targetTiming = targetTimings.find(t => t.segmentId === segment.segmentId);
      if (targetTiming && targetTiming.targetDuration > audioFile.duration) {
        // Add padding to match target duration
        const paddingNeeded = targetTiming.targetDuration - audioFile.duration;
        await this.addSilence(audioFile.filepath, paddingNeeded);
        audioFile.duration = targetTiming.targetDuration;
      }
      
      audioFiles.push(audioFile);
    }
    
    const combinedAudioFile = await this.combineAudioSegments(audioFiles, audioDir);
    
    return {
      audioFiles,
      combinedAudioFile
    };
  }
}

/**
 * Factory function to create TTS service with default configuration
 */
export function createTTSService(outputDir: string, customConfig?: Partial<TTSConfig>): TTSService {
  const defaultConfig: TTSConfig = {
    provider: 'system',
    voice: process.platform === 'darwin' ? 'Alex' : undefined,
    speed: 1.0
  };
  
  // Check for API keys in environment
  if (process.env.OPENAI_API_KEY && !customConfig?.provider) {
    defaultConfig.provider = 'openai';
    defaultConfig.apiKey = process.env.OPENAI_API_KEY;
  }
  
  const config = { ...defaultConfig, ...customConfig };
  return new TTSService(config, outputDir);
}