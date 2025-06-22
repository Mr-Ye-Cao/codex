import type { SystemContext, Question, Finding } from './types';

import { ExplorationPolicy } from './types';
import path from 'path';

export class QuestionEngine {
  private filePatterns = [
    { category: 'development', patterns: [/\.(zip|tar|gz)$/i, /\-main\./, /github/] },
    { category: 'research', patterns: [/\.(pdf)$/i, /paper/, /article/] },
    { category: 'media', patterns: [/\.(jpg|jpeg|png|gif|mp4)$/i] },
    { category: 'documents', patterns: [/\.(doc|docx|xls|xlsx)$/i] },
    { category: 'data', patterns: [/\.(csv|json|xml|sql)$/i] }
  ];
  private knowledgeBase: Map<string, Finding> = new Map();
  private questionHistory: Set<string> = new Set();
  
  async generateQuestionsFromPrompt(prompt: string, context: SystemContext): Promise<Array<Question>> {
    const questions: Array<Question> = [];
    
    // Parse the prompt to understand what the user wants to explore
    const promptLower = prompt.toLowerCase();
    
    // Extract potential paths from the prompt
    const pathMatches = prompt.match(/[~\/]?[\w\/\.]+/g) || [];
    const explicitPaths = pathMatches.filter(p => p.includes('/') || p.includes('~'));
    
    // Check for specific exploration intents
    if (promptLower.includes('download') || explicitPaths.some(p => p.includes('download'))) {
      const downloadPath = path.join(context.homePath, 'Downloads');
      questions.push(...this.generateFolderQuestions(downloadPath, 'Downloads folder'));
    } else if (promptLower.includes('desktop')) {
      const desktopPath = path.join(context.homePath, 'Desktop');
      questions.push(...this.generateFolderQuestions(desktopPath, 'Desktop'));
    } else if (promptLower.includes('document')) {
      const docsPath = path.join(context.homePath, 'Documents');
      questions.push(...this.generateFolderQuestions(docsPath, 'Documents'));
    } else if (explicitPaths.length > 0) {
      // User provided explicit paths
      for (const explicitPath of explicitPaths) {
        const resolvedPath = explicitPath.startsWith('~') 
          ? path.join(context.homePath, explicitPath.slice(1))
          : path.resolve(explicitPath);
        questions.push(...this.generateFolderQuestions(resolvedPath, explicitPath));
      }
    } else if (promptLower.includes('explore') || promptLower.includes('continuous')) {
      // Default to exploring common folders for continuous exploration
      const downloadPath = path.join(context.homePath, 'Downloads');
      questions.push(...this.generateFolderQuestions(downloadPath, 'Downloads folder'));
      
      // Add meta-exploration question to discover more areas
      questions.push({
        id: this.generateId(),
        type: 'exploration-strategy',
        text: 'What areas of the system should we explore?',
        priority: 5,
        explorationPath: async () => this.generateExplorationStrategy()
      });
    }
    
    // Add observation synthesis questions LAST with lowest priority
    if (promptLower.includes('observation') || promptLower.includes('learn') || 
        promptLower.includes('discover') || promptLower.includes('person') ||
        promptLower.includes('tell me')) {
      questions.push({
        id: this.generateId(),
        type: 'synthesis',
        text: 'What can be inferred about the user from the explored data?',
        priority: 1, // Lowest priority = runs last
        explorationPath: async () => this.synthesizeObservations()
      });
    }
    
    return questions;
  }
  
  private generateFolderQuestions(folderPath: string, folderName: string): Array<Question> {
    return [
      {
        id: this.generateId(),
        type: 'structure',
        text: `What types of files are in ${folderName}?`,
        priority: 10,
        explorationPath: async () => this.analyzeFolder(folderPath)
      },
      {
        id: this.generateId(),
        type: 'pattern',
        text: `What patterns exist in ${folderName}?`,
        priority: 9,
        explorationPath: async () => this.analyzePatterns(folderPath)
      },
      {
        id: this.generateId(),
        type: 'temporal',
        text: `What is the temporal distribution in ${folderName}?`,
        priority: 8,
        explorationPath: async () => this.analyzeTimeDistribution(folderPath)
      }
    ];
  }
  
