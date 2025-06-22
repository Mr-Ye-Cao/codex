export interface ExplorationPolicy {
  enabled: boolean;
  allowedPaths: Array<string>;
  excludedPaths: Array<string>;
  allowedFileTypes: Array<string>;
  maxFileSize: number;
  sensitivePatterns: Array<RegExp>;
  maxExplorationTime: number;
  maxFilesPerSession: number;
  maxQuestionsPerSession: number;
}

export interface SystemContext {
  platform: NodeJS.Platform;
  homePath: string;
  currentPath: string;
  username: string;
  hostname: string;
  installedPackages?: Array<string>;
  environment: Record<string, string | undefined>;
}

export interface Question {
  id: string;
  type: 'system' | 'structure' | 'tools' | 'project' | 'pattern' | 'relationship' | 
        'project-detail' | 'dependencies' | 'pattern-usage';
  text: string;
  priority: number;
  explorationPath: () => Promise<Finding>;
  context?: any;
}

export interface Finding {
  id: string;
  type: string;
  data: any;
  confidence: number;
  timestamp?: number;
  relatedQuestions?: Array<string>;
}

export interface KnowledgeNode {
  id: string;
  type: string;
  data: any;
  relationships: Array<{
    targetId: string;
    relationshipType: string;
    strength: number;
  }>;
}

export interface ExplorationSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  questionsAsked: number;
  findingsMade: number;
  knowledgeGraph: Map<string, KnowledgeNode>;
  auditLog: Array<AuditEntry>;
}

export interface AuditEntry {
  timestamp: Date;
  action: 'explore' | 'read' | 'analyze' | 'infer';
  target: string;
  result: 'success' | 'failed' | 'skipped';
  reason?: string;
  finding?: Finding;
}