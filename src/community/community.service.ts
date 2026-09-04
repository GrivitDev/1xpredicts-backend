// src/community/community.service.ts

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import {
  CommunityPost,
  CommunityPostDocument,
  CommunityPostSource,
} from './schemas/community-post.schema';

import {
  CommunityReply,
  CommunityReplyDocument,
} from './schemas/community-reply.schema';

import { CreatePostDto } from './dto/create-post.dto';

import { UpdatePostDto } from './dto/update-post.dto';

import { CreateReplyDto } from './dto/create-reply.dto';

import { CommunityPostType } from './enums/community-post-type.enum';

import { CommunityMediaType } from './enums/community-media-type.enum';

@Injectable()
export class CommunityService {
  constructor(
    @InjectModel(CommunityPost.name)
    private readonly postModel: Model<CommunityPostDocument>,

    @InjectModel(CommunityReply.name)
    private readonly replyModel: Model<CommunityReplyDocument>,
  ) {}

  // ==========================================================
  // NORMAL USER POST
  // ==========================================================

  async create(user: any, dto: CreatePostDto) {
    return this.postModel.create({
      userId: user._id,

      username: user.username,

      fullName: user.fullName,

      type: dto.type,

      title: dto.title,

      message: dto.message,

      category: dto.category,

      media: dto.media,

      isAiGenerated: false,

      sources: [],

      telegramSent: false,
    });
  }

  // ==========================================================
  // AI POST
  // ==========================================================

  async createAiPost(data: {
    userId: string;

    username: string;

    fullName: string;

    type: CommunityPostType.DISCUSSION | CommunityPostType.MEDIA;

    title: string;

    message: string;

    category: string;

    media?: {
      type: CommunityMediaType;

      url: string;

      publicId: string;
    };

    sources?: CommunityPostSource[];
  }) {
    return this.postModel.create({
      userId: data.userId,

      username: data.username,

      fullName: data.fullName,

      type: data.type,

      title: data.title,

      message: data.message,

      category: data.category,

      media: data.media,

      isAiGenerated: true,

      sources: data.sources || [],

      telegramSent: false,
    });
  }

  // ==========================================================
  // LATEST AI TELEGRAM DISCUSSION
  // ==========================================================

  async getLatestTelegramDiscussion() {
    return this.postModel
      .findOne({
        isVisible: true,

        isAiGenerated: true,

        telegramSent: false,

        type: CommunityPostType.DISCUSSION,
      })
      .sort({
        createdAt: -1,
      });
  }

  // ==========================================================
  // LATEST AI TELEGRAM NEWS POST
  // ==========================================================

  async getLatestTelegramNewsPost() {
    return this.postModel
      .findOne({
        isVisible: true,

        isAiGenerated: true,

        telegramSent: false,

        type: CommunityPostType.MEDIA,

        'media.type': CommunityMediaType.IMAGE,
      })
      .sort({
        createdAt: -1,
      });
  }

  // ==========================================================
  // MARK TELEGRAM SENT
  // ==========================================================

  async markTelegramSent(postId: string) {
    return this.postModel.findByIdAndUpdate(
      postId,

      {
        $set: {
          telegramSent: true,
        },
      },

      {
        returnDocument: 'after',
      },
    );
  }

  // ==========================================================
  // FIND ALL
  // ==========================================================

  async findAll(page: number = 1, limit: number = 20, search?: string) {
    const filter: any = {
      isVisible: true,
    };

    if (search) {
      filter.$text = {
        $search: search,
      };
    }

    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      this.postModel
        .find(filter)
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit),

