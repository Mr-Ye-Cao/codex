# Question Engine: Autonomous Discovery Framework

## Core Concept

A question engine inverts the traditional agent paradigm: instead of answering questions, it discovers what questions to ask. This creates a curiosity-driven system that can autonomously explore and understand its environment.

## Architecture Design

### 1. Ethical Boundaries Layer

```typescript
interface ExplorationPolicy {
  // Explicit allowlists for exploration
  allowedPaths: string[];
  excludedPaths: string[];
  
  // File type restrictions
  allowedFileTypes: string[];
  maxFileSize: number;
  
  // Privacy patterns to redact
  sensitivePatterns: RegExp[];
  
  // Time and resource limits
  maxExplorationTime: number;
  maxFilesPerSession: number;
}
```

### 2. Question Generation Engine

```typescript
interface QuestionEngine {
  // Generate questions based on discovered context
  generateQuestions(context: SystemContext): Question[];
  
  // Prioritize questions by potential insight value
  prioritizeQuestions(questions: Question[]): Question[];
  
  // Track what has been learned
  knowledgeGraph: KnowledgeGraph;
}
```

### 3. Autonomous Exploration Framework

```typescript
class AutonomousExplorer {
  private policy: ExplorationPolicy;
  private questionEngine: QuestionEngine;
  private auditLog: AuditLog;
  
  async explore(): Promise<void> {
    // Start with system-level discovery
    const systemInfo = await this.discoverSystemInfo();
    
    // Generate initial questions
    let questions = this.questionEngine.generateQuestions(systemInfo);
    
    while (questions.length > 0 && this.withinLimits()) {
      const question = questions.shift()!;
      
      // Explore based on the question
      const findings = await this.investigateQuestion(question);
      
      // Update knowledge and generate new questions
      this.questionEngine.updateKnowledge(findings);
      const newQuestions = this.questionEngine.generateQuestions(findings);
      
      // Add new questions to the queue
      questions.push(...newQuestions);
      questions = this.questionEngine.prioritizeQuestions(questions);
      
      // Log all activities
      this.auditLog.record(question, findings);
    }
  }
}
```

## Implementation Phases

### Phase 1: Consent and Configuration

Create a configuration file that explicitly defines exploration boundaries:

```yaml
# ~/.codex/exploration-policy.yaml
exploration:
  enabled: false  # Must be explicitly enabled
  
  allowed_paths:
    - "~/Documents/Projects"
    - "~/Development"
  
  excluded_paths:
    - "~/.ssh"
    - "~/.aws"
    - "*/credentials*"
    - "*/secrets*"
  
  file_types:
    allowed: [".txt", ".md", ".json", ".yaml", ".js", ".ts", ".py"]
    max_size_mb: 10
  
  privacy:
    redact_patterns:
      - "\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b"  # emails
      - "\\b(?:\\d{3}-){2}\\d{4}\\b"  # SSN-like patterns
  
  limits:
    max_hours: 2
    max_files: 1000
    max_questions_per_session: 100
```

### Phase 2: Question Types

The engine should generate different categories of questions:

1. **System Understanding**
   - "What type of development environment is this?"
   - "What are the primary tools and frameworks used?"

2. **Project Discovery**
   - "What are the main projects being worked on?"
   - "How are projects organized and structured?"

3. **Pattern Recognition**
   - "What coding patterns are commonly used?"
   - "What are the naming conventions?"

4. **Relationship Mapping**
   - "How do different components interact?"
   - "What are the dependencies between projects?"

### Phase 3: Cross-Platform Abstraction

```typescript
interface SystemAdapter {
  // OS-agnostic file operations
  listDirectory(path: string): Promise<FileInfo[]>;
  readFile(path: string): Promise<string>;
  
  // System information
  getSystemInfo(): Promise<SystemInfo>;
  getProcessList(): Promise<Process[]>;
  
  // Network information (with consent)
  getNetworkInterfaces(): Promise<NetworkInterface[]>;
}

class UnixAdapter implements SystemAdapter { /* ... */ }
class WindowsAdapter implements SystemAdapter { /* ... */ }
class CloudAdapter implements SystemAdapter { /* ... */ }
```

## Privacy-Preserving Features

1. **Differential Privacy**: Add noise to patterns discovered to prevent exact inference
2. **Federated Learning**: Learn patterns without centralizing raw data
3. **Homomorphic Analysis**: Analyze encrypted data without decryption
4. **Audit Trail**: Complete log of all explorations for review

## Example Session

```typescript
// User explicitly starts exploration with clear boundaries
codex --mode explore --config exploration-policy.yaml

// The agent might discover:
// - "This system primarily uses Node.js and Python for development"
// - "There are 3 main project categories: web apps, CLI tools, and data analysis"
// - "The user follows clean architecture patterns"
// - "Most projects use similar testing frameworks"

// All discoveries are logged and can be reviewed
codex --show-exploration-log
```

## Ethical Considerations

1. **Explicit Consent**: Never explore without clear user permission
2. **Transparency**: All discoveries are logged and reviewable
3. **Privacy First**: Sensitive data is redacted or skipped
4. **User Control**: Easy stop/pause/resume mechanisms
5. **No External Sharing**: All discoveries stay local

## Integration with Codex

This can be implemented as a new mode in the existing Codex architecture:

```typescript
// In cli.tsx
if (flags.mode === 'explore') {
  const explorer = new AutonomousExplorer(config.explorationPolicy);
  await explorer.explore();
}
```

The question engine leverages existing Codex tools but with a fundamentally different approach - it's not task-driven but curiosity-driven.