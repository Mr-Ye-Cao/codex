/**
 * Video assembly utilities for combining animation and audio
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface VideoAssemblyConfig {
  videoCodec?: string;
  audioCodec?: string;
  videoBitrate?: string;
  audioBitrate?: string;
  outputFormat?: string;
}

export interface AssemblyResult {
  finalVideo: string;
  duration: number;
  fileSize: number;
  metadata: {
    videoCodec: string;
    audioCodec: string;
    resolution: string;
    fps: number;
  };
}

export class VideoAssembler {
  private config: VideoAssemblyConfig;
  private outputDir: string;
  
  constructor(outputDir: string, config?: VideoAssemblyConfig) {
    this.outputDir = outputDir;
    this.config = {
      videoCodec: config?.videoCodec || 'libx264',
      audioCodec: config?.audioCodec || 'aac',
      videoBitrate: config?.videoBitrate || '5M',
      audioBitrate: config?.audioBitrate || '192k',
      outputFormat: config?.outputFormat || 'mp4'
    };
  }
  
  /**
   * Combine video and audio files
   */
  async assembleVideo(
    videoPath: string,
    audioPath: string,
    outputName: string
  ): Promise<AssemblyResult> {
    const outputPath = path.join(this.outputDir, `${outputName}.${this.config.outputFormat}`);
    
    // Check if input files exist
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`);
    }
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }
    
    // Get video and audio durations
    const videoDuration = await this.getMediaDuration(videoPath);
    const audioDuration = await this.getMediaDuration(audioPath);
    
    // Assemble the video with audio
    await this.combineVideoAudio(videoPath, audioPath, outputPath, videoDuration, audioDuration);
    
    // Get metadata of the final video
    const metadata = await this.getVideoMetadata(outputPath);
    const fileSize = fs.statSync(outputPath).size;
    
    return {
      finalVideo: outputPath,
      duration: metadata.duration,
      fileSize,
      metadata
    };
  }
  
  /**
   * Combine video and audio using ffmpeg
   */
  private async combineVideoAudio(
    videoPath: string,
    audioPath: string,
    outputPath: string,
    videoDuration: number,
    audioDuration: number
  ): Promise<void> {
    let command: string;
    
    if (Math.abs(videoDuration - audioDuration) < 0.1) {
      // Durations match, simple combination
      command = `ffmpeg -i ${videoPath} -i ${audioPath} -c:v ${this.config.videoCodec} -c:a ${this.config.audioCodec} -b:v ${this.config.videoBitrate} -b:a ${this.config.audioBitrate} -map 0:v:0 -map 1:a:0 ${outputPath} -y`;
    } else if (videoDuration > audioDuration) {
      // Video is longer, pad audio with silence
      command = `ffmpeg -i ${videoPath} -i ${audioPath} -c:v ${this.config.videoCodec} -c:a ${this.config.audioCodec} -b:v ${this.config.videoBitrate} -b:a ${this.config.audioBitrate} -filter_complex "[1:a]apad=whole_dur=${videoDuration}[a]" -map 0:v:0 -map "[a]" ${outputPath} -y`;
    } else {
      // Audio is longer, trim it to match video
      command = `ffmpeg -i ${videoPath} -i ${audioPath} -c:v ${this.config.videoCodec} -c:a ${this.config.audioCodec} -b:v ${this.config.videoBitrate} -b:a ${this.config.audioBitrate} -t ${videoDuration} -map 0:v:0 -map 1:a:0 ${outputPath} -y`;
    }
    
    await execAsync(command);
  }
  
  /**
   * Get duration of media file
   */
  private async getMediaDuration(filepath: string): Promise<number> {
    try {
      const { stdout } = await execAsync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${filepath}`
      );
      return parseFloat(stdout.trim());
    } catch (error) {
      console.error('Error getting media duration:', error);
      return 0;
    }
  }
  
  /**
   * Get detailed metadata of video file
   */
  private async getVideoMetadata(filepath: string): Promise<AssemblyResult['metadata'] & { duration: number }> {
    try {
      const { stdout } = await execAsync(
        `ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,r_frame_rate,duration -show_entries format=duration -of json ${filepath}`
      );
      
      const data = JSON.parse(stdout);
      const stream = data.streams[0];
      const formatDuration = parseFloat(data.format.duration);
      
      // Parse frame rate
      const [num, den] = stream.r_frame_rate.split('/').map(Number);
      const fps = den ? num / den : num;
      
      return {
        duration: formatDuration,
        videoCodec: stream.codec_name,
        audioCodec: 'aac', // We know we used AAC
        resolution: `${stream.width}x${stream.height}`,
        fps: Math.round(fps)
      };
    } catch (error) {
      console.error('Error getting video metadata:', error);
      return {
        duration: 0,
        videoCodec: 'unknown',
        audioCodec: 'unknown',
        resolution: 'unknown',
        fps: 0
      };
    }
  }
  
  /**
   * Add intro/outro to video
   */
  async addIntroOutro(
    mainVideo: string,
    introVideo?: string,
    outroVideo?: string
  ): Promise<string> {
    const videos: string[] = [];
    if (introVideo && fs.existsSync(introVideo)) {
      videos.push(introVideo);
    }
    videos.push(mainVideo);
    if (outroVideo && fs.existsSync(outroVideo)) {
      videos.push(outroVideo);
    }
    
    if (videos.length === 1) {
      return mainVideo; // No intro/outro to add
    }
    
    const outputPath = path.join(this.outputDir, 'final_with_intro_outro.mp4');
    const listFile = path.join(this.outputDir, 'video_list.txt');
    
    // Create concat list
    const listContent = videos.map(v => `file '${v}'`).join('\n');
    fs.writeFileSync(listFile, listContent);
    
    // Concatenate videos
    await execAsync(
      `ffmpeg -f concat -safe 0 -i ${listFile} -c copy ${outputPath} -y`
    );
    
    // Clean up
    fs.unlinkSync(listFile);
    
    return outputPath;
  }
  
  /**
   * Add subtitles to video
   */
  async addSubtitles(
    videoPath: string,
    subtitlesPath: string,
    style?: {
      fontSize?: number;
      fontColor?: string;
      position?: 'bottom' | 'top';
    }
  ): Promise<string> {
    const outputPath = path.join(
      this.outputDir,
      path.basename(videoPath, '.mp4') + '_subtitled.mp4'
    );
    
    const fontSize = style?.fontSize || 24;
    const fontColor = style?.fontColor || 'white';
    const alignment = style?.position === 'top' ? 6 : 2;
    
    const command = `ffmpeg -i ${videoPath} -vf "subtitles=${subtitlesPath}:force_style='Fontsize=${fontSize},PrimaryColour=${fontColor},Alignment=${alignment}'" -c:a copy ${outputPath} -y`;
    
    await execAsync(command);
    
    return outputPath;
  }
  
  /**
   * Generate thumbnail from video
   */
  async generateThumbnail(
    videoPath: string,
    timestamp: number = 5
  ): Promise<string> {
    const thumbnailPath = path.join(
      this.outputDir,
      path.basename(videoPath, '.mp4') + '_thumbnail.png'
    );
    
    await execAsync(
      `ffmpeg -i ${videoPath} -ss ${timestamp} -vframes 1 ${thumbnailPath} -y`
    );
    
    return thumbnailPath;
  }
  
  /**
   * Optimize video for different platforms
   */
  async optimizeForPlatform(
    videoPath: string,
    platform: 'youtube' | 'twitter' | 'instagram' | 'tiktok'
  ): Promise<string> {
    const platformConfigs = {
      youtube: {
        resolution: '1920x1080',
        videoBitrate: '8M',
        audioBitrate: '256k',
        format: 'mp4'
      },
      twitter: {
        resolution: '1280x720',
        videoBitrate: '2M',
        audioBitrate: '128k',
        format: 'mp4'
      },
      instagram: {
        resolution: '1080x1080',
        videoBitrate: '3.5M',
        audioBitrate: '128k',
        format: 'mp4'
      },
      tiktok: {
        resolution: '1080x1920',
        videoBitrate: '4M',
        audioBitrate: '128k',
        format: 'mp4'
      }
    };
    
    const config = platformConfigs[platform];
    const outputPath = path.join(
      this.outputDir,
      path.basename(videoPath, '.mp4') + `_${platform}.${config.format}`
    );
    
    const command = `ffmpeg -i ${videoPath} -vf "scale=${config.resolution}:force_original_aspect_ratio=decrease,pad=${config.resolution}:(ow-iw)/2:(oh-ih)/2" -c:v ${this.config.videoCodec} -b:v ${config.videoBitrate} -c:a ${this.config.audioCodec} -b:a ${config.audioBitrate} ${outputPath} -y`;
    
    await execAsync(command);
    
    return outputPath;
  }
}

/**
 * Create video assembler with default configuration
 */
export function createVideoAssembler(outputDir: string): VideoAssembler {
  return new VideoAssembler(outputDir);
}