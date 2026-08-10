import { describe, it, expect, vi } from 'vitest';

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock('@aws-sdk/client-cloudwatch', () => ({
  CloudWatchClient: vi.fn().mockImplementation(() => ({ send: sendMock })),
  PutMetricDataCommand: vi.fn().mockImplementation((input: unknown) => ({ input })),
}));

import { CloudWatchSink } from '../../src/telemetry/cloudwatch-sink.js';
import type { GenerationRecord } from '../../src/telemetry/generation-tracker.js';

const record: GenerationRecord = {
  module: 'spec',
  provider: 'bedrock',
  model: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
  promptVersion: 'spec-v1',
  generationDurationMs: 100,
  embeddingDurationMs: 5,
  retrievalDurationMs: 10,
  totalDurationMs: 115,
  promptTokens: 1000,
  completionTokens: 500,
  totalTokens: 1500,
  retrievedChunks: 3,
  fittedChunks: 2,
  truncated: false,
  similarityScores: [0.8, 0.7, 0.6],
  contextWindowSize: 128000,
  contextWindowUsed: 12000,
  status: 'success',
  retryCount: 0,
};

describe('CloudWatchSink', () => {
  it('does nothing when disabled', async () => {
    sendMock.mockReset();
    const sink = new CloudWatchSink({ enabled: false, namespace: 'ArchitectAI' });
    await sink.sink(record);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('sends metric data when enabled', async () => {
    sendMock.mockReset().mockResolvedValue({});
    const sink = new CloudWatchSink({
      enabled: true,
      namespace: 'ArchitectAI',
      region: 'us-east-1',
    });
    await sink.sink(record);

    expect(sendMock).toHaveBeenCalledTimes(1);
    const cmd = sendMock.mock.calls[0][0];
    expect(cmd.input.Namespace).toBe('ArchitectAI');
    expect(cmd.input.MetricData).toHaveLength(10);

    const totalDuration = cmd.input.MetricData.find(
      (m: { MetricName: string }) => m.MetricName === 'TotalDuration',
    );
    expect(totalDuration.Value).toBe(115);
    expect(totalDuration.Unit).toBe('Milliseconds');
    expect(totalDuration.Dimensions).toContainEqual({ Name: 'Provider', Value: 'bedrock' });
    expect(totalDuration.Dimensions).toContainEqual({ Name: 'Module', Value: 'spec' });

    const tokens = cmd.input.MetricData.find(
      (m: { MetricName: string }) => m.MetricName === 'TotalTokens',
    );
    expect(tokens.Value).toBe(1500);
    expect(tokens.Unit).toBe('Count');
  });

  it('never throws when the API call fails', async () => {
    sendMock.mockReset().mockRejectedValue({ name: 'ThrottlingException' });
    const sink = new CloudWatchSink({ enabled: true, namespace: 'ArchitectAI' });
    await expect(sink.sink(record)).resolves.toBeUndefined();
  });
});
