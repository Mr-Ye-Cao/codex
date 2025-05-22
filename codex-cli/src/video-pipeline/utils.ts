/**
 * Utility functions for video pipeline
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { DEFAULT_VIDEO_CONFIG } from './config.js';

const execAsync = promisify(exec);

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Create a video workspace with all necessary directories
 */
export function createVideoWorkspace(workspaceDir: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Create main workspace directory
    if (!existsSync(workspaceDir)) {
      mkdirSync(workspaceDir, { recursive: true });
    }

    // Create subdirectories
    const subdirs = [
      'topics',      // Generated topic ideas
      'scripts',     // Director plans and voice scripts
      'animations',  // Animation code and rendered videos
      'audio',       // TTS audio files
      'videos',      // Final assembled videos
      'temp',        // Temporary files
      'results',     // Pipeline results and metadata
      'configs',     // Custom configurations
    ];

    subdirs.forEach(subdir => {
      const path = join(workspaceDir, subdir);
      if (!existsSync(path)) {
        mkdirSync(path, { recursive: true });
      }
    });

    // Create audio temp subdirectory
    const audioTempDir = join(workspaceDir, 'audio', 'temp');
    if (!existsSync(audioTempDir)) {
      mkdirSync(audioTempDir, { recursive: true });
    }

    console.log(`✅ Video workspace created: ${workspaceDir}`);

  } catch (error) {
    errors.push(`Failed to create workspace: ${error instanceof Error ? error.message : String(error)}`);
  }

  return { isValid: errors.length === 0, errors, warnings };
}

/**
 * Validate that the environment has all necessary dependencies
 */
export async function validateVideoEnvironment(): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check Python and Manim
  try {
    await execAsync('python3 --version');
  } catch (error) {
    try {
      await execAsync('python --version');
    } catch (error) {
      errors.push('Python not found. Please install Python 3.8+ for Manim support.');
    }
  }

  try {
    await execAsync('manim --version');
  } catch (error) {
    warnings.push('Manim not found. Install with: pip install manim');
  }

  // Check FFmpeg
  try {
    await execAsync('ffmpeg -version');
  } catch (error) {
    errors.push('FFmpeg not found. Please install FFmpeg for video processing.');
  }

  try {
    await execAsync('ffprobe -version');
  } catch (error) {
    errors.push('FFprobe not found. Please install FFmpeg (includes FFprobe).');
  }

  // Check Node.js dependencies (if using Three.js)
  try {
    await execAsync('node --version');
  } catch (error) {
    warnings.push('Node.js not found. Required for Three.js animations.');
  }

  // Check environment variables
  if (!process.env['OPENAI_API_KEY']) {
    warnings.push('OPENAI_API_KEY not set. Required for OpenAI TTS and models.');
  }

  // Check disk space (warn if less than 1GB available)
  try {
    const { stdout } = await execAsync('df -h .');
    const lines = stdout.split('\n');
    if (lines.length > 1) {
      const fields = lines[1]?.split(/\s+/);
      const available = fields?.[3];
      if (available && available.includes('M') && parseInt(available) < 1000) {
        warnings.push('Low disk space. Video generation requires significant storage.');
      }
    }
  } catch (error) {
    // Ignore disk space check errors
  }

  return { isValid: errors.length === 0, errors, warnings };
}

/**
 * Get the default configuration file path
 */
export function getDefaultConfigPath(): string {
  return join(homedir(), '.codex', 'video-config.json');
}

/**
 * Create a default configuration file
 */
export function createDefaultConfig(configPath?: string): string {
  const path = configPath || getDefaultConfigPath();
  const dir = dirname(path);
  
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  
  writeFileSync(path, JSON.stringify(DEFAULT_VIDEO_CONFIG, null, 2));
  
  return path;
}

/**
 * Detect available animation frameworks
 */
export async function detectAnimationFrameworks(): Promise<{
  manim: boolean;
  threejs: boolean;
  blender: boolean;
}> {
  const frameworks = {
    manim: false,
    threejs: false,
    blender: false,
  };

  // Check Manim
  try {
    await execAsync('manim --version');
    frameworks.manim = true;
  } catch (error) {
    // Manim not available
  }

  // Check Three.js (via npm)
  try {
    await execAsync('npm list three -g');
    frameworks.threejs = true;
  } catch (error) {
    // Three.js not available globally
  }

  // Check Blender
  try {
    await execAsync('blender --version');
    frameworks.blender = true;
  } catch (error) {
    // Blender not available
  }

  return frameworks;
}

/**
 * Estimate video generation time and resource requirements
 */
