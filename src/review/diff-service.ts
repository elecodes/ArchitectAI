import type { ArchitectureDocument } from '../generation/schemas.js';
import { generateArchifyIR } from '../diagrams/archify.js';
import { compareArchifyIR, compileArchifyDiffHtml, type ArchifyDiffResult } from '../diagrams/archify-diff.js';
import { createChildLogger } from '../logger.js';

const log = createChildLogger('review-diff');

export interface ReviewDiffPackage {
  diffResult: ArchifyDiffResult;
  htmlReport: string;
  summaryText: string;
}

/**
 * Compares two ArchitectureDocuments (Before vs After) and produces a review diff package.
 */
export function compareArchitectureDocuments(
  beforeDoc: ArchitectureDocument,
  afterDoc: ArchitectureDocument,
  title: string = 'Repository Architecture Diff'
): ReviewDiffPackage {
  const beforeIR = generateArchifyIR(beforeDoc, `${title} (Before)`);
  const afterIR = generateArchifyIR(afterDoc, `${title} (After)`);

  const diffResult = compareArchifyIR(beforeIR, afterIR, title);
  const htmlReport = compileArchifyDiffHtml(diffResult);

  const summaryText = `Architecture Delta: +${diffResult.summary.nodesAdded} nodes added, -${diffResult.summary.nodesRemoved} nodes removed, ~${diffResult.summary.nodesModified} nodes modified, +${diffResult.summary.edgesAdded}/-${diffResult.summary.edgesRemoved} dependencies changed.`;

  log.info(diffResult.summary, 'Review Architecture Diff package generated');

  return {
    diffResult,
    htmlReport,
    summaryText,
  };
}
