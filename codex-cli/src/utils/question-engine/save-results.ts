import type { ExplorationSession } from './types';

import fs from 'fs/promises';
import os from 'os';
import path from 'path';

export async function saveExplorationResults(
  session: ExplorationSession,
  outputPath?: string
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `exploration-${timestamp}.json`;
  
  // Default to ~/.codex/explorations/ directory
  const defaultDir = path.join(os.homedir(), '.codex', 'explorations');
  await fs.mkdir(defaultDir, { recursive: true });
  
  const filepath = outputPath || path.join(defaultDir, filename);
  
  // Create a readable report
  const report = {
    session: {
      id: session.id,
      startTime: session.startTime,
      endTime: session.endTime,
      duration: session.endTime ? 
        `${((session.endTime.getTime() - session.startTime.getTime()) / 1000 / 60).toFixed(1)} minutes` : 
        'in progress',
      questionsAsked: session.questionsAsked,
      findingsMade: session.findingsMade
    },
    findings: Array.from(session.knowledgeGraph.values()),
    insights: generateInsights(session),
    rawAuditLog: session.auditLog
  };
  
  await fs.writeFile(filepath, JSON.stringify(report, null, 2));
  return filepath;
}

function generateInsights(session: ExplorationSession): any {
  const insights = {
    filePatterns: {},
    userTraits: [],
    recommendations: []
  };
  
  // Analyze findings to generate insights
  for (const [, node] of session.knowledgeGraph) {
    // Add your insight generation logic here
  }
  
  return insights;
}

export async function saveMarkdownReport(
  session: ExplorationSession,
  summary: any,
  outputPath?: string
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `exploration-report-${timestamp}.md`;
  
  const defaultDir = path.join(os.homedir(), '.codex', 'explorations');
  await fs.mkdir(defaultDir, { recursive: true });
  
  const filepath = outputPath || path.join(defaultDir, filename);
  
  let markdown = `# Exploration Report\n\n`;
  markdown += `**Session ID:** ${session.id}\n`;
  markdown += `**Date:** ${new Date().toLocaleString()}\n`;
  markdown += `**Duration:** ${((session.endTime?.getTime() || Date.now()) - session.startTime.getTime()) / 1000 / 60} minutes\n\n`;
  
  markdown += `## Summary\n\n`;
  markdown += `- Questions Asked: ${session.questionsAsked}\n`;
  markdown += `- Findings Made: ${session.findingsMade}\n\n`;
  
  markdown += `## Discoveries\n\n`;
  
  if (summary['folder-analysis']) {
    const analysis = summary['folder-analysis'][0];
    markdown += `### File Analysis\n`;
    markdown += `- Total Files: ${analysis.totalFiles}\n`;
    markdown += `- Categories: ${JSON.stringify(analysis.categories)}\n`;
    markdown += `- Top Extensions: ${analysis.topExtensions.map(([ext, count]) => `${ext} (${count})`).join(', ')}\n\n`;
  }
  
  if (summary['temporal-analysis']) {
    const temporal = summary['temporal-analysis'][0];
    markdown += `### Activity Patterns\n`;
    markdown += `- Recent files (< 7 days): ${temporal.distribution.recent}\n`;
    markdown += `- This month: ${temporal.distribution.thisMonth}\n`;
    markdown += `- Older: ${temporal.distribution.older}\n\n`;
  }
  
  markdown += `## Raw Data\n\n`;
  markdown += '```json\n';
  markdown += JSON.stringify(summary, null, 2);
  markdown += '\n```\n';
  
  await fs.writeFile(filepath, markdown);
  return filepath;
}