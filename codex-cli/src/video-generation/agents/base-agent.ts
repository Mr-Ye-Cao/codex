/**
 * Base agent class for the video generation pipeline
 * Integrates with the existing Codex agent infrastructure
 */

import { AgentConfig, AgentMessage, AgentResponse } from '../config/types';
import { createOpenAIClient } from '../../utils/openai-client';
import { agentLoop } from '../../utils/agent/agent-loop';
import { ExecEnv } from '../../../../codex-rs/core/src/exec_env';
import * as fs from 'fs';
import * as path from 'path';

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected conversationHistory: AgentMessage[] = [];
  protected workingDirectory: string;
  
  constructor(config: AgentConfig, workingDirectory: string) {
    this.config = config;
    this.workingDirectory = workingDirectory;
    
    // Initialize with system prompt
    if (config.systemPrompt) {
      this.conversationHistory.push({
        role: 'system',
        content: config.systemPrompt
      });
    }
  }
  
  /**
   * Get agent ID
   */
  getId(): string {
    return this.config.id;
  }
  
  /**
   * Get agent name
   */
  getName(): string {
    return this.config.name;
  }
  
  /**
   * Abstract method that each agent must implement
   */
  abstract execute(inputs: Record<string, any>): Promise<Record<string, any>>;
  
  /**
   * Send a message to the LLM and get a response
   */
  protected async sendMessage(message: string): Promise<AgentResponse> {
    this.conversationHistory.push({
      role: 'user',
      content: message
    });
    
    try {
      const response = await this.callLLM();
      
      this.conversationHistory.push({
        role: 'assistant',
        content: response.content
      });
      
      return response;
    } catch (error) {
      console.error(`Error in ${this.config.name}:`, error);
      throw error;
    }
  }
  
  /**
   * Call the LLM based on the agent's configuration
   */
  private async callLLM(): Promise<AgentResponse> {
    const { provider, model, temperature, maxTokens, apiKey, baseUrl } = this.config.model;
    
    // For now, we'll use a simplified approach
    // In production, this would integrate with the actual Codex agent loop
    switch (provider) {
      case 'openai':
        return this.callOpenAI(model, temperature, maxTokens, apiKey, baseUrl);
      case 'anthropic':
        return this.callAnthropic(model, temperature, maxTokens, apiKey, baseUrl);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }
  
  /**
   * Call OpenAI API
   */
  private async callOpenAI(
    model: string,
    temperature?: number,
    maxTokens?: number,
    apiKey?: string,
    baseUrl?: string
  ): Promise<AgentResponse> {
    const client = createOpenAIClient({
      apiKey: apiKey || process.env.OPENAI_API_KEY || '',
      baseURL: baseUrl
    });
    
    const completion = await client.chat.completions.create({
      model,
      messages: this.conversationHistory as any,
      temperature: temperature || 0.7,
      max_tokens: maxTokens,
      stream: false
    });
    
    const message = completion.choices[0].message;
    
    return {
      content: message.content || '',
      toolCalls: message.tool_calls?.map(tc => ({
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments)
      }))
    };
  }
  
  /**
   * Call Anthropic API
   */
  private async callAnthropic(
    model: string,
    temperature?: number,
    maxTokens?: number,
    apiKey?: string,
    baseUrl?: string
  ): Promise<AgentResponse> {
    // This would be implemented with the Anthropic SDK
    // For now, we'll throw an error
    throw new Error('Anthropic integration not yet implemented');
  }
  
  /**
   * Save output to file
   */
  protected async saveToFile(filename: string, content: string): Promise<string> {
    const filepath = path.join(this.workingDirectory, filename);
    const dir = path.dirname(filepath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filepath, content);
    return filepath;
  }
  
  /**
   * Read file content
   */
  protected async readFile(filename: string): Promise<string> {
    const filepath = path.join(this.workingDirectory, filename);
    return fs.readFileSync(filepath, 'utf-8');
  }
  
  /**
   * Execute a shell command (integrating with Codex's exec system)
   */
  protected async executeCommand(command: string): Promise<string> {
    // In a full implementation, this would use the Codex exec system
    // For now, we'll use a simplified approach
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.workingDirectory
      });
      
      if (stderr) {
        console.warn(`Command stderr: ${stderr}`);
      }
      
      return stdout;
    } catch (error: any) {
      throw new Error(`Command failed: ${error.message}`);
    }
  }
  
  /**
   * Parse JSON from LLM response
   */
  protected parseJSON(content: string): any {
    // Try to extract JSON from various formats
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }
    
    // Try direct parse
    try {
      return JSON.parse(content);
    } catch {
      // Try to find JSON-like structure
      const start = content.indexOf('{');
      const end = content.lastIndexOf('}') + 1;
      if (start !== -1 && end > start) {
        return JSON.parse(content.substring(start, end));
      }
    }
    
    throw new Error('Could not parse JSON from response');
  }
  
  /**
   * Reset conversation history
   */
  reset(): void {
    this.conversationHistory = [];
    if (this.config.systemPrompt) {
      this.conversationHistory.push({
        role: 'system',
        content: this.config.systemPrompt
      });
    }
  }
}

/**
 * Agent that integrates directly with Codex's agent loop
 * This provides more advanced capabilities like tool use and streaming
 */
export abstract class CodexIntegratedAgent extends BaseAgent {
  protected execEnv: ExecEnv;
  
  constructor(config: AgentConfig, workingDirectory: string, execEnv: ExecEnv) {
    super(config, workingDirectory);
    this.execEnv = execEnv;
  }
  
  /**
   * Execute using Codex's agent loop for advanced capabilities
   */
  protected async executeWithCodex(prompt: string, options?: {
    allowedTools?: string[];
    maxRetries?: number;
  }): Promise<AgentResponse> {
    // This would integrate with the actual agentLoop function
    // For now, we'll use the base implementation
    return this.sendMessage(prompt);
  }
}