export function estimateResourceRequirements(options: {
  videoDuration: number;
  resolution: string;
  complexity: 'simple' | 'moderate' | 'complex';
  sceneCount: number;
}): {
  estimatedTime: number; // minutes
  diskSpace: number; // MB
  memoryUsage: number; // MB
} {
  const { videoDuration, resolution, complexity, sceneCount } = options;

  // Base time estimates (minutes per second of video)
  const baseTimePerSecond = {
    simple: 0.5,
    moderate: 1.0,
    complex: 2.0,
  };

  // Resolution multipliers
  const resolutionMultiplier = {
    '720p': 1.0,
    '1080p': 1.5,
    '4k': 3.0,
  };

  const complexityFactor = baseTimePerSecond[complexity];
  const resFactor = resolutionMultiplier[resolution as keyof typeof resolutionMultiplier] || 1.0;
  const sceneFactor = Math.log(sceneCount + 1); // Diminishing returns

  const estimatedTime = videoDuration * complexityFactor * resFactor * sceneFactor;

  // Disk space estimates (MB per second)
  const diskSpacePerSecond = {
    '720p': 50,
    '1080p': 100,
    '4k': 400,
  };

  const baseDiskSpace = diskSpacePerSecond[resolution as keyof typeof diskSpacePerSecond] || 100;
  const diskSpace = videoDuration * baseDiskSpace * 2; // 2x for temp files

  // Memory usage estimates
  const memoryUsage = {
    '720p': 2000,
    '1080p': 4000,
    '4k': 8000,
  };

  return {
    estimatedTime: Math.ceil(estimatedTime),
    diskSpace: Math.ceil(diskSpace),
    memoryUsage: memoryUsage[resolution as keyof typeof memoryUsage] || 4000,
  };
}

/**
 * Clean up temporary files from video generation
 */
export async function cleanupTempFiles(workspaceDir: string, options: {
  keepResults?: boolean;
  keepAudio?: boolean;
  maxAge?: number; // days
} = {}): Promise<{ cleaned: number; errors: string[] }> {
  const { keepResults = true, keepAudio = true, maxAge = 7 } = options;
  const errors: string[] = [];
  let cleaned = 0;

  const tempDirs = [
    join(workspaceDir, 'temp'),
    ...(keepAudio ? [] : [join(workspaceDir, 'audio', 'temp')]),
    ...(keepResults ? [] : [join(workspaceDir, 'results')]),
  ];

  for (const tempDir of tempDirs) {
    if (!existsSync(tempDir)) continue;

    try {
      await execAsync(`find "${tempDir}" -type f -mtime +${maxAge} -delete`);
      const { stdout: countStdout } = await execAsync(`find "${tempDir}" -type f | wc -l`);
      cleaned += parseInt(countStdout.trim());
    } catch (error) {
      errors.push(`Failed to clean ${tempDir}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { cleaned, errors };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Format duration for display
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

/**
 * Generate a unique identifier for video projects
 */
export function generateVideoId(topic: string): string {
  const timestamp = Date.now();
  const topicSlug = topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 20);
  
  return `${topicSlug}-${timestamp}`;
}

/**
 * Validate video topic for safety and appropriateness
 */
export function validateTopic(topic: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic validation
  if (!topic || topic.trim().length === 0) {
    errors.push('Topic cannot be empty');
  }

  if (topic.length < 3) {
    errors.push('Topic must be at least 3 characters long');
  }

  if (topic.length > 200) {
    errors.push('Topic must be less than 200 characters');
  }

  // Content validation (basic safety checks)
  const inappropriateTerms = [
    'violence', 'weapon', 'drug', 'illegal', 'harmful',
    'adult', 'explicit', 'nsfw'
  ];

  const lowerTopic = topic.toLowerCase();
  for (const term of inappropriateTerms) {
    if (lowerTopic.includes(term)) {
      warnings.push(`Topic contains potentially inappropriate term: ${term}`);
    }
  }

  // Educational appropriateness
  const educationalIndicators = [
    'learn', 'understand', 'explain', 'concept', 'theory',
    'science', 'math', 'physics', 'chemistry', 'biology',
    'history', 'geography', 'technology', 'computer',
    'engineering', 'medicine', 'psychology'
  ];

  const hasEducationalIndicator = educationalIndicators.some(indicator => 
    lowerTopic.includes(indicator)
  );

  if (!hasEducationalIndicator) {
    warnings.push('Topic may not be educational. Consider adding educational context.');
  }

  return { isValid: errors.length === 0, errors, warnings };
}