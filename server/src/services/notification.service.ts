import type { Permission } from '@ngo/shared';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { sendTemplate } from './email.service.js';

/** Creates an in-app alert for staff holding `permission`, and optionally emails ADMIN_ALERT_EMAIL. */
export async function alertStaff(input: { permission: Permission; type: string; title: string; body?: string; link?: string; email?: boolean }) {
  await prisma.notification.create({
    data: { permission: input.permission, type: input.type, title: input.title, body: input.body ?? '', link: input.link ?? '' },
  });
  if (input.email && env.ADMIN_ALERT_EMAIL) {
    await sendTemplate({
      to: env.ADMIN_ALERT_EMAIL,
      template: 'admin_alert',
      vars: { title: input.title, body: input.body ?? '', link: `${env.PUBLIC_SITE_URL}${input.link ?? '/admin'}` },
    });
  }
}
