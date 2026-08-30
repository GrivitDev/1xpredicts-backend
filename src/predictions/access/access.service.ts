import { Injectable } from '@nestjs/common';

import { SubscriptionsService } from '../../subscriptions/subscriptions.service';

import { PredictionPurchasesService } from '../../prediction-purchases/prediction-purchases.service';

import { PredictionPreviewService } from '../prediction-preview.service';

import { PlanLevels } from '../constants/plan-levels';

import { PredictionAccessRules } from '../constants/access-rules';

// ============================================================
// TYPES
// ============================================================

interface User {
  _id: {
    toString(): string;
  };
}

interface Prediction {
  accessType: 'free' | 'regular' | 'vip';

  kickoffTimestamp: number;

  _id: {
    toString(): string;
  };
}

// ============================================================
// SERVICE
// ============================================================

@Injectable()
export class AccessService {
  constructor(
    private readonly subscriptionService: SubscriptionsService,

    private readonly purchaseService: PredictionPurchasesService,

    private readonly previewService: PredictionPreviewService,
  ) {}

  // ==========================================================
  // HOURS LEFT
  // ==========================================================

  private getHoursLeft(kickoffTimestamp: number) {
    return (kickoffTimestamp - Date.now()) / (1000 * 60 * 60);
  }

  // ==========================================================
  // RELEASE DATA
  // ==========================================================

  private getReleaseData(
    kickoffTimestamp: number,

    releaseHoursBeforeKickoff: number,
  ) {
    const releaseAt =
      kickoffTimestamp - releaseHoursBeforeKickoff * 60 * 60 * 1000;

    return {
      releaseAt,

      released: Date.now() >= releaseAt,
    };
  }

  // ==========================================================
  // ACCESS CHECK
  // ==========================================================

  async canAccessPrediction(
    user: User | null,

    prediction: Prediction,
  ) {
    let userPlan: 'free' | 'regular' | 'vip' = 'free';

    // ========================================================
    // GET USER PLAN
    // ========================================================

    if (user) {
      userPlan = await this.subscriptionService.getUserPlan(
        user._id.toString(),
      );
    }

    // ========================================================
    // ACCESS RULE
    // ========================================================

    const rule = PredictionAccessRules[userPlan];

    // ========================================================
    // RELEASE
    // ========================================================

    const release = this.getReleaseData(
      prediction.kickoffTimestamp,

      rule.releaseHoursBeforeKickoff,
    );

    const hoursLeft = this.getHoursLeft(prediction.kickoffTimestamp);

    // ========================================================
    // PUBLIC PREVIEW
    // ========================================================
    //
    // Anonymous visitors can access ONLY the five
    // predictions selected by PredictionPreviewService.
    //
    // These must already satisfy:
    //
    // - free
    // - pending
    // - not deleted
    // - not settled
    // - confidence >= 80%
    //
    // The preview service determines which five.
    // ========================================================

    if (!user) {
      const isPublicPreview =
        prediction.accessType === 'free' &&
        (await this.previewService.isPublicPrediction(
          prediction._id.toString(),
        ));

      if (isPublicPreview) {
        return {
          allowed: true,

          state: 'public_preview',

          purchased: false,

          ...release,

          // Public previews need probabilities
          // because they are part of the preview card.
          showProbabilities: true,

          // Do not expose betting markets
          // to anonymous visitors.
          allowedMarkets: [],

          message: null,
        };
      }

      // ======================================================
      // EVERYTHING ELSE REQUIRES LOGIN
      // ======================================================

      return {
        allowed: false,

        state: 'login_required',

        purchased: false,

        ...release,

        showProbabilities: false,

        allowedMarkets: [],

        message: 'Login required',
      };
    }

    // ========================================================
    // ONE-TIME PURCHASE
    // ========================================================

    const purchased = await this.purchaseService.hasPurchased(
      user._id.toString(),

      prediction._id.toString(),
    );

    if (purchased) {
      return {
        allowed: true,

        state: 'purchased',

        purchased: true,

        ...release,

        showProbabilities: true,

        allowedMarkets: null,
      };
    }

    // ========================================================
    // SUBSCRIPTION LEVEL CHECK
    // ========================================================

    const userLevel = PlanLevels[userPlan] ?? 0;

    const predictionLevel = PlanLevels[prediction.accessType] ?? 0;

    if (userLevel < predictionLevel) {
      return {
        allowed: false,

        state: 'upgrade_required',

        purchased: false,

        ...release,

        showProbabilities: false,

        allowedMarkets: [],

        message: `${prediction.accessType} subscription required`,
      };
    }

    // ========================================================
    // RELEASE WINDOW CHECK
    // ========================================================

    if (hoursLeft > rule.releaseHoursBeforeKickoff) {
      return {
        allowed: false,

        state: 'locked',

        purchased: false,

        ...release,

        showProbabilities: false,

        allowedMarkets: [],

        message: `Available ${rule.releaseHoursBeforeKickoff} hours before kickoff`,
      };
    }

    // ========================================================
    // FULL ACCESS
    // ========================================================

    return {
      allowed: true,

      state: 'subscription',

      purchased: false,

      ...release,

      showProbabilities: rule.showProbabilities,

      allowedMarkets: rule.allowedMarkets,
    };
  }
}
