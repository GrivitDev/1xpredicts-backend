// src/uploads/uploads.service.ts

import { Injectable } from '@nestjs/common';

import cloudinary from './config/cloudinary.config';

import { UploadFolder } from './enums/upload-folder.enum';

@Injectable()
export class UploadsService {
  // ============================================================
  // UPLOAD EXPRESS FILE
  // ============================================================

  private async upload(file: Express.Multer.File, folder: UploadFolder) {
    return this.uploadBuffer(file.buffer, folder);
  }

  // ============================================================
  // UPLOAD BUFFER
  // ============================================================

  async uploadBuffer(
    buffer: Buffer,
    folder: UploadFolder,
  ): Promise<{
    url: string;
    publicId: string;
    width: number;
    height: number;
    format: string;
    bytes: number;
  }> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder,

            resource_type: 'image',

            transformation: [
              {
                width: 1200,

                crop: 'limit',

                quality: 'auto',

                fetch_format: 'auto',
              },
            ],
          },

          (error, result) => {
            if (error || !result) {
              return reject(error || new Error('Cloudinary upload failed'));
            }

            resolve({
              url: result.secure_url,

              publicId: result.public_id,

              width: result.width,

              height: result.height,

              format: result.format,

              bytes: result.bytes,
            });
          },
        )
        .end(buffer);
    });
  }

  // ============================================================
  // EXISTING UPLOAD METHODS
  // ============================================================

  async uploadAdImage(file: Express.Multer.File) {
    return this.upload(file, UploadFolder.ADS);
  }

  async uploadPredictionImage(file: Express.Multer.File) {
    return this.upload(file, UploadFolder.PREDICTIONS);
  }

  async uploadArticleImage(file: Express.Multer.File) {
    return this.upload(file, UploadFolder.ARTICLES);
  }

  async uploadPaymentProof(file: Express.Multer.File) {
    return this.upload(file, UploadFolder.PAYMENT_PROOFS);
  }

  async uploadUserAvatar(file: Express.Multer.File) {
    return this.upload(file, UploadFolder.USERS);
  }

  async uploadCommunityMedia(file: Express.Multer.File) {
    return this.upload(file, UploadFolder.COMMUNITY);
  }

  // ============================================================
  // DELETE IMAGE
  // ============================================================

  async deleteImage(publicId: string) {
    return cloudinary.uploader.destroy(publicId);
  }
}
