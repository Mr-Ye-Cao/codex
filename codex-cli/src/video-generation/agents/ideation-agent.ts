/**
 * Topic Ideation Agent
 * Generates novel and interesting educational topics based on user input
 */

import { BaseAgent } from './base-agent';

export interface IdeationInput {
  topic: string;
  numberOfIdeas?: number;
  focusAreas?: string[];
}

export interface IdeationOutput {
  ideas: Array<{
    id: number;
    title: string;
    description: string;
    visualPotential: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    estimatedDuration: number;
    keyPoints: string[];
  }>;
}

export class IdeationAgent extends BaseAgent {
  async execute(inputs: Record<string, any>): Promise<Record<string, any>> {
    const { topic, numberOfIdeas = 5, focusAreas = [] } = inputs as IdeationInput;
    
    const prompt = this.buildPrompt(topic, numberOfIdeas, focusAreas);
    const response = await this.sendMessage(prompt);
    
    try {
      const ideas = this.parseJSON(response.content);
      
      // Validate and format the ideas
      const formattedIdeas = this.formatIdeas(ideas);
      
      // Save ideas to file for reference
      const ideasFile = await this.saveToFile(
        'ideation/ideas.json',
        JSON.stringify(formattedIdeas, null, 2)
      );
      
      return {
        ideas: formattedIdeas,
        ideasFile
      };
    } catch (error) {
      console.error('Failed to parse ideation response:', error);
      throw new Error('Failed to generate topic ideas');
    }
  }
  
  private buildPrompt(topic: string, numberOfIdeas: number, focusAreas: string[]): string {
    let prompt = `Generate ${numberOfIdeas} novel and educational video ideas related to "${topic}".`;
    
    if (focusAreas.length > 0) {
      prompt += ` Focus particularly on these areas: ${focusAreas.join(', ')}.`;
    }
    
    prompt += `

For each idea, provide:
1. A compelling title
2. A detailed description (2-3 sentences)
3. Visual potential - explain what makes this topic great for animation
4. Difficulty level (beginner/intermediate/advanced)
5. Estimated duration in seconds for a comprehensive explanation
6. 3-5 key points that would be covered

Focus on topics that:
- Have high visual appeal and benefit from animation
- Can be explained clearly within the time constraint
- Offer genuine educational value
- Haven't been extensively covered in popular science videos

Return the ideas as a JSON array with the following structure:
{
  "ideas": [
    {
      "id": 1,
      "title": "Title here",
      "description": "Description here",
      "visualPotential": "Why this is visually interesting",
      "difficulty": "intermediate",
      "estimatedDuration": 45,
      "keyPoints": ["Point 1", "Point 2", "Point 3"]
    }
  ]
}`;
    
    return prompt;
  }
  
  private formatIdeas(rawIdeas: any): IdeationOutput['ideas'] {
    const ideas = rawIdeas.ideas || rawIdeas;
    
    if (!Array.isArray(ideas)) {
      throw new Error('Expected ideas to be an array');
    }
    
    return ideas.map((idea: any, index: number) => ({
      id: idea.id || index + 1,
      title: idea.title || 'Untitled',
      description: idea.description || '',
      visualPotential: idea.visualPotential || '',
      difficulty: this.validateDifficulty(idea.difficulty),
      estimatedDuration: idea.estimatedDuration || 30,
      keyPoints: Array.isArray(idea.keyPoints) ? idea.keyPoints : []
    }));
  }
  
  private validateDifficulty(difficulty: string): 'beginner' | 'intermediate' | 'advanced' {
    const valid = ['beginner', 'intermediate', 'advanced'];
    return valid.includes(difficulty) ? difficulty as any : 'intermediate';
  }
  
  /**
   * Generate follow-up ideas based on a selected idea
   */
  async generateVariations(ideaId: number, originalIdeas: IdeationOutput['ideas']): Promise<IdeationOutput> {
    const selectedIdea = originalIdeas.find(idea => idea.id === ideaId);
    if (!selectedIdea) {
      throw new Error(`Idea with ID ${ideaId} not found`);
    }
    
    const prompt = `Based on this educational video idea:
Title: ${selectedIdea.title}
Description: ${selectedIdea.description}

Generate 3 variations or related topics that:
1. Explore different aspects of the same concept
2. Approach it from different angles or perspectives
3. Target different difficulty levels or audiences

Use the same JSON format as before.`;
    
    const response = await this.sendMessage(prompt);
    const variations = this.parseJSON(response.content);
    
    return {
      ideas: this.formatIdeas(variations)
    };
  }
}