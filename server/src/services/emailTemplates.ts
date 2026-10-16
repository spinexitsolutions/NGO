/** Default transactional/marketing templates. Seeded into the database, then editable by admins. */
export interface TemplateDefault {
  key: string;
  name: string;
  description: string;
  subject: string;
  body: string;
  variables: string[];
  isMarketing?: boolean;
}

export const DEFAULT_EMAIL_TEMPLATES: TemplateDefault[] = [
  {
    key: 'donation_receipt',
    name: 'Donation confirmation & receipt',
    description: 'Sent when a donation is verified as successful. The PDF receipt is attached.',
    subject: 'Thank you for your gift, {{donorName}} — receipt {{receiptNumber}}',
    variables: ['donorName', 'amount', 'reference', 'receiptNumber', 'campaign', 'date', 'orgName', 'portalUrl'],
    body: `Dear {{donorName}},

Thank you for your generous donation of **{{amount}}** to {{orgName}}{{campaign}}.

- Donation reference: **{{reference}}**
- Receipt number: **{{receiptNumber}}**
- Date: {{date}}

Your receipt is attached to this email. You can also view your donation history and download receipts anytime from the [donor portal]({{portalUrl}}).

With gratitude,
{{orgName}}`,
  },
  {
    key: 'donation_failed',
    name: 'Donation payment failed',
    description: 'Sent when a payment attempt fails.',
    subject: 'Your donation could not be completed',
    variables: ['donorName', 'amount', 'reference', 'retryUrl', 'orgName'],
    body: `Dear {{donorName}},

Your donation of {{amount}} (reference {{reference}}) could not be completed and **you have not been charged** by us. If money was debited by your bank, it is usually reversed automatically within 5–7 working days.

You can [try again here]({{retryUrl}}). If you need help, simply reply to this email.

{{orgName}}`,
  },
  {
    key: 'donation_refunded',
    name: 'Donation refunded',
    description: 'Sent when a refund is processed.',
    subject: 'Refund processed for donation {{reference}}',
    variables: ['donorName', 'amount', 'reference', 'orgName'],
    body: `Dear {{donorName}},

A refund of **{{amount}}** for donation {{reference}} has been processed. It may take 5–7 working days to appear in your account.

{{orgName}}`,
  },
  {
    key: 'donor_login',
    name: 'Donor portal sign-in link',
    description: 'Magic link for donors to view their donation history.',
    subject: 'Your sign-in link for {{orgName}}',
    variables: ['donorName', 'loginUrl', 'orgName'],
    body: `Hello {{donorName}},

[Click here to view your donations and receipts]({{loginUrl}}). This link expires in 30 minutes and can be used once.

If you did not request this, you can ignore this email.

{{orgName}}`,
  },
  {
    key: 'volunteer_received',
    name: 'Volunteer application received',
    description: 'Sent to applicants after they apply.',
    subject: 'We received your volunteer application ({{reference}})',
    variables: ['name', 'reference', 'statusUrl', 'orgName'],
    body: `Dear {{name}},

Thank you for offering your time to {{orgName}}! Your application reference is **{{reference}}**.

Our volunteer coordinator will review it and get back to you. You can [check your application status]({{statusUrl}}) anytime.

{{orgName}}`,
  },
  {
    key: 'volunteer_status',
    name: 'Volunteer application update',
    description: 'Sent when an application is approved, rejected or more information is requested.',
    subject: 'Update on your volunteer application ({{reference}})',
    variables: ['name', 'reference', 'status', 'message', 'statusUrl', 'orgName'],
    body: `Dear {{name}},

Your volunteer application **{{reference}}** is now: **{{status}}**.

{{message}}

[View your application]({{statusUrl}})

{{orgName}}`,
  },
  {
    key: 'event_registration',
    name: 'Event registration confirmation',
    description: 'Sent after registering for an event.',
    subject: 'You’re registered: {{eventTitle}}',
    variables: ['name', 'eventTitle', 'eventDate', 'venue', 'reference', 'status', 'cancelUrl', 'orgName'],
    body: `Dear {{name}},

Your registration for **{{eventTitle}}** is **{{status}}**.

- When: {{eventDate}}
- Where: {{venue}}
- Reference: {{reference}}

Can’t make it? [Cancel your registration]({{cancelUrl}}) so someone else can take your place.

{{orgName}}`,
  },
  {
    key: 'event_cancelled',
    name: 'Event cancelled',
    description: 'Sent to registrants when an event is cancelled.',
    subject: 'Cancelled: {{eventTitle}}',
    variables: ['name', 'eventTitle', 'note', 'orgName'],
    body: `Dear {{name}},

We’re sorry — **{{eventTitle}}** has been cancelled.

{{note}}

{{orgName}}`,
  },
  {
    key: 'inquiry_received',
    name: 'Inquiry acknowledgement',
    description: 'Auto-reply to contact and partnership inquiries.',
    subject: 'We received your message',
    variables: ['name', 'subject', 'orgName'],
    body: `Dear {{name}},

Thank you for contacting {{orgName}} about “{{subject}}”. A member of our team will respond within two working days.

{{orgName}}`,
  },
  {
    key: 'newsletter_welcome',
    name: 'Newsletter welcome',
    description: 'Sent when someone subscribes.',
    subject: 'Welcome to the {{orgName}} newsletter',
    variables: ['name', 'orgName', 'unsubscribeUrl'],
    isMarketing: true,
    body: `Hello{{name}},

Thank you for subscribing. Once a month we’ll share stories from the field, impact updates and ways to help.

{{orgName}}`,
  },
  {
    key: 'campaign_update',
    name: 'Campaign update announcement',
    description: 'Sent to subscribers when staff announce a campaign update.',
    subject: '{{campaignTitle}}: {{updateTitle}}',
    variables: ['name', 'campaignTitle', 'updateTitle', 'updateBody', 'campaignUrl', 'orgName', 'unsubscribeUrl'],
    isMarketing: true,
    body: `Hello{{name}},

**{{updateTitle}}**

{{updateBody}}

[Read more and support the campaign]({{campaignUrl}})

{{orgName}}`,
  },
  {
    key: 'password_reset',
    name: 'Staff password reset',
    description: 'Password reset link for staff accounts.',
    subject: 'Reset your password',
    variables: ['name', 'resetUrl', 'orgName'],
    body: `Hello {{name}},

[Reset your password]({{resetUrl}}). The link expires in 1 hour and can be used once. If you did not request this, ignore this email — your password stays the same.

{{orgName}}`,
  },
  {
    key: 'admin_alert',
    name: 'Admin alert',
    description: 'Internal alert to the admin alert address.',
    subject: '[{{orgName}}] {{title}}',
    variables: ['title', 'body', 'link', 'orgName'],
    body: `**{{title}}**

{{body}}

[Open in admin]({{link}})`,
  },
];
