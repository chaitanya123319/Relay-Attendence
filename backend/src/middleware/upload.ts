import multer from 'multer';
import { env } from '../config/env';
import { badRequest } from '../lib/errors';

const PHOTO_MIMES = ['image/jpeg', 'image/png'];
const DOCUMENT_MIMES = ['application/pdf', 'image/jpeg', 'image/png'];

/**
 * Memory storage → the service hashes the exact bytes (sha256) before saving
 * through the StorageService. Files never touch the public filesystem path.
 */
function makeUploader(allowed: string[], maxMb: number, field: string) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: Math.round(maxMb * 1024 * 1024), files: 1 },
    fileFilter: (_req, file, cb) => {
      if (!allowed.includes(file.mimetype)) {
        return cb(
          badRequest('UNSUPPORTED_FILE_TYPE', `Unsupported file type "${file.mimetype}". Allowed: ${allowed.join(', ')}`),
        );
      }
      cb(null, true);
    },
  }).single(field);
}

/** Attendance proof photos: camera-capture JPEG/PNG only (no PDFs, no gallery assets masquerading). */
export const photoUpload = makeUploader(PHOTO_MIMES, env.MAX_UPLOAD_MB, 'photo');

/** Leave supporting documents: pdf/jpg/png within the configured size limit. */
export const documentUpload = makeUploader(DOCUMENT_MIMES, env.MAX_DOC_UPLOAD_MB, 'document');
