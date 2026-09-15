export interface PredictionTriggerResult {
  queued: number;
  alreadyQueued: number;
  skipped: number;
  total: number;
  workerStarted: boolean;
}