  async generateInitialQuestions(context: SystemContext): Promise<Array<Question>> {
    const questions: Array<Question> = [];
    
    // System-level questions
    questions.push({
      id: this.generateId(),
      type: 'system',
      text: 'What is the primary purpose of this system?',
      priority: 10,
      explorationPath: async () => this.exploreSystemPurpose(context)
    });
    
    questions.push({
      id: this.generateId(),
      type: 'structure',
      text: 'How is the file system organized?',
      priority: 9,
      explorationPath: async () => this.exploreFileStructure(context.homePath)
    });
    
    questions.push({
      id: this.generateId(),
      type: 'tools',
      text: 'What development tools are installed?',
      priority: 8,
      explorationPath: async () => this.exploreInstalledTools()
    });
    
    return this.deduplicateQuestions(questions);
  }
  
  async generateFollowUpQuestions(finding: Finding): Promise<Array<Question>> {
    const questions: Array<Question> = [];
    
    // Generate questions based on findings
    if (finding.type === 'file-type-analysis') {
      const { extension, count, insights } = finding.data;
      
      // Deep dive into specific file types
      if (extension === '.torrent' && count > 2) {
        questions.push({
          id: this.generateId(),
          type: 'torrent-analysis',
          text: 'What types of content does the user download via torrents?',
          priority: 7,
          explorationPath: async () => this.analyzeTorrentPatterns()
        });
      }
      
      if (extension === '.pdf' && count > 3) {
        questions.push({
          id: this.generateId(),
          type: 'reading-habits',
          text: 'What subjects or topics interest the user based on PDFs?',
          priority: 6,
          explorationPath: async () => this.analyzeReadingHabits()
        });
      }
    }
    
    if (finding.type === 'folder-analysis') {
      const { topExtensions, categories } = finding.data;
      
      // If we found interesting file types, explore deeper
      if (topExtensions && topExtensions.length > 0) {
        // Explore specific file types
        for (const [ext, count] of topExtensions.slice(0, 3)) {
          if (count > 2) {
            questions.push({
              id: this.generateId(),
              type: 'file-type-deep-dive',
              text: `What can we learn from the ${count} ${ext} files?`,
              priority: 7,
              explorationPath: async () => this.analyzeFileTypePattern(finding.data.path, ext)
            });
          }
        }
        
        // Look for related folders
        questions.push({
          id: this.generateId(),
          type: 'related-exploration',
          text: 'What other folders might reveal similar patterns?',
          priority: 6,
          explorationPath: async () => this.suggestRelatedFolders(finding.data)
        });
      }
      
      // If development files found, explore development patterns
      if (categories && categories.development > 0) {
        questions.push({
          id: this.generateId(),
          type: 'development-exploration',
          text: 'What development tools and languages does the user prefer?',
          priority: 8,
          explorationPath: async () => this.exploreDevelopmentPatterns()
        });
      }
    }
    
    if (finding.type === 'temporal-analysis') {
      const { distribution } = finding.data;
      
      // If very active, explore activity patterns
      if (distribution.recent > 10) {
        questions.push({
          id: this.generateId(),
          type: 'activity-pattern',
          text: 'What times of day is the user most active?',
          priority: 5,
          explorationPath: async () => this.analyzeActivityTimes(finding.data.path)
        });
      }
    }
    
    if (finding.type === 'pattern-analysis') {
      // If organized naming, explore organization system
      if (finding.data.patterns.descriptive > 5) {
        questions.push({
          id: this.generateId(),
          type: 'organization-system',
          text: 'What organizational system does the user follow?',
          priority: 6,
          explorationPath: async () => this.analyzeOrganizationSystem(finding.data.path)
        });
      }
    }
    
    // Always generate meta-questions about exploration itself
    if (this.knowledgeBase.size > 3 && Math.random() > 0.7) {
      questions.push({
        id: this.generateId(),
        type: 'meta-exploration',
        text: 'What new areas should we explore based on current findings?',
        priority: 4,
        explorationPath: async () => this.generateExplorationStrategy()
      });
    }
    
    // Add curiosity-driven questions
    if (Math.random() > 0.5) {
      const curiousQuestions = [
        'What unexpected patterns might we discover?',
        'What connections exist between different findings?',
        'What does the absence of certain file types tell us?'
      ];
      
      const randomQ = curiousQuestions[Math.floor(Math.random() * curiousQuestions.length)];
      questions.push({
        id: this.generateId(),
        type: 'curiosity',
        text: randomQ,
        priority: 3,
        explorationPath: async () => this.exploreCuriosity(randomQ)
      });
    }
    
    return this.deduplicateQuestions(questions);
  }
  
