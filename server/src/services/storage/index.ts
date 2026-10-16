import fs from 'node:fs/promises';
import path from 'node:path';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../../config/env.js';
import { randomToken } from '../../utils/crypto.js';

export interface StoredFile {
  provider: 'local' | 'cloudinary';
  key: string;
  url: string;
}

export interface StorageDriver {
  put(buffer: Buffer, opts: { folder: string; ext: string; contentType: string }): Promise<StoredFile>;
  remove(key: string): Promise<void>;
}

const publicDir = path.resolve(env.UPLOAD_DIR);
const privateDir = path.resolve(env.PRIVATE_UPLOAD_DIR);

const safeFolder = (f: string) => f.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40) || 'general';

const local: StorageDriver = {
  async put(buffer, { folder, ext }) {
    const dir = path.join(publicDir, safeFolder(folder));
    await fs.mkdir(dir, { recursive: true });
    const name = `${Date.now().toString(36)}-${randomToken(8)}.${ext}`;
    await fs.writeFile(path.join(dir, name), buffer);
    const key = `${safeFolder(folder)}/${name}`;
    return { provider: 'local', key, url: `/uploads/${key}` };
  },
  async remove(key) {
    const target = path.resolve(publicDir, key);
    if (!target.startsWith(publicDir + path.sep)) return;
    await fs.rm(target, { force: true });
  },
};

let cloudinaryConfigured = false;
const cloud: StorageDriver = {
  async put(buffer, { folder, contentType }) {
    if (!cloudinaryConfigured) {
      cloudinary.config({
        cloud_name: env.CLOUDINARY_CLOUD_NAME,
        api_key: env.CLOUDINARY_API_KEY,
        api_secret: env.CLOUDINARY_API_SECRET,
        secure: true,
      });
      cloudinaryConfigured = true;
    }
    const resourceType = contentType.startsWith('video/') ? 'video' : contentType === 'application/pdf' ? 'raw' : 'image';
    const result = await new Promise<{ public_id: string; secure_url: string; resource_type: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ folder: `ngo/${safeFolder(folder)}`, resource_type: resourceType }, (err, res) =>
        err || !res ? reject(err ?? new Error('Upload failed')) : resolve(res),
      );
      stream.end(buffer);
    });
    return { provider: 'cloudinary', key: `${result.resource_type}:${result.public_id}`, url: result.secure_url };
  },
  async remove(key) {
    const [resourceType, publicId] = key.split(':');
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  },
};

export const storage: StorageDriver = env.STORAGE_DRIVER === 'cloudinary' ? cloud : local;

/** Private files (volunteer CVs) always stay on the server and are streamed to authorised staff only. */
export const privateStorage = {
  async put(buffer: Buffer, ext: string): Promise<string> {
    await fs.mkdir(privateDir, { recursive: true });
    const key = `${Date.now().toString(36)}-${randomToken(12)}.${ext}`;
    await fs.writeFile(path.join(privateDir, key), buffer, { mode: 0o600 });
    return key;
  },
  resolve(key: string): string | null {
    const target = path.resolve(privateDir, key);
    return target.startsWith(privateDir + path.sep) ? target : null;
  },
};

export const PUBLIC_UPLOAD_DIR = publicDir;
