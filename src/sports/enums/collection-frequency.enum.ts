export enum CollectionFrequency {
  /**
   * Very stable metadata.
   */
  MONTHLY = 'MONTHLY',

  /**
   * Fixture/schedule information.
   */
  WEEKLY = 'WEEKLY',

  /**
   * Results, standings and normal football information.
   */
  DAILY = 'DAILY',

  /**
   * Important matches requiring additional refreshes.
   */
  TARGETED = 'TARGETED',

  /**
   * Only collect when the competition is active.
   */
  SEASONAL = 'SEASONAL',
}
