import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import { Prediction, PredictionDocument } from './schemas/prediction.schema';

import { CreatePredictionDto } from './dto/create-prediction.dto';

import { UpdatePredictionDto } from './dto/update-prediction.dto';

import { isValidPredictionSelection } from './constants/prediction-market-options';

@Injectable()
export class PredictionsService {
  constructor(
    @InjectModel(Prediction.name)
    private readonly predictionModel: Model<PredictionDocument>,
  ) {}

  // ==========================================================
  // PROBABILITY VALIDATION
  // ==========================================================

  private validateProbabilities(dto: {
    probabilities?: {
      home: number;
      draw: number;
      away: number;
    };
  }) {
    if (!dto.probabilities) {
      return;
    }

    const total =
      dto.probabilities.home + dto.probabilities.draw + dto.probabilities.away;

    if (total !== 100) {
      throw new BadRequestException('Probabilities must total 100%');
    }
  }

  // ==========================================================
  // ACCESS TYPE COUNTS
  // ==========================================================

  async countAccessTypes(matchIds: string[]) {
    if (!Array.isArray(matchIds) || matchIds.length === 0) {
      return {
        free: 0,
        regular: 0,
        vip: 0,
      };
    }

    const result = await this.predictionModel.aggregate([
      {
        $match: {
          matchId: {
            $in: matchIds,
          },

          deleted: false,
        },
      },

      {
        $group: {
          _id: '$accessType',

          count: {
            $sum: 1,
          },
        },
      },
    ]);

    const counts = {
      free: 0,
      regular: 0,
      vip: 0,
    };

    for (const item of result) {
      if (item._id === 'free') {
        counts.free = item.count;
      }

      if (item._id === 'regular') {
        counts.regular = item.count;
      }

      if (item._id === 'vip') {
        counts.vip = item.count;
      }
    }

    return counts;
  }

  // ==========================================================
  // ACCESS PRICING
  // ==========================================================

  private getAccessPricing(accessType: 'free' | 'regular' | 'vip') {
    switch (accessType) {
      case 'regular':
        return {
          price: 100,
          priceNGN: 100,
          priceUSD: 0.3,
        };

      case 'vip':
        return {
          price: 300,
          priceNGN: 300,
          priceUSD: 0.5,
        };

      default:
        return {
          price: 0,
          priceNGN: 0,
          priceUSD: 0,
        };
    }
  }

  // ==========================================================
  // RESULT
  // ==========================================================

  private getPredictionFromProbabilities(
    home: number,
    draw: number,
    away: number,
  ): 'HOME' | 'DRAW' | 'AWAY' {
    const max = Math.max(home, draw, away);

    if (max === home) {
      return 'HOME';
    }

    if (max === away) {
      return 'AWAY';
    }

    return 'DRAW';
  }

  // ==========================================================
  // MARKETS
  // ==========================================================

  private normalizeMarkets(markets: any[] = []) {
    if (!Array.isArray(markets)) {
      return [];
    }

    return markets.map((market) => {
      const marketValue = String(market?.market || '').trim();

      const selection = String(market?.selection || '').trim();

      if (!marketValue) {
        throw new BadRequestException('Prediction market is required');
      }

      if (!selection) {
        throw new BadRequestException(
          `Selection is required for ${marketValue}`,
        );
      }

      if (!isValidPredictionSelection(marketValue, selection)) {
        throw new BadRequestException(
          `Invalid selection "${selection}" for market "${marketValue}"`,
        );
      }

      return {
        market: marketValue,

        selection,

        ...(market?.playerId
          ? {
              playerId: String(market.playerId).trim(),
            }
          : {}),

        ...(market?.playerName
          ? {
              playerName: String(market.playerName).trim(),
            }
          : {}),
      };
    });
  }

  // ==========================================================
  // CREATE
  //
  // Temporarily disabled for AI-generated predictions.
  //
  // The prediction-generation pipeline is being rebuilt on top
  // of the new sports data architecture.
  //
  // Existing predictions remain readable/editable according
  // to the rules below.
  // ==========================================================

  async create(_dto: CreatePredictionDto) {
    throw new ServiceUnavailableException(
      'Prediction generation is temporarily disabled while the AI prediction pipeline is being rebuilt.',
    );
  }

