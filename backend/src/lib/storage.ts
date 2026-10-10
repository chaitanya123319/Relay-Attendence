import fs from 'fs';
import path from 'path';
import { env } from '../config/env';

/**
 * Storage abstraction. Dev ships LocalDiskStorage; an S3 implementation only
 * needs to satisfy this interface and be returned by `createStorage()`.
 * Paths are always relative ("attendance/<userId>/<date>-in.jpg") so they stay
 * bucket-agnostic when moving to S3.
 */
export interface StorageService {
  save(buffer: Buffer, relPath: string): Promise<string>;
  read(relPath: string): fs.ReadStream;
  exists(relPath: string): Promise<boolean>;
  remove(relPath: string): Promise<void>;
  /** Absolute path on disk — LocalDiskStorage only (Docker volume mounts, seed tooling). */
  absolutePath(relPath: string): string;
}

export class LocalDiskStorage implements StorageService {
  private readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
    fs.mkdirSync(this.root, { recursive: true });
  }

  /** Resolve a relative storage path to an absolute one, blocking traversal. */
  absolutePath(relPath: string): string {
    const abs = path.resolve(this.root, relPath);
    if (abs !== this.root && !abs.startsWith(this.root + path.sep)) {
      throw new Error(`Blocked path traversal attempt: ${relPath}`);
    }
    return abs;
  }

  async save(buffer: Buffer, relPath: string): Promise<string> {
    const abs = this.absolutePath(relPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    await fs.promises.writeFile(abs, buffer);
    return relPath.replace(/\\/g, '/');
  }

  read(relPath: string): fs.ReadStream {
    return fs.createReadStream(this.absolutePath(relPath));
  }

  async exists(relPath: string): Promise<boolean> {
    try {
      await fs.promises.access(this.absolutePath(relPath));
      return true;
    } catch {
      return false;
    }
  }

  async remove(relPath: string): Promise<void> {
    await fs.promises.rm(this.absolutePath(relPath), { force: true });
  }
}

function createStorage(): StorageService {
  // STORAGE_DRIVER is validated in env; only 'local' is implemented today.
  return new LocalDiskStorage(env.STORAGE_DIR);
}

export const storage: StorageService = createStorage();

/** Build a collision-free, user-scoped storage path. */
export function buildStoragePath(
  kind: 'attendance' | 'leave',
  userId: string,
  filename: string,
): string {
  return `${kind}/${userId}/${filename}`;
}

/** Best-effort MIME from file extension (dev storage keeps original extension). */
export function mimeFromPath(p: string): string {
  const ext = p.slice(p.lastIndexOf('.')).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  return 'application/octet-stream';
}
