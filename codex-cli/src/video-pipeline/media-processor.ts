/**
 * Media processing for TTS generation and video/audio assembly
 */

import { VoiceScript, VideoGenerationConfig } from './types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, writeFileSync } from 'fs';
import { join, basename } from 'path';
import OpenAI from 'openai';

const execAsync = promisify(exec);

export interface TTSResult {
  success: boolean;
  audioPath?: string;
  error?: string;
  duration: number;
}

export interface VideoAssemblyResult {
  success: boolean;
  finalVideoPath?: string;
  error?: string;
  duration: number;
}

export class MediaProcessor {
  private config: VideoGenerationConfig;
  private openai?: OpenAI;

  constructor(config: VideoGenerationConfig) {
    this.config = config;
    
    if (config.tts.provider === 'openai') {
      this.openai = new OpenAI({
        apiKey: process.env['OPENAI_API_KEY'],
      });
    }
  }

  /**
   * Generate TTS audio for voice script
   */
  async generateTTS(voiceScript: VoiceScript, topicId: string): Promise<TTSResult> {
    const startTime = Date.now();
    const audioDir = join(this.config.pipeline.workingDirectory, 'audio');
    const tempDir = join(audioDir, 'temp', topicId);
    
    // Create temp directory for audio segments
    if (!existsSync(tempDir)) {
      require('fs').mkdirSync(tempDir, { recursive: true });
    }

    try {
      const audioSegments: string[] = [];

      // Generate TTS for each scene
      for (let i = 0; i < voiceScript.scenes.length; i++) {
        const scene = voiceScript.scenes[i];
        if (!scene) {
          continue;
        }
        const segmentPath = join(tempDir, `segment-${i + 1}.mp3`);
        
        console.log(`🎙️ Generating TTS for scene ${i + 1}/${voiceScript.scenes.length}...`);
        
        const segmentResult = await this.generateTTSSegment(scene.text, segmentPath);
        if (!segmentResult.success) {
          return {
            success: false,
            error: `Failed to generate TTS for scene ${i + 1}: ${segmentResult.error}`,
            duration: Date.now() - startTime
          };
        }

        audioSegments.push(segmentPath);
      }

      // Concatenate all audio segments
      const finalAudioPath = join(audioDir, `${topicId}.mp3`);
      const concatenateResult = await this.concatenateAudio(audioSegments, finalAudioPath);
      
      if (!concatenateResult.success) {
        return {
          success: false,
          error: `Failed to concatenate audio: ${concatenateResult.error}`,
          duration: Date.now() - startTime
        };
      }

      // Adjust audio timing to match video duration
      const timedAudioPath = join(audioDir, `${topicId}-timed.mp3`);
      const timingResult = await this.adjustAudioTiming(finalAudioPath, timedAudioPath, voiceScript);
      
      if (!timingResult.success) {
        console.warn('Failed to adjust audio timing, using original audio');
        return {
          success: true,
          audioPath: finalAudioPath,
          duration: Date.now() - startTime
        };
      }

      return {
        success: true,
        audioPath: timedAudioPath,
        duration: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        error: `TTS generation failed: ${error instanceof Error ? error.message : String(error)}`,
        duration: Date.now() - startTime
      };
    }
  }