  // ==========================================================
  // GET ALL
  // ==========================================================

  async findAll() {
    return this.predictionModel
      .find({
        deleted: false,
      })
      .sort({
        createdAt: -1,
      });
  }

  // ==========================================================
  // GET ONE
  // ==========================================================

  async findOne(id: string) {
    const prediction = await this.predictionModel.findById(id);

    if (!prediction || prediction.deleted) {
      throw new NotFoundException('Prediction not found');
    }

    return prediction;
  }

  // ==========================================================
  // UPDATE
  // ==========================================================

  async update(id: string, dto: UpdatePredictionDto) {
    const prediction = await this.findOne(id);

    if (prediction.settled) {
      throw new ForbiddenException('Prediction is locked after settlement');
    }

    this.validateProbabilities(dto);

    const updateData: any = {
      ...dto,
    };

    if (dto.probabilities) {
      updateData.prediction = this.getPredictionFromProbabilities(
        dto.probabilities.home,
        dto.probabilities.draw,
        dto.probabilities.away,
      );
    }

    if (dto.markets) {
      updateData.markets = this.normalizeMarkets(dto.markets);
    }

    if (dto.accessType) {
      const pricing = this.getAccessPricing(dto.accessType);

      updateData.price = pricing.price;

      updateData.priceNGN = pricing.priceNGN;

      updateData.priceUSD = pricing.priceUSD;
    }

    return this.predictionModel.findByIdAndUpdate(
      id,
      {
        $set: updateData,
      },
      {
        new: true,
        runValidators: true,
      },
    );
  }

  // ==========================================================
  // DELETE
  // ==========================================================

  async delete(id: string) {
    const prediction = await this.findOne(id);

    if (prediction.settled) {
      throw new ForbiddenException('Prediction is locked after settlement');
    }

    return this.predictionModel.findByIdAndUpdate(
      id,
      {
        $set: {
          deleted: true,
        },
      },
      {
        new: true,
      },
    );
  }

  // ==========================================================
  // USER VIEW
  // ==========================================================

  async getForUser(id: string, _user: any) {
    const prediction = await this.findOne(id);

    return {
      ...prediction.toObject(),

      markets: prediction.markets || [],
    };
  }

  // ==========================================================
  // COUNT
  // ==========================================================

  async countPredictions() {
    return this.predictionModel.countDocuments({
      deleted: false,
    });
  }

  // ==========================================================
  // SETTLED WINS
  // ==========================================================

  async findSettledWins() {
    const predictions = await this.predictionModel
      .find({
        status: 'won',

        settled: true,

        deleted: false,
      })
      .sort({
        settledAt: -1,
      })
      .limit(50)
      .lean();

    return predictions.map((prediction) => ({
      ...prediction,

      data: {
        prediction: prediction.prediction,

        probabilities: prediction.probabilities,

        markets: prediction.markets ?? [],
      },

      accessType: prediction.accessType,

      price: prediction.price,

      access: {
        allowed: true,

        state: 'subscription',

        purchased: false,

        plan: prediction.accessType,

        released: true,

        releaseAt: 0,

        message: null,
      },
    }));
  }

  // ==========================================================
  // EXISTING MATCH IDS
  // ==========================================================

  async findExistingMatchIds(matchIds: string[]): Promise<string[]> {
    if (!Array.isArray(matchIds) || matchIds.length === 0) {
      return [];
    }

    const predictions = await this.predictionModel
      .find(
        {
          matchId: {
            $in: matchIds,
          },

          deleted: false,
        },

        {
          matchId: 1,

          _id: 0,
        },
      )
      .lean();

    return predictions.map((prediction) => prediction.matchId);
  }

  // ==========================================================
  // UPCOMING DISCUSSION PREDICTIONS
  // ==========================================================

  async findUpcomingPredictionsForDiscussion() {
    const now = Date.now();

    const sevenDaysFromNow = now + 7 * 24 * 60 * 60 * 1000;

    return this.predictionModel
      .find({
        deleted: false,

        settled: false,

        kickoffTimestamp: {
          $gt: now,

          $lte: sevenDaysFromNow,
        },
      })
      .sort({
        kickoffTimestamp: 1,

        confidence: -1,
      })
      .limit(10)
      .lean();
  }
}
