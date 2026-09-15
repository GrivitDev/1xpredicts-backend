export const PREDICTION_DECISION_CONFIG = {
  probability: {
    minimumCandidate: 0.55,
    minimumPublishable: 0.7,

    preferred: 0.7,
    strong: 0.8,
    exceptional: 0.9,
  },

  confidence: {
    minimumCandidate: 50,
    minimumPublishable: 65,

    meaningful: 70,
    strong: 80,
    veryStrong: 90,
    critical: 95,
    maximum: 98,
  },

  safety: {
    minimumCandidate: 55,
    minimumPublishable: 65,

    preferred: 70,
    strong: 80,
    exceptional: 90,
  },

  agreement: {
    minimumCandidate: 0.5,
    minimumPublishable: 0.6,

    preferred: 0.65,
    strong: 0.8,
    exceptional: 0.9,
  },

  dataQuality: {
    minimumCandidate: 50,
    minimumPublishable: 60,

    preferred: 70,
    strong: 80,
    exceptional: 90,
  },

  calibration: {
    minimumReliabilityCandidate: 0,
    minimumReliabilityPublishable: 50,

    preferredReliability: 70,
    strongReliability: 80,
    exceptionalReliability: 90,
  },

  risk: {
    low: {
      minimumProbability: 0.8,
      minimumConfidence: 80,
      minimumSafetyScore: 80,
      minimumModelAgreement: 0.75,
      minimumDataQuality: 75,
      minimumCalibrationReliability: 70,
    },

    medium: {
      minimumProbability: 0.68,
      minimumConfidence: 65,
      minimumSafetyScore: 65,
      minimumModelAgreement: 0.6,
      minimumDataQuality: 60,
      minimumCalibrationReliability: 55,
    },
  },

  selection: {
    minimumDecisionScore: 0.6,
  },
} as const;
