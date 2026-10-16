import { z } from 'zod';

const bool = z.enum(['true', 'false']).transform((v) => v === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  PUBLIC_SITE_URL: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1),
  APP_SECRET: z.string().min(32, 'APP_SECRET must be at least 32 characters'),
  COOKIE_SECURE: bool.default('false'),
  CORS_ORIGINS: z.string().default(''),
  PAYMENT_PROVIDER: z.enum(['sandbox', 'razorpay']).default('sandbox'),
  RAZORPAY_KEY_ID: z.string().default(''),
  RAZORPAY_KEY_SECRET: z.string().default(''),
  RAZORPAY_WEBHOOK_SECRET: z.string().default(''),
  EMAIL_TRANSPORT: z.enum(['log', 'smtp', 'none']).default('log'),
  EMAIL_FROM: z.string().default('NGO <no-reply@example.org>'),
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  ADMIN_ALERT_EMAIL: z.string().default(''),
  STORAGE_DRIVER: z.enum(['local', 'cloudinary']).default('local'),
  UPLOAD_DIR: z.string().default('./uploads'),
  PRIVATE_UPLOAD_DIR: z.string().default('./private-uploads'),
  CLOUDINARY_CLOUD_NAME: z.string().default(''),
  CLOUDINARY_API_KEY: z.string().default(''),
  CLOUDINARY_API_SECRET: z.string().default(''),
  MAX_UPLOAD_MB: z.coerce.number().min(1).max(100).default(15),
  JOBS_ENABLED: bool.default('true'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:\n' + parsed.error.issues.map((i) => ` - ${i.path.join('.')}: ${i.message}`).join('\n'));
  process.exit(1);
}
export const env = parsed.data;

if (env.NODE_ENV === 'production') {
  const problems: string[] = [];
  if (env.APP_SECRET.startsWith('change-me')) problems.push('APP_SECRET is still the example value');
  if (!env.COOKIE_SECURE) problems.push('COOKIE_SECURE should be true behind HTTPS');
  if (env.STORAGE_DRIVER === 'local') problems.push('STORAGE_DRIVER=local is not suitable for production (ephemeral disks)');
  if (env.PAYMENT_PROVIDER === 'razorpay' && (!env.RAZORPAY_KEY_SECRET || !env.RAZORPAY_WEBHOOK_SECRET))
    problems.push('Razorpay keys and webhook secret are required');
  if (problems.length) console.warn('[config] Production warnings:\n - ' + problems.join('\n - '));
}

export const isTest = env.NODE_ENV === 'test';
export const isProd = env.NODE_ENV === 'production';
