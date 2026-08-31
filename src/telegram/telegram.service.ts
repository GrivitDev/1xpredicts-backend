// src/telegram/telegram.service.ts

import { Injectable, Logger } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { Telegraf } from 'telegraf';

import { UserHandler } from './handlers/user.handler';

import { PaymentHandler } from './handlers/payment.handler';

import { RewardHandler } from './handlers/reward.handler';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  private readonly bot: Telegraf;

  private readonly adminGroupId: string;

  constructor(
    private readonly config: ConfigService,

    private readonly userHandler: UserHandler,

    private readonly paymentHandler: PaymentHandler,

    private readonly rewardHandler: RewardHandler,
  ) {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');

    this.adminGroupId =
      this.config.get<string>('TELEGRAM_ADMIN_GROUP_ID') || '';

    this.bot = new Telegraf(token || '');
  }

  // ==========================================================
  // SEND MESSAGE
  // ==========================================================

  async sendMessage(message: string): Promise<boolean> {
    try {
      await this.bot.telegram.sendMessage(this.adminGroupId, message);

      return true;
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));

      return false;
    }
  }

  // ==========================================================
  // SEND PHOTO
  // ==========================================================

  async sendPhoto(photoUrl: string, caption: string): Promise<boolean> {
    try {
      await this.bot.telegram.sendPhoto(this.adminGroupId, photoUrl, {
        caption,
      });

      return true;
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));

      return false;
    }
  }

  // ==========================================================
  // COMMUNITY DISCUSSION
  // ==========================================================

  async sendCommunityDiscussion(data: {
    title?: string;

    message?: string;

    category?: string;
  }): Promise<boolean> {
    const text = [
      '⚽ 2xPREDICT DISCUSSION',
      '',
      data.title ? `📌 ${data.title}` : '',
      '',
      data.message || '',
      '',
      data.category ? `#${this.formatHashtag(data.category)}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return this.sendMessage(text.trim());
  }

  // ==========================================================
  // COMMUNITY NEWS POST
  // ==========================================================

  async sendCommunityNewsPost(data: {
    title?: string;

    message?: string;

    category?: string;

    imageUrl: string;
  }): Promise<boolean> {
    const caption = [
      '📰 2xPREDICT NEWS',
      '',
      data.title ? `📌 ${data.title}` : '',
      '',
      data.message || '',
      '',
      data.category ? `#${this.formatHashtag(data.category)}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return this.sendPhoto(data.imageUrl, caption.trim());
  }

  // ==========================================================
  // FORMAT HASHTAG
  // ==========================================================

  private formatHashtag(value: string): string {
    return value.trim().replace(/[^a-zA-Z0-9]+/g, '');
  }

  // ==========================================================
  // NEW USER
  // ==========================================================

  async notifyNewUser(data: {
    fullName: string;

    username: string;

    email: string;

    phoneNumber: string;

    referred: boolean;

    referredBy?: {
      id: string;

      fullName: string;

      username: string;

      email: string;
    };
  }) {
    const message = this.userHandler.buildNewUserMessage(data);

    return this.sendMessage(message);
  }

  // ==========================================================
  // NEW REGISTRATION
  // ==========================================================

  async notifyNewRegistration(data: {
    fullName: string;

    username: string;

    email: string;

    phoneNumber: string;

    referred: boolean;
  }) {
    const message = this.userHandler.buildNewRegistrationMessage(data);

    return this.sendMessage(message);
  }

  // ==========================================================
  // NEW PAYMENT
  // ==========================================================

  async notifyNewPayment(data: {
    fullName: string;

    email: string;

    type: string;

    amount: number;

    currency: string;

    target: string;

    proofImageUrl?: string;
  }) {
    const message = this.paymentHandler.buildPaymentMessage(data);

    if (data.proofImageUrl) {
      return this.sendPhoto(data.proofImageUrl, message);
    }

    return this.sendMessage(message);
  }

  // ==========================================================
  // CASH REWARD
  // ==========================================================

  async notifyCashRewardRequest(data: {
    fullName: string;

    email: string;

    campaign: string;

    amount: number;

    bankName: string;

    accountName: string;

    accountNumber: string;
  }) {
    const message = this.rewardHandler.buildCashRewardMessage(data);

    return this.sendMessage(message);
  }

  // ==========================================================
  // GATEWAY PAYMENT
  // ==========================================================

  async notifyGatewayPaymentReceived(data: {
    gateway: 'paystack' | 'opay';

    fullName: string;

    email: string;

    amount: number;

    currency: string;

    type: 'subscription' | 'prediction' | 'vip_upgrade';

    target: string;

    reference: string;

    transactionId: string;
  }) {
    const symbol = data.currency === 'USD' ? '$' : '₦';

    const message = `
💳 GATEWAY PAYMENT RECEIVED

━━━━━━━━━━━━━━━━━━━━

👤 CUSTOMER

Name:
${data.fullName}

Email:
${data.email}

━━━━━━━━━━━━━━━━━━━━

💰 PAYMENT

Gateway:
${data.gateway.toUpperCase()}

Type:
${data.type.replace('_', ' ').toUpperCase()}

Target:
${data.target.toUpperCase()}

Amount:
${symbol}${data.amount.toLocaleString()}

Reference:
${data.reference}

Transaction ID:
${data.transactionId}

━━━━━━━━━━━━━━━━━━━━

Status:
⏳ AWAITING VERIFICATION

The payment gateway has reported a successful payment.

━━━━━━━━━━━━━━━━━━━━
`;

    return this.sendMessage(message.trim());
  }
}