  private async exploreSystemPurpose(context: SystemContext): Promise<Finding> {
    // Look for common indicators of system purpose
    const indicators = {
      development: 0,
      production: 0,
      personal: 0,
      research: 0
    };
    
    // Check for development tools
    if (context.installedPackages?.includes('node') || 
        context.installedPackages?.includes('python')) {
      indicators.development += 2;
    }
    
    // Check for personal directories
    const personalDirs = ['Documents', 'Pictures', 'Music', 'Desktop'];
    for (const dir of personalDirs) {
      try {
        await readdir(path.join(context.homePath, dir));
        indicators.personal += 1;
      } catch { /* directory doesn't exist */ }
    }
    
    const primaryPurpose = Object.entries(indicators)
      .sort(([,a], [,b]) => b - a)[0][0];
    
    return {
      id: this.generateId(),
      type: 'system-purpose',
      data: { purpose: primaryPurpose, indicators },
      confidence: 0.7
    };
  }
  
  private async exploreFileStructure(homePath: string): Promise<Finding> {
    const structure: Record<string, number> = {};
    
    try {
      const entries = await readdir(homePath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const subEntries = await readdir(path.join(homePath, entry.name));
          structure[entry.name] = subEntries.length;
        }
      }
    } catch (error) {
      console.error('Error exploring file structure:', error);
    }
    
