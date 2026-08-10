import type { GenerationRecord } from './generation-tracker.js';
import { createChildLogger } from '../logger.js';

const log = createChildLogger('telemetry-cloudwatch');

export interface CloudWatchSinkConfig {
  enabled: boolean;
  region?: string;
  namespace: string;
}

/**
 * Forwards generation telemetry to Amazon CloudWatch via PutMetricData.
 * Off by default (CLOUDWATCH_ENABLED=false). Credentials come from the AWS SDK
 * default credential provider chain — never from config. Fire-and-forget: a
 * sink failure never blocks or fails generation.
 */
export class CloudWatchSink {
  constructor(private readonly config: CloudWatchSinkConfig) {}

  async sink(record: GenerationRecord): Promise<void> {
    if (!this.config.enabled) return;

    try {
      const { CloudWatchClient, PutMetricDataCommand } = await import('@aws-sdk/client-cloudwatch');
      const client = new CloudWatchClient({
        region: this.config.region || undefined,
      });
      await client.send(
        new PutMetricDataCommand({
          Namespace: this.config.namespace,
          MetricData: this.buildMetrics(record),
        }),
      );
      log.info({ module: record.module, status: record.status }, 'Telemetry sent to CloudWatch');
    } catch (err) {
      // Telemetry must never block generation
      log.error({ err: (err as Error).message }, 'Failed to send telemetry to CloudWatch');
    }
  }

  private buildMetrics(record: GenerationRecord) {
    const dimensions = [
      { Name: 'Module', Value: record.module },
      { Name: 'Model', Value: record.model },
      { Name: 'Provider', Value: record.provider || 'local' },
      { Name: 'Status', Value: record.status },
    ];
    const data = [
      ['GenerationDuration', record.generationDurationMs],
      ['EmbeddingDuration', record.embeddingDurationMs],
      ['RetrievalDuration', record.retrievalDurationMs],
      ['TotalDuration', record.totalDurationMs],
      ['PromptTokens', record.promptTokens],
      ['CompletionTokens', record.completionTokens],
      ['TotalTokens', record.totalTokens],
      ['RetrievedChunks', record.retrievedChunks],
      ['FittedChunks', record.fittedChunks],
      ['ContextWindowUsed', record.contextWindowUsed],
    ] as const;
    return data.map(([metric, value]) => ({
      MetricName: metric,
      Value: value,
      Unit: metric.endsWith('Duration')
        ? ('Milliseconds' as const)
        : ('Count' as const),
      Dimensions: dimensions,
      Timestamp: new Date(),
    }));
  }
}
