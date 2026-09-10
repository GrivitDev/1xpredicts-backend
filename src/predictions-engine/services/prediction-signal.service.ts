import { Injectable } from '@nestjs/common';

import { PredictionSignal } from '../interfaces/prediction-signal.interface';

@Injectable()
export class PredictionSignalService {
  filterAvailable(signals: PredictionSignal[]): PredictionSignal[] {
    return signals.filter(
      (signal) =>
        (signal.status as string) === 'COMPLETED' ||
        (signal.status as string) === 'PARTIAL',
    );
  }

  hasUsableSource(signals: PredictionSignal[]): boolean {
    return this.filterAvailable(signals).length > 0;
  }
}
