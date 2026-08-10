import { GenerationTracker } from './generation-tracker.js';
import type { GenerationRecord } from './generation-tracker.js';
import { CloudWatchSink } from './cloudwatch-sink.js';

export { GenerationTracker } from './generation-tracker.js';
export type { GenerationRecord } from './generation-tracker.js';
export { CloudWatchSink } from './cloudwatch-sink.js';
export type { CloudWatchSinkConfig } from './cloudwatch-sink.js';
export { toGenerationRecord, failureRecord } from './record.js';
export type { RecordGenerationOptions } from './record.js';

/**
 * Facade that fans telemetry out to both persistence backends (Postgres and,
 * when enabled, CloudWatch). Both are fire-and-forget and never throw, so a
 * telemetry failure can never block or fail a generation request.
 */
export class TelemetryService {
  constructor(
    private readonly tracker: GenerationTracker,
    private readonly cloudwatch: CloudWatchSink,
  ) {}

  record(data: GenerationRecord): void {
    this.tracker.record(data);
    this.cloudwatch.sink(data);
  }
}
