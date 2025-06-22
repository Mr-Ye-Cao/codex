import type { 
  ExplorationPolicy, 
  SystemContext, 
  Question, 
  Finding, 
  ExplorationSession,
  AuditEntry 
} from './types';

import { QuestionEngine } from './index';
import { loadConfig } from '../config';
import chalk from 'chalk';
import { EventEmitter } from 'events';
import os from 'os';
import path from 'path';

export class AutonomousExplorer extends EventEmitter {
  private policy: ExplorationPolicy;
  private questionEngine: QuestionEngine;
  private session: ExplorationSession;
  private startTime: Date;
  private isExploring: boolean = false;
  
  constructor(policy: ExplorationPolicy) {
    super();
    this.policy = policy;
    this.questionEngine = new QuestionEngine();
    this.startTime = new Date();
    this.session = {
      id: `explore_${Date.now()}`,
      startTime: this.startTime,
      questionsAsked: 0,
      findingsMade: 0,
      knowledgeGraph: new Map(),
      auditLog: []
    };
  }
  
  async explore(userPrompt?: string): Promise<void> {
    if (!this.policy.enabled) {
      throw new Error('Exploration is not enabled. Please update your exploration policy.');
    }
    
    this.isExploring = true;
    this.emit('exploration:start', { sessionId: this.session.id });
    
    try {
      // Gather initial system context
      const context = await this.gatherSystemContext();
      this.logAction('explore', 'system', 'success', undefined, {
        id: 'initial-context',
        type: 'system-context',
        data: this.sanitizeContext(context),
        confidence: 1.0
      });
      
      // Generate initial questions based on user prompt or general exploration
      const questions = userPrompt 
        ? await this.questionEngine.generateQuestionsFromPrompt(userPrompt, context)
        : await this.questionEngine.generateInitialQuestions(context);
      this.emit('questions:generated', { count: questions.length });
      
      // Main exploration loop
      while (this.isExploring && questions.length > 0 && this.withinLimits()) {
        // Sort by priority
        questions.sort((a, b) => b.priority - a.priority);
        
        const question = questions.shift()!;
        this.session.questionsAsked++;
        
        this.emit('question:exploring', { 
          question: question.text,
          type: question.type,
          remaining: questions.length
        });
        
        try {
          // Investigate the question
          const finding = await this.investigateQuestion(question);
          
          if (finding) {
            this.session.findingsMade++;
            this.questionEngine.updateKnowledge(finding);
            
            this.emit('finding:discovered', {
              question: question.text,
              finding: this.sanitizeFinding(finding)
            });
            
            // Generate follow-up questions
            const newQuestions = await this.questionEngine.generateFollowUpQuestions(finding);
            questions.push(...newQuestions);
            
            this.emit('questions:generated', { 
              count: newQuestions.length,
              total: questions.length
            });
          }
        } catch (error) {
          this.logAction('explore', question.text, 'failed', error.message);
          this.emit('question:failed', { question: question.text, error });
        }
        
        // Rate limiting - slower for continuous exploration
        await this.delay(500);
        
        // Every 5 questions, generate a summary
        if (this.session.questionsAsked % 5 === 0) {
          this.emit('exploration:checkpoint', {
            questionsAsked: this.session.questionsAsked,
            findingsMade: this.session.findingsMade,
            currentFocus: question.type
          });
        }
      }
      
      this.session.endTime = new Date();
      this.emit('exploration:complete', {
        sessionId: this.session.id,
        duration: this.session.endTime.getTime() - this.startTime.getTime(),
        questionsAsked: this.session.questionsAsked,
        findingsMade: this.session.findingsMade,
        summary: this.questionEngine.getKnowledgeSummary()
      });
      
    } catch (error) {
      this.emit('exploration:error', { error });
      throw error;
    } finally {
      this.isExploring = false;
    }
  }
  
  stop(): void {
    this.isExploring = false;
    this.emit('exploration:stopped', { sessionId: this.session.id });
  }
  
  private async gatherSystemContext(): Promise<SystemContext> {
    return {
      platform: os.platform(),
      homePath: os.homedir(),
      currentPath: process.cwd(),
      username: os.userInfo().username,
      hostname: os.hostname(),
      environment: this.sanitizeEnvironment(process.env)
    };
  }
  
  private async investigateQuestion(question: Question): Promise<Finding | null> {
    // Check if the exploration path would violate policy
    if (!this.isAllowedExploration(question)) {
      this.logAction('explore', question.text, 'skipped', 'Policy violation');
      return null;
    }
    
    try {
      const finding = await question.explorationPath();
      this.logAction('explore', question.text, 'success', undefined, finding);
      return finding;
    } catch (error) {
      this.logAction('explore', question.text, 'failed', error.message);
      return null;
    }
  }
  
  private isAllowedExploration(question: Question): boolean {
    // Check if the question type is allowed
    const restrictedTypes = ['credentials', 'secrets', 'private'];
    if (restrictedTypes.some(t => question.type.includes(t))) {
      return false;
    }
    
    // Additional policy checks would go here
    return true;
  }
  
  private withinLimits(): boolean {
    const elapsed = Date.now() - this.startTime.getTime();
    const maxTime = this.policy.maxExplorationTime * 60 * 60 * 1000; // hours to ms
    
    if (elapsed > maxTime) {
      this.emit('limit:time', { elapsed, maxTime });
      return false;
    }
    
    if (this.session.questionsAsked >= this.policy.maxQuestionsPerSession) {
      this.emit('limit:questions', { 
        asked: this.session.questionsAsked, 
        max: this.policy.maxQuestionsPerSession 
      });
      return false;
    }
    
    // Add a minimum exploration threshold
    if (this.session.questionsAsked < 10 && elapsed < 60000) { // Less than 10 questions or 1 minute
      return true; // Keep exploring
    }
    
    return true;
  }
  
