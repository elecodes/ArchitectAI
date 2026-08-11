import type { LLMClient } from '../llm/interface.js';
import type { LoadedPrompt } from '../prompts/loader.js';
import { ContextWindowManager } from '../generation/context-window.js';
import { OutputValidator } from '../generation/output-validator.js';
import { generateWithValidation } from '../generation/retry.js';
import { importRepository, type RepositoryImport } from './repository.js';
import { detectTechnology, type TechnologyReport } from './detector.js';
import {
  ProjectSummarySchema,
  EngineeringReviewSchema,
  ImprovementsSchema,
  type ProjectSummary,
  type EngineeringReview,
  type Improvements,
} from './schemas.js';
import { createChildLogger } from '../logger.js';

const log = createChildLogger('review-pipeline');

export interface ReviewInput {
  path: string;
  customIgnore?: string[];
}

export interface ReviewResult {
  repository: RepositoryImport;
  technology: TechnologyReport;
  summary: ProjectSummary;
  review: EngineeringReview;
  improvements: Improvements;
  provenance: {
    model: string;
    promptVersions: string[];
    generatedAt: string;
    totalDurationMs: number;
  };
}

export class ReviewPipeline {
  private readonly validator = new OutputValidator();
  private readonly contextManager: ContextWindowManager;

  constructor(
    private readonly llm: LLMClient,
    private readonly prompts: Map<string, LoadedPrompt>,
    private readonly model: string,
    contextWindow: number,
  ) {
    this.contextManager = new ContextWindowManager(contextWindow);
  }

  async review(input: ReviewInput): Promise<ReviewResult> {
    const startTime = Date.now();

    // Step 1: Import repository (static, no LLM)
    log.info({ path: input.path }, 'Importing repository');
    const repository = importRepository(input.path, input.customIgnore);

    // Step 2: Detect technology (static, no LLM)
    const technology = detectTechnology(repository);

    // Step 3: Build context for LLM (file structure + key files)
    const contextText = this.buildContext(repository, technology);

    // Step 4: Generate project summary
    log.info('Generating project summary');
    const summary = await this.generateStep('review-summary', contextText, ProjectSummarySchema);

    // Step 5: Generate engineering review
    log.info('Generating engineering review');
    const review = await this.generateStep(
      'review-engineering',
      contextText + '\n\nProject Summary:\n' + JSON.stringify(summary, null, 2),
      EngineeringReviewSchema,
    );

    // Step 6: Generate improvements
    log.info('Generating improvement suggestions');
    const improvements = await this.generateStep(
      'review-improvements',
      contextText + '\n\nEngineering Review:\n' + JSON.stringify(review, null, 2),
      ImprovementsSchema,
    );

    const totalDurationMs = Date.now() - startTime;
    log.info({ totalDurationMs, files: repository.totalFiles }, 'Review complete');

    return {
      repository,
      technology,
      summary,
      review,
      improvements,
      provenance: {
        model: this.model,
        promptVersions: ['review-summary-v1', 'review-engineering-v1', 'review-improvements-v1'],
        generatedAt: new Date().toISOString(),
        totalDurationMs,
      },
    };
  }

  private async generateStep<T>(
    promptName: string,
    context: string,
    schema: import('zod').ZodType<T>,
  ): Promise<T> {
    const prompt = this.prompts.get(promptName);
    if (!prompt) throw new Error(`Prompt "${promptName}" not loaded`);
    const retryPrompt = this.prompts.get('retry');
    if (!retryPrompt) throw new Error('Retry prompt not loaded');

    // Fit context to window
    const userInput =
      '<CONTEXT>\n' +
      context +
      '\n</CONTEXT>\n\n<USER_INPUT>\nReview this codebase.\n</USER_INPUT>';
    const fitResult = this.contextManager.fitToContext({
      systemPrompt: prompt.content,
      userInput,
      ragChunks: [],
    });

    // Truncate context if needed (take first N chars that fit)
    const maxContextChars = fitResult.budget.availableForRAG * 4;
    const fittedContext =
      context.length > maxContextChars
        ? context.slice(0, maxContextChars) + '\n...[truncated]'
        : context;
    const assembledPrompt =
      '<CONTEXT>\n' +
      fittedContext +
      '\n</CONTEXT>\n\n<USER_INPUT>\nReview this codebase.\n</USER_INPUT>';

    const result = await generateWithValidation(
      this.llm,
      {
        systemPrompt: prompt.content,
        prompt: assembledPrompt,
        temperature: 0.3,
        maxTokens: 4096,
      },
      schema,
      this.validator,
      retryPrompt,
    );

    return result.data;
  }

  private buildContext(repo: RepositoryImport, tech: TechnologyReport): string {
    let context = '# Technology Report\n';
    context += `Primary Language: ${tech.primaryLanguage}\n`;
    context += `Frameworks: ${tech.frameworks.join(', ') || 'None detected'}\n`;
    context += `Databases: ${tech.databases.join(', ') || 'None detected'}\n`;
    context += `Testing: ${tech.testing.join(', ') || 'None detected'}\n`;
    context += `Docker: ${tech.docker ? 'Yes' : 'No'}\n`;
    context += `CI/CD: ${tech.cicd.join(', ') || 'None detected'}\n`;
    context += `TypeScript: ${tech.typescript ? 'Yes' : 'No'}\n\n`;

    context += '# File Structure\n';
    // Group files by top-level folder
    const folders = new Map<string, string[]>();
    for (const file of repo.files) {
      const parts = file.path.split('/');
      const folder = parts.length > 1 ? parts[0] : '.';
      if (!folders.has(folder)) folders.set(folder, []);
      folders.get(folder)!.push(file.path);
    }
    for (const [folder, files] of folders) {
      context += `## ${folder}/ (${files.length} files)\n`;
      files.slice(0, 10).forEach((f) => {
        context += `  ${f}\n`;
      });
      if (files.length > 10) context += `  ... and ${files.length - 10} more\n`;
    }

    context += '\n# Key File Contents\n';
    // Include important files (README, package.json, main entry) — config files
    // are excluded because they often contain secrets (API keys, endpoints).
    const keyFiles = repo.files
      .filter(
        (f) =>
          f.path === 'README.md' ||
          f.path === 'package.json' ||
          f.path.includes('index.ts') ||
          f.path.includes('index.js') ||
          f.path.includes('main.ts') ||
          f.path.includes('app.ts'),
      )
      .slice(0, 8);

    for (const file of keyFiles) {
      const truncated =
        file.content.length > 2000
          ? file.content.slice(0, 2000) + '\n...[truncated]'
          : file.content;
      context += `\n## ${file.path}\n\`\`\`\n${truncated}\n\`\`\`\n`;
    }

    return context;
  }
}