  private async generateTTSSegment(text: string, outputPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (this.config.tts.provider === 'openai' && this.openai) {
        const mp3 = await this.openai.audio.speech.create({
          model: 'tts-1',
          voice: this.config.tts.voice as any,
          input: text,
          speed: this.config.tts.speed,
        });

        const buffer = Buffer.from(await mp3.arrayBuffer());
        writeFileSync(outputPath, buffer);
        
        return { success: true };

      } else if (this.config.tts.provider === 'elevenlabs') {
        // TODO: Implement ElevenLabs TTS
        return { success: false, error: 'ElevenLabs TTS not yet implemented' };
        
      } else if (this.config.tts.provider === 'azure') {
        // TODO: Implement Azure TTS
        return { success: false, error: 'Azure TTS not yet implemented' };
        
      } else {
        return { success: false, error: `Unsupported TTS provider: ${this.config.tts.provider}` };
      }

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  private async concatenateAudio(segments: string[], outputPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Create FFmpeg filter for concatenation
      const inputArgs = segments.map((_, i) => `-i "${segments[i]}"`).join(' ');
      const filterComplex = segments.map((_, i) => `[${i}:0]`).join('') + `concat=n=${segments.length}:v=0:a=1[out]`;
      
      const command = `ffmpeg ${inputArgs} -filter_complex "${filterComplex}" -map "[out]" "${outputPath}" -y`;
      
      await execAsync(command, { timeout: 60000 }); // 1 minute timeout
      
      return { success: true };

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  private async adjustAudioTiming(inputPath: string, outputPath: string, voiceScript: VoiceScript): Promise<{ success: boolean; error?: string }> {
    try {
      // Use FFmpeg to adjust timing with silence padding between scenes
      const totalDuration = voiceScript.totalDuration;
      
      // For now, just stretch/compress the audio to fit the total duration
      const command = `ffmpeg -i "${inputPath}" -filter:a "atempo=1.0" -t ${totalDuration} "${outputPath}" -y`;
      
      await execAsync(command, { timeout: 60000 });
      
      return { success: true };

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  /**
   * Combine video and audio into final video
   */
  async assembleVideo(videoPath: string, audioPath: string, outputPath: string): Promise<VideoAssemblyResult> {
    const startTime = Date.now();

    try {
      // Check if input files exist
      if (!existsSync(videoPath)) {
        return {
          success: false,
          error: `Video file not found: ${videoPath}`,
          duration: Date.now() - startTime
        };
      }

      if (!existsSync(audioPath)) {
        return {
          success: false,
          error: `Audio file not found: ${audioPath}`,
          duration: Date.now() - startTime
        };
      }

      console.log(`🎬 Assembling final video: ${basename(outputPath)}`);

      // Use FFmpeg to combine video and audio
      const command = `ffmpeg -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a aac -strict experimental -shortest "${outputPath}" -y`;
      
      await execAsync(command, { 
        timeout: 180000, // 3 minutes timeout
        maxBuffer: 1024 * 1024 * 50 // 50MB buffer for large videos
      });

      console.log(`✅ Video assembly complete: ${outputPath}`);

      return {
        success: true,
        finalVideoPath: outputPath,
        duration: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        error: `Video assembly failed: ${error instanceof Error ? error.message : String(error)}`,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Get video metadata using FFprobe
   */
  async getVideoMetadata(videoPath: string): Promise<{ duration: number; resolution: string; fps: number } | null> {
    try {
      const command = `ffprobe -v quiet -print_format json -show_format -show_streams "${videoPath}"`;
      const { stdout } = await execAsync(command);
      
      const metadata = JSON.parse(stdout);
      const videoStream = metadata.streams.find((s: any) => s.codec_type === 'video');
      
      if (!videoStream) {
        return null;
      }

      return {
        duration: parseFloat(metadata.format.duration || '0'),
        resolution: `${videoStream.width}x${videoStream.height}`,
        fps: eval(videoStream.r_frame_rate) || 30
      };

    } catch (error) {
      console.warn('Failed to get video metadata:', error);
      return null;
    }
  }

  /**
   * Optimize video for web delivery
   */
  async optimizeVideo(inputPath: string, outputPath: string, options: {
    maxSize?: number; // Max file size in MB
    quality?: 'low' | 'medium' | 'high';
  } = {}): Promise<{ success: boolean; error?: string; originalSize: number; newSize: number }> {
    try {
      const { quality = 'medium' } = options;
      
      // Quality settings
      const crf = quality === 'low' ? 28 : quality === 'medium' ? 23 : 18;
      
      const command = `ffmpeg -i "${inputPath}" -c:v libx264 -crf ${crf} -preset medium -c:a aac -b:a 128k "${outputPath}" -y`;
      
      await execAsync(command, { timeout: 300000 }); // 5 minutes
      
      // Check file sizes
      const originalStats = require('fs').statSync(inputPath);
      const newStats = require('fs').statSync(outputPath);
      
      const originalSizeMB = originalStats.size / (1024 * 1024);
      const newSizeMB = newStats.size / (1024 * 1024);
      
      return {
        success: true,
        originalSize: originalSizeMB,
        newSize: newSizeMB
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        originalSize: 0,
        newSize: 0
      };
    }
  }

  /**
   * Create video thumbnail
   */
  async generateThumbnail(videoPath: string, outputPath: string, timeOffset: number = 5): Promise<{ success: boolean; error?: string }> {
    try {
      const command = `ffmpeg -i "${videoPath}" -ss ${timeOffset} -vframes 1 -q:v 2 "${outputPath}" -y`;
      
      await execAsync(command, { timeout: 30000 });
      
      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Check if required media processing tools are available
   */
  async checkDependencies(): Promise<{ ffmpeg: boolean; ffprobe: boolean; errors: string[] }> {
    const errors: string[] = [];
    let ffmpeg = false;
    let ffprobe = false;

    try {
      await execAsync('ffmpeg -version');
      ffmpeg = true;
    } catch (error) {
      errors.push('FFmpeg not found. Please install FFmpeg for video processing.');
    }

    try {
      await execAsync('ffprobe -version');
      ffprobe = true;
    } catch (error) {
      errors.push('FFprobe not found. Please install FFmpeg (includes FFprobe) for video analysis.');
    }

    return { ffmpeg, ffprobe, errors };
  }
}