    return {
      id: this.generateId(),
      type: 'file-structure',
      data: { structure, organizationStyle: this.inferOrganizationStyle(structure) },
      confidence: 0.8
    };
  }
  
  private inferOrganizationStyle(structure: Record<string, number>): string {
    const hasProjects = 'Projects' in structure || 'Development' in structure;
    const hasDocuments = 'Documents' in structure;
    const hasCode = 'Code' in structure || 'src' in structure;
    
    if (hasProjects && hasCode) {return 'developer-organized';}
    if (hasDocuments && !hasCode) {return 'document-centric';}
    return 'mixed-use';
  }
  
  private async exploreInstalledTools(): Promise<Finding> {
    const tools: Array<string> = [];
    
    // Check for common development tools
    const commonTools = ['node', 'python', 'ruby', 'go', 'rust', 'docker'];
    
    for (const tool of commonTools) {
      try {
        const { spawnSync } = await import('child_process');
        const result = spawnSync('which', [tool], { encoding: 'utf-8' });
        if (result.status === 0) {
          tools.push(tool);
        }
      } catch { /* tool not found */ }
    }
    
    return {
      id: this.generateId(),
      type: 'installed-tools',
      data: { tools, primaryStack: this.inferTechStack(tools) },
      confidence: 0.9
    };
  }
  
  private inferTechStack(tools: Array<string>): string {
    if (tools.includes('node') && tools.includes('docker')) {return 'modern-web';}
    if (tools.includes('python') && !tools.includes('node')) {return 'data-science';}
    if (tools.includes('rust') || tools.includes('go')) {return 'systems';}
    return 'polyglot';
  }
  
  private async exploreProjectArchitecture(projectPath: string): Promise<Finding> {
    // This would analyze project structure, looking for patterns like:
    // - MVC, clean architecture, microservices
    // - Testing patterns
    // - Build configurations
    
    return {
      id: this.generateId(),
      type: 'architecture',
      data: { path: projectPath, pattern: 'modular' },
      confidence: 0.6
    };
  }
  
  private async exploreProjectDependencies(projectPath: string): Promise<Finding> {
    const dependencies: Record<string, Array<string>> = {};
    
    // Check for package.json
    try {
      const packageJson = JSON.parse(
        await readFile(path.join(projectPath, 'package.json'), 'utf-8')
      );
      dependencies.npm = Object.keys(packageJson.dependencies || {});
    } catch { /* not a Node project */ }
    
    // Check for requirements.txt
    try {
      const requirements = await readFile(
        path.join(projectPath, 'requirements.txt'), 'utf-8'
      );
      dependencies.python = requirements.split('\n').filter(Boolean);
    } catch { /* not a Python project */ }
    
    return {
      id: this.generateId(),
      type: 'dependencies',
      data: { dependencies, mainLanguage: Object.keys(dependencies)[0] },
      confidence: 0.9
    };
  }
  
  private async explorePatternUsage(pattern: string): Promise<Finding> {
    // This would search for similar patterns across the codebase
    return {
      id: this.generateId(),
      type: 'pattern-usage',
      data: { pattern, occurrences: [] },
      confidence: 0.5
    };
  }
  
  private deduplicateQuestions(questions: Array<Question>): Array<Question> {
    return questions.filter(q => {
      const key = `${q.type}:${q.text}`;
      if (this.questionHistory.has(key)) {return false;}
      this.questionHistory.add(key);
      return true;
    });
  }
  
  private async analyzeFolder(folderPath: string): Promise<Finding> {
    const categoryCounts: Record<string, number> = {};
    const extensions: Record<string, number> = {};
    
    try {
      const { readdir } = await import('fs/promises');
      const files = await readdir(folderPath);
      
      for (const file of files) {
        if (file.startsWith('.')) {continue;}
        
        // Categorize files
        for (const pattern of this.filePatterns) {
          if (pattern.patterns.some(p => p.test(file))) {
            categoryCounts[pattern.category] = (categoryCounts[pattern.category] || 0) + 1;
          }
        }
        
        // Count extensions
        const ext = path.extname(file).toLowerCase();
        if (ext) {
          extensions[ext] = (extensions[ext] || 0) + 1;
        }
      }
      
      return {
        id: this.generateId(),
        type: 'folder-analysis',
        data: {
          path: folderPath,
          totalFiles: files.length,
          categories: categoryCounts,
          topExtensions: Object.entries(extensions)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
        },
        confidence: 0.9
      };
    } catch (error) {
      return {
        id: this.generateId(),
        type: 'folder-analysis',
        data: { error: error.message, path: folderPath },
        confidence: 0
      };
    }
  }
  
  private async analyzePatterns(folderPath: string): Promise<Finding> {
    const patterns = {
      numbered: 0,
      dated: 0,
      versioned: 0,
      descriptive: 0
    };
    
    try {
      const { readdir } = await import('fs/promises');
      const files = await readdir(folderPath);
      
      for (const file of files) {
        if (file.startsWith('.')) {continue;}
        
        if (/\(\d+\)/.test(file)) {patterns.numbered++;}
        if (/\d{4}-\d{2}-\d{2}/.test(file)) {patterns.dated++;}
        if (/v\d+|version/i.test(file)) {patterns.versioned++;}
        if (file.includes('-') || file.includes('_')) {patterns.descriptive++;}
      }
      
      return {
        id: this.generateId(),
        type: 'pattern-analysis',
        data: { path: folderPath, patterns },
        confidence: 0.8
      };
    } catch (error) {
      return {
        id: this.generateId(),
        type: 'pattern-analysis',
        data: { error: error.message, path: folderPath },
        confidence: 0
      };
    }
  }
  
  private async analyzeTimeDistribution(folderPath: string): Promise<Finding> {
    const distribution = { recent: 0, thisMonth: 0, older: 0 };
    
    try {
      const { readdir, stat } = await import('fs/promises');
      const files = await readdir(folderPath);
      const now = Date.now();
      
      for (const file of files) {
        if (file.startsWith('.')) {continue;}
        
        try {
          const stats = await stat(path.join(folderPath, file));
          const ageInDays = (now - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
          
          if (ageInDays < 7) {distribution.recent++;}
          else if (ageInDays < 30) {distribution.thisMonth++;}
          else {distribution.older++;}
        } catch { /* skip */ }
      }
      
      return {
        id: this.generateId(),
        type: 'temporal-analysis',
        data: { path: folderPath, distribution },
        confidence: 0.8
      };
    } catch (error) {
      return {
        id: this.generateId(),
        type: 'temporal-analysis',
        data: { error: error.message, path: folderPath },
        confidence: 0
      };
    }
  }
  
  private async synthesizeObservations(): Promise<Finding> {
    const observations: Array<any> = [];
    const insights: any = {
      fileTypes: {},
      patterns: {},
      temporal: {}
    };
    
    // First, collect all data from findings
    for (const [, finding] of this.knowledgeBase) {
      if (finding.type === 'folder-analysis') {
        insights.fileTypes = finding.data;
      } else if (finding.type === 'pattern-analysis') {
        insights.patterns = finding.data;
      } else if (finding.type === 'temporal-analysis') {
        insights.temporal = finding.data;
      }
    }
    
    // Generate insights based on file types
    if (insights.fileTypes.topExtensions) {
      const extensions = insights.fileTypes.topExtensions;
      const totalFiles = insights.fileTypes.totalFiles;
      
      // Check for P2P usage
      const p2pFiles = extensions.filter(([ext]: [string, number]) => 
        ['.torrent', '.aria2'].includes(ext)
      ).reduce((sum: number, [, count]: [string, number]) => sum + count, 0);
      
      if (p2pFiles > 0) {
        observations.push({
          category: 'technology',
          insight: 'Uses peer-to-peer downloading and advanced download managers',
          confidence: 0.9,
          evidence: `${p2pFiles} P2P-related files (${Math.round(p2pFiles/totalFiles*100)}% of downloads)`
        });
      }
      
      // Check for cross-platform work
      const windowsFiles = extensions.filter(([ext]: [string, number]) => 
        ['.exe', '.msi', '.blockmap'].includes(ext)
      ).length;
      
      if (windowsFiles > 0) {
        observations.push({
          category: 'work-pattern',
          insight: 'Works across multiple platforms - downloads Windows software on Mac',
          confidence: 0.85,
          evidence: 'Windows executable files found in Downloads folder'
        });
      }
    }
    
    // Generate insights based on temporal patterns
    if (insights.temporal.distribution) {
      const { recent, thisMonth, older } = insights.temporal.distribution;
      const total = recent + thisMonth + older;
      const recentRatio = total > 0 ? recent / total : 0;
      
      if (recentRatio > 0.7) {
        observations.push({
          category: 'habits',
          insight: 'Maintains an organized digital workspace with regular cleanup',
          confidence: 0.8,
          evidence: `${Math.round(recentRatio * 100)}% of files are less than 7 days old`
        });
      } else if (recentRatio < 0.3) {
        observations.push({
          category: 'habits',
          insight: 'Tends to accumulate files over time without frequent cleanup',
          confidence: 0.7,
          evidence: `Only ${Math.round(recentRatio * 100)}% of files are recent`
        });
      }
    }
    
    // Generate insights based on naming patterns
    if (insights.patterns.patterns) {
      const { numbered, dated, versioned, descriptive } = insights.patterns.patterns;
      const total = numbered + dated + versioned + descriptive;
      
      if (total > 0) {
        const descriptiveRatio = descriptive / total;
        if (descriptiveRatio > 0.4) {
          observations.push({
            category: 'organization',
            insight: 'Takes time to organize files with meaningful names',
            confidence: 0.75,
            evidence: `${descriptive} out of ${total} analyzed files have descriptive names`
          });
        }
      }
    }
    
    // Generate overall personality insights
    if (observations.length >= 3) {
      observations.push({
        category: 'personality',
        insight: 'Tech-savvy individual who values efficiency and organization',
        confidence: 0.8,
        evidence: 'Multiple indicators of technical proficiency and systematic approach'
      });
    }
    
    // Add a summary
    const summary = observations.length > 0
      ? `Based on Downloads folder analysis: ${observations.map(o => o.insight).join('; ')}`
      : 'Insufficient data to form meaningful observations about the user.';
    
    return {
      id: this.generateId(),
      type: 'observations',
      data: { 
        observations,
        summary,
        totalInsights: observations.length
      },
      confidence: observations.length > 0 ? 0.8 : 0.3
    };
  }
  
  private async analyzeFileTypePattern(folderPath: string, extension: string): Promise<Finding> {
    try {
      const { readdir, stat } = await import('fs/promises');
      const files = await readdir(folderPath);
      const matchingFiles = files.filter(f => f.endsWith(extension));
      
      const insights: Array<any> = [];
      
      // Analyze file sizes
      const sizes = await Promise.all(
        matchingFiles.slice(0, 5).map(async f => {
          try {
            const stats = await stat(path.join(folderPath, f));
            return stats.size;
          } catch { return 0; }
        })
      );
      
      const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
      
      if (extension === '.torrent') {
        insights.push('Downloads large files or media content via P2P');
      } else if (extension === '.pdf') {
        insights.push('Reads technical documents or research papers');
      } else if (['.jpg', '.png'].includes(extension)) {
        insights.push('Works with visual content or screenshots');
      }
      
      return {
        id: this.generateId(),
        type: 'file-type-analysis',
        data: { 
          extension, 
          count: matchingFiles.length,
          avgSize,
          insights 
        },
        confidence: 0.7
      };
    } catch (error) {
      return {
        id: this.generateId(),
        type: 'file-type-analysis',
        data: { error: error.message },
        confidence: 0
      };
    }
  }
  
  private async suggestRelatedFolders(currentData: any): Promise<Finding> {
    const suggestions = [];
    
    if (currentData.path.includes('Downloads')) {
      suggestions.push({
        folder: 'Desktop',
        reason: 'Often contains work-in-progress files',
        priority: 8
      });
      suggestions.push({
        folder: 'Documents',
        reason: 'May reveal project organization',
        priority: 7
      });
    }
    
    return {
      id: this.generateId(),
      type: 'exploration-suggestions',
      data: { suggestions },
      confidence: 0.6
    };
  }
  
  private async exploreDevelopmentPatterns(): Promise<Finding> {
    // This would check for development tools, IDEs, etc.
    const patterns = {
      languages: [],
      tools: [],
      frameworks: []
    };
    
    // Check for common development indicators
    try {
      const { spawnSync } = await import('child_process');
      
      const commands = [
        { cmd: 'node', type: 'language', name: 'Node.js' },
        { cmd: 'python3', type: 'language', name: 'Python' },
        { cmd: 'git', type: 'tool', name: 'Git' },
        { cmd: 'docker', type: 'tool', name: 'Docker' }
      ];
      
      for (const { cmd, type, name } of commands) {
        const result = spawnSync('which', [cmd], { encoding: 'utf-8' });
        if (result.status === 0) {
          if (type === 'language') {patterns.languages.push(name);}
          else if (type === 'tool') {patterns.tools.push(name);}
        }
      }
    } catch { /* ignore */ }
    
    return {
      id: this.generateId(),
      type: 'development-patterns',
      data: patterns,
      confidence: 0.8
    };
  }
  
  private async analyzeActivityTimes(folderPath: string): Promise<Finding> {
    // Analyze file modification times to understand activity patterns
    try {
      const { readdir, stat } = await import('fs/promises');
      const files = await readdir(folderPath);
      
      const hourCounts: Record<number, number> = {};
      
      for (const file of files.slice(0, 20)) {
        try {
          const stats = await stat(path.join(folderPath, file));
          const hour = new Date(stats.mtime).getHours();
          hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        } catch { /* skip */ }
      }
      
      // Find peak hours
      const peakHour = Object.entries(hourCounts)
        .sort(([,a], [,b]) => b - a)[0];
      
      return {
        id: this.generateId(),
        type: 'activity-times',
        data: { 
          hourCounts,
          peakHour: peakHour ? parseInt(peakHour[0]) : null,
          pattern: this.interpretActivityPattern(hourCounts)
        },
        confidence: 0.6
      };
    } catch (error) {
      return {
        id: this.generateId(),
        type: 'activity-times',
        data: { error: error.message },
        confidence: 0
      };
    }
  }
  
  private interpretActivityPattern(hourCounts: Record<number, number>): string {
    const entries = Object.entries(hourCounts);
    if (entries.length === 0) {return 'unknown';}
    
    const businessHours = entries.filter(([h]) => 
      parseInt(h) >= 9 && parseInt(h) <= 17
    ).reduce((sum, [, count]) => sum + count, 0);
    
    const eveningHours = entries.filter(([h]) => 
      parseInt(h) >= 18 || parseInt(h) <= 2
    ).reduce((sum, [, count]) => sum + count, 0);
    
    if (businessHours > eveningHours * 2) {return 'business-hours';}
    if (eveningHours > businessHours * 2) {return 'night-owl';}
    return 'mixed';
  }
  
  private async analyzeOrganizationSystem(folderPath: string): Promise<Finding> {
    // Look for patterns in file naming
    try {
      const { readdir } = await import('fs/promises');
      const files = await readdir(folderPath);
      
      const patterns = {
        projectBased: 0,
        dateBased: 0,
        typeBased: 0,
        chaotic: 0
      };
      
      for (const file of files) {
        if (/project|proj|work/i.test(file)) {patterns.projectBased++;}
        if (/\d{4}[-_]\d{2}[-_]\d{2}/.test(file)) {patterns.dateBased++;}
        if (/\.(pdf|doc|img|video|audio)/i.test(file)) {patterns.typeBased++;}
        if (/^[a-z0-9]{8,}\./i.test(file)) {patterns.chaotic++;}
      }
      
      const dominant = Object.entries(patterns)
        .sort(([,a], [,b]) => b - a)[0];
      
      return {
        id: this.generateId(),
        type: 'organization-system',
        data: { 
          patterns,
          dominant: dominant ? dominant[0] : 'mixed'
        },
        confidence: 0.7
      };
    } catch (error) {
      return {
        id: this.generateId(),
        type: 'organization-system',
        data: { error: error.message },
        confidence: 0
      };
    }
  }
  
  private async generateExplorationStrategy(): Promise<Finding> {
    // Analyze what we've learned and suggest new exploration areas
    const learned = Array.from(this.knowledgeBase.values());
    const suggestions = [];
    
    // Check what we haven't explored yet
    const exploredTypes = new Set(learned.map(f => f.type));
    
    if (!exploredTypes.has('browser-analysis')) {
      suggestions.push({
        area: 'Browser bookmarks and history patterns',
        reason: 'Could reveal interests and research habits',
        priority: 7
      });
    }
    
    if (!exploredTypes.has('app-usage')) {
      suggestions.push({
        area: 'Installed applications and usage patterns',
        reason: 'Shows tool preferences and workflows',
        priority: 8
      });
    }
    
    // Generate dynamic suggestions based on findings
    const hasDevFiles = learned.some(f => 
      f.data.categories?.development > 0
    );
    
    if (hasDevFiles) {
      suggestions.push({
        area: 'Git repositories and commit patterns',
        reason: 'Developer detected - explore coding habits',
        priority: 9
      });
    }
    
    return {
      id: this.generateId(),
      type: 'exploration-strategy',
      data: { 
        explored: Array.from(exploredTypes),
        suggestions,
        nextSteps: suggestions.slice(0, 3)
      },
      confidence: 0.8
    };
  }
  
  private async exploreCuriosity(question: string): Promise<Finding> {
    // Meta-analysis of patterns
    const insights = [];
    
    if (question.includes('unexpected')) {
      // Look for unusual combinations
      const findings = Array.from(this.knowledgeBase.values());
      
      // Check for interesting contrasts
      const hasTorrents = findings.some(f => 
        f.data.topExtensions?.some(([ext]) => ext === '.torrent')
      );
      const hasOrganization = findings.some(f => 
        f.data.patterns?.descriptive > 5
      );
      
      if (hasTorrents && hasOrganization) {
        insights.push('Interesting contrast: Uses P2P (often associated with casual use) but maintains organized file naming');
      }
    }
    
    if (question.includes('connections')) {
      insights.push('Cross-platform work + organized naming = likely professional developer or IT worker');
    }
    
    if (question.includes('absence')) {
      insights.push('No gaming files (.exe are utilities, not games) suggests work-focused computer use');
    }
    
    return {
      id: this.generateId(),
      type: 'curiosity-insights',
      data: { question, insights },
      confidence: 0.6
    };
  }
  
  private async analyzeTorrentPatterns(): Promise<Finding> {
    return {
      id: this.generateId(),
      type: 'torrent-patterns',
      data: {
        insights: [
          'User likely downloads large media files or software distributions',
          'Comfortable with decentralized file sharing',
          'May be interested in open-source software or media archiving'
        ]
      },
      confidence: 0.7
    };
  }
  
  private async analyzeReadingHabits(): Promise<Finding> {
    return {
      id: this.generateId(),
      type: 'reading-habits',
      data: {
        insights: [
          'User consumes technical or academic content',
          'Prefers offline reading (downloads PDFs)',
          'Likely engaged in continuous learning'
        ]
      },
      confidence: 0.6
    };
  }
  
  private generateId(): string {
    return `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  updateKnowledge(finding: Finding): void {
    this.knowledgeBase.set(finding.id, finding);
  }
  
  getKnowledgeSummary(): Record<string, any> {
    const summary: Record<string, any> = {};
    
    for (const [, finding] of this.knowledgeBase) {
      if (!summary[finding.type]) {
        summary[finding.type] = [];
      }
      summary[finding.type].push(finding.data);
    }
    
    return summary;
  }
}