  private sanitizeContext(context: SystemContext): SystemContext {
    // Remove sensitive environment variables
    const sanitized = { ...context };
    sanitized.environment = this.sanitizeEnvironment(context.environment);
    return sanitized;
  }
  
  private sanitizeEnvironment(env: Record<string, string | undefined>): Record<string, string | undefined> {
    const sanitized: Record<string, string | undefined> = {};
    const sensitiveKeys = ['TOKEN', 'KEY', 'SECRET', 'PASSWORD', 'CREDENTIAL'];
    
    for (const [key, value] of Object.entries(env)) {
      if (sensitiveKeys.some(sensitive => key.toUpperCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }
  
  private sanitizeFinding(finding: Finding): Finding {
    // Apply privacy patterns to finding data
    const sanitized = { ...finding };
    
    // This would apply regex patterns from policy.sensitivePatterns
    // to redact sensitive information from finding.data
    
    return sanitized;
  }
  
  private logAction(
    action: AuditEntry['action'], 
    target: string, 
    result: AuditEntry['result'],
    reason?: string,
    finding?: Finding
  ): void {
    const entry: AuditEntry = {
      timestamp: new Date(),
      action,
      target,
      result,
      reason,
      finding
    };
    
    this.session.auditLog.push(entry);
    this.emit('audit:entry', entry);
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  getSession(): ExplorationSession {
    return { ...this.session };
  }
  
  getAuditLog(): Array<AuditEntry> {
    return [...this.session.auditLog];
  }
}

// Helper function to create and run an exploration session
export async function runExploration(userPrompt?: string, policyPath?: string): Promise<void> {
  const config = await loadConfig();
  
  // If no policy path provided, check standard location
  if (!policyPath) {
    const defaultPath = path.join(os.homedir(), '.codex', 'exploration-policy.yaml');
    try {
      const fs = await import('fs/promises');
      await fs.access(defaultPath);
      policyPath = defaultPath;
    } catch {
      // File doesn't exist, will use defaults
    }
  }
  
  // Load exploration policy
  // Load policy from file or use safe defaults
  let policy: ExplorationPolicy;
  
  if (policyPath) {
    try {
      const yaml = await import('js-yaml');
      const fs = await import('fs/promises');
      const content = await fs.readFile(policyPath, 'utf-8');
      const loaded = yaml.load(content) as any;
      policy = loaded.exploration || loaded;
    } catch (error) {
      console.log(chalk.red(`Failed to load policy from ${policyPath}: ${error.message}`));
      process.exit(1);
    }
  } else {
    // Safe defaults - exploration disabled
    policy = {
      enabled: false,
      allowedPaths: [process.cwd()],
      excludedPaths: [],
      allowedFileTypes: ['.txt', '.md', '.json'],
      maxFileSize: 10 * 1024 * 1024, // 10MB
      sensitivePatterns: [],
      maxExplorationTime: 1, // 1 hour
      maxFilesPerSession: 100,
      maxQuestionsPerSession: 50
    };
  }
  
  if (!policy.enabled) {
    console.log(chalk.yellow('⚠️  Exploration is not enabled in the policy.'));
    console.log(chalk.gray('Please create an exploration policy with enabled: true'));
    return;
  }
  
  const explorer = new AutonomousExplorer(policy);
  
  // Set up event listeners for progress
  explorer.on('exploration:start', ({ sessionId }) => {
    console.log(chalk.green(`\n🔍 Starting exploration session: ${sessionId}\n`));
  });
  
  explorer.on('question:exploring', ({ question, type, remaining }) => {
    console.log(chalk.blue(`❓ [${type}] ${question}`));
    console.log(chalk.gray(`   (${remaining} questions remaining)`));
  });
  
  explorer.on('finding:discovered', ({ question, finding }) => {
    console.log(chalk.green(`   ✓ Found: ${JSON.stringify(finding.data, null, 2)}`));
    console.log(chalk.gray(`   Confidence: ${(finding.confidence * 100).toFixed(0)}%\n`));
  });
  
  explorer.on('exploration:checkpoint', ({ questionsAsked, findingsMade, currentFocus }) => {
    console.log(chalk.cyan(`\n📊 Checkpoint: ${questionsAsked} questions explored, ${findingsMade} findings made`));
    console.log(chalk.gray(`Currently exploring: ${currentFocus}\n`));
  });
  
  explorer.on('exploration:complete', ({ duration, questionsAsked, findingsMade, summary }) => {
    console.log(chalk.green('\n✨ Exploration complete!'));
    console.log(chalk.white(`Duration: ${(duration / 1000 / 60).toFixed(1)} minutes`));
    console.log(chalk.white(`Questions asked: ${questionsAsked}`));
    console.log(chalk.white(`Findings made: ${findingsMade}`));
    console.log(chalk.white('\nKnowledge Summary:'));
    console.log(JSON.stringify(summary, null, 2));
  });
  
  // Handle Ctrl+C
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\n⏸️  Stopping exploration...'));
    explorer.stop();
  });
  
  // Run the exploration with optional user prompt
  await explorer.explore(userPrompt);
}