      this.postModel.countDocuments(filter),
    ]);

    return {
      posts,

      page,

      total,

      totalPages: Math.ceil(total / limit),
    };
  }

  // ==========================================================
  // FEATURED
  // ==========================================================

  async featured() {
    return this.postModel
      .find({
        isVisible: true,

        isFeatured: true,
      })
      .sort({
        createdAt: -1,
      })
      .limit(3);
  }

  // ==========================================================
  // FIND ONE
  // ==========================================================

  async findOne(id: string) {
    const post = await this.postModel.findById(id);

    if (!post) {
      throw new NotFoundException('Community post not found');
    }

    const replies = await this.replyModel
      .find({
        postId: id,

        isVisible: true,
      })
      .sort({
        createdAt: 1,
      });

    return {
      ...post.toObject(),

      replies,
    };
  }

  // ==========================================================
  // UPDATE
  // ==========================================================

  async update(id: string, user: any, dto: UpdatePostDto) {
    const post = await this.postModel.findById(id);

    if (!post) {
      throw new NotFoundException('Community post not found');
    }

    if (post.userId.toString() !== user._id.toString()) {
      throw new ForbiddenException('You cannot edit this post');
    }

    Object.assign(post, dto);

    return post.save();
  }

  // ==========================================================
  // REMOVE
  // ==========================================================

  async remove(id: string, user: any) {
    const post = await this.postModel.findById(id);

    if (!post) {
      throw new NotFoundException('Community post not found');
    }

    if (post.userId.toString() !== user._id.toString()) {
      throw new ForbiddenException('You cannot delete this post');
    }

    post.isVisible = false;

    return post.save();
  }

  // ==========================================================
  // REACT
  // ==========================================================

  async react(postId: string, userId: string, reaction: string) {
    const post = await this.postModel.findById(postId);

    if (!post) {
      throw new NotFoundException('Community post not found');
    }

    const existingReaction = post.reactedBy.find((entry) =>
      entry.startsWith(`${userId}:`),
    );

    if (existingReaction) {
      const [, previousReaction] = existingReaction.split(':');

      if (previousReaction === reaction) {
        await this.postModel.updateOne(
          {
            _id: postId,
          },
          {
            $pull: {
              reactedBy: existingReaction,
            },

            $inc: {
              [`reactions.${reaction}`]: -1,
            },
          },
        );

        return this.postModel.findById(postId);
      }

      await this.postModel.updateOne(
        {
          _id: postId,
        },
        {
          $pull: {
            reactedBy: existingReaction,
          },

          $push: {
            reactedBy: `${userId}:${reaction}`,
          },

          $inc: {
            [`reactions.${previousReaction}`]: -1,

            [`reactions.${reaction}`]: 1,
          },
        },
      );

      return this.postModel.findById(postId);
    }

    await this.postModel.updateOne(
      {
        _id: postId,
      },
      {
        $push: {
          reactedBy: `${userId}:${reaction}`,
        },

        $inc: {
          [`reactions.${reaction}`]: 1,
        },
      },
    );

    return this.postModel.findById(postId);
  }

  // ==========================================================
  // REPLY
  // ==========================================================

  async reply(postId: string, user: any, dto: CreateReplyDto) {
    const post = await this.postModel.findById(postId);

    if (!post) {
      throw new NotFoundException('Community post not found');
    }

    if (post.isLocked) {
      throw new ForbiddenException('This discussion is locked');
    }

    const reply = await this.replyModel.create({
      postId,

      userId: user._id,

      username: user.username,

      fullName: user.fullName,

      message: dto.message,
    });

    await this.postModel.findByIdAndUpdate(postId, {
      $inc: {
        replyCount: 1,
      },
    });

    return reply;
  }

  // ==========================================================
  // FIND REPLIES
  // ==========================================================

  async findReplies(postId: string) {
    return this.replyModel
      .find({
        postId,

        isVisible: true,
      })
      .sort({
        createdAt: 1,
      });
  }

  // ==========================================================
  // AI DAILY CONTENT COUNTS
  // ==========================================================

  async getAiDailyContentCounts() {
    const startOfDay = new Date();

    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();

    endOfDay.setHours(23, 59, 59, 999);

    const [news, discussions, videos] = await Promise.all([
      this.postModel.countDocuments({
        isVisible: true,

        isAiGenerated: true,

        createdAt: {
          $gte: startOfDay,
          $lte: endOfDay,
        },

        type: CommunityPostType.MEDIA,

        'media.type': CommunityMediaType.IMAGE,
      }),

      this.postModel.countDocuments({
        isVisible: true,

        isAiGenerated: true,

        createdAt: {
          $gte: startOfDay,
          $lte: endOfDay,
        },

        type: CommunityPostType.DISCUSSION,
      }),

      this.postModel.countDocuments({
        isVisible: true,

        isAiGenerated: true,

        createdAt: {
          $gte: startOfDay,
          $lte: endOfDay,
        },

        type: CommunityPostType.MEDIA,

        'media.type': CommunityMediaType.VIDEO,
      }),
    ]);

    return {
      news,
      discussions,
      videos,
    };
  }
}
