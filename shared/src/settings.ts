import { z } from 'zod';
import { linkSchema, mediaUrlSchema } from './common.js';

const str = (max = 300) => z.string().trim().max(max).default('');

export const SOCIAL_NETWORKS = ['facebook', 'instagram', 'x', 'linkedin', 'youtube', 'whatsapp'] as const;

export const settingsSchema = z.object({
  organization: z.object({
    name: z.string().trim().min(1).max(120),
    shortName: str(40),
    tagline: str(160),
    description: str(600),
    logo: mediaUrlSchema.default(''),
    logoLight: mediaUrlSchema.default(''), // used on dark backgrounds (hero, footer)
    favicon: mediaUrlSchema.default(''),
    foundedYear: z.number().int().min(1800).max(2100).nullable().default(null),
  }),
  contact: z.object({
    email: z.union([z.string().email(), z.literal('')]).default(''),
    phone: str(40),
    whatsapp: str(20), // digits incl. country code, e.g. 919800000000
    address: str(400),
    hours: str(120),
    mapEmbedUrl: z
      .string()
      .trim()
      .max(1000)
      .refine((v) => v === '' || /^https:\/\/(www\.)?google\.com\/maps\/embed/.test(v) || /^https:\/\/www\.openstreetmap\.org\/export\/embed/.test(v), 'Use a Google Maps or OpenStreetMap embed URL')
      .default(''),
  }),
  registration: z.object({
    // Only shown publicly when `verified` is true — never display unverified credentials.
    verified: z.boolean().default(false),
    legalName: str(200),
    registrationNumber: str(120),
    registrationType: str(120), // e.g. "Registered Trust", "Section 8 Company"
    pan: str(20),
    taxExemptionText: str(400), // e.g. "Donations are eligible for deduction under Section 80G…"
    taxExemptionEnabled: z.boolean().default(false),
    otherCredentials: z.array(z.object({ label: str(80), value: str(160) })).max(10).default([]),
  }),
  social: z.array(z.object({ network: z.enum(SOCIAL_NETWORKS), url: z.string().url().max(300) })).max(10).default([]),
  announcement: z.object({
    enabled: z.boolean().default(false),
    text: str(200),
    linkLabel: str(40),
    href: linkSchema.default(''),
    tone: z.enum(['primary', 'accent', 'neutral']).default('accent'),
  }),
  header: z.object({
    ctaLabel: str(30),
    ctaHref: linkSchema.default('/donate'),
    showSearch: z.boolean().default(true),
  }),
  footer: z.object({
    about: str(400),
    showNewsletter: z.boolean().default(true),
    newsletterHeading: str(120),
    newsletterText: str(240),
    copyright: str(200),
  }),
  donation: z.object({
    currency: z.enum(['INR', 'USD', 'EUR', 'GBP']).default('INR'),
    presetAmounts: z.array(z.number().int().positive()).min(1).max(6), // minor units
    minAmount: z.number().int().positive(), // minor units
    maxAmount: z.number().int().positive(),
    recurringEnabled: z.boolean().default(true),
    allowAnonymous: z.boolean().default(true),
    collectPhone: z.boolean().default(true),
    collectPan: z.boolean().default(false), // only when tax receipts require it
    thankYouHeading: str(120),
    thankYouMessage: str(1000),
    bankTransfer: z.object({
      enabled: z.boolean().default(false),
      accountName: str(120),
      accountNumber: str(40),
      ifsc: str(20),
      bankName: str(120),
      branch: str(120),
      notes: str(400),
    }),
    upi: z.object({ enabled: z.boolean().default(false), vpa: str(80), payeeName: str(80) }),
    receiptFooter: str(500),
    signatoryName: str(80),
    signatoryTitle: str(80),
  }),
  seo: z.object({
    titleTemplate: z.string().trim().max(80).default('%s | {site}'),
    defaultDescription: str(170),
    ogImage: mediaUrlSchema.default(''),
  }),
  analytics: z.object({
    googleAnalyticsId: z.union([z.string().regex(/^G-[A-Z0-9]{4,}$/), z.literal('')]).default(''),
    plausibleDomain: z.union([z.string().regex(/^[a-z0-9.-]+$/), z.literal('')]).default(''),
  }),
  cookieConsent: z.object({ enabled: z.boolean().default(true), text: str(400), policyHref: linkSchema.default('/privacy-policy') }),
  features: z.object({
    volunteers: z.boolean().default(true),
    events: z.boolean().default(true),
    blog: z.boolean().default(true),
    donorPortal: z.boolean().default(true),
    whatsappButton: z.boolean().default(true),
    languageSwitcher: z.boolean().default(false),
  }),
  languages: z.array(z.object({ code: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/), label: str(40) })).min(1).max(8),
});
export type SiteSettings = z.infer<typeof settingsSchema>;

const navLink = z.object({ label: z.string().trim().min(1).max(40), href: linkSchema });
export const navigationSchema = z.object({
  header: z
    .array(navLink.extend({ children: z.array(navLink.extend({ description: str(100) })).max(12).default([]) }))
    .max(10),
  footer: z.array(z.object({ title: z.string().trim().min(1).max(40), links: z.array(navLink).max(12) })).max(5),
  legal: z.array(navLink).max(10),
});
export type Navigation = z.infer<typeof navigationSchema>;

export const DEFAULT_SETTINGS: SiteSettings = {
  organization: {
    name: 'Saathi Foundation',
    shortName: 'Saathi',
    tagline: 'Walking alongside communities toward dignity and opportunity',
    description:
      'Saathi Foundation is a community-led nonprofit working across education, health, livelihoods and the environment. (Sample organisation — replace with your NGO’s details.)',
    logo: '',
    logoLight: '',
    favicon: '',
    foundedYear: 2012,
  },
  contact: {
    email: 'hello@example.org',
    phone: '+91 00000 00000',
    whatsapp: '',
    address: 'Replace with your registered office address',
    hours: 'Mon – Sat, 9:30 am – 6:00 pm',
    mapEmbedUrl: '',
  },
  registration: {
    verified: false,
    legalName: '',
    registrationNumber: '',
    registrationType: '',
    pan: '',
    taxExemptionText: '',
    taxExemptionEnabled: false,
    otherCredentials: [],
  },
  social: [],
  announcement: {
    enabled: true,
    text: 'This is a demo website with sample content. Replace it from the admin panel.',
    linkLabel: 'Learn more',
    href: '/about',
    tone: 'accent',
  },
  header: { ctaLabel: 'Donate', ctaHref: '/donate', showSearch: true },
  footer: {
    about: 'A community-led nonprofit working for education, health, livelihoods and a greener tomorrow.',
    showNewsletter: true,
    newsletterHeading: 'Stories of change, once a month',
    newsletterText: 'Field updates, impact reports and ways to help. No spam — unsubscribe anytime.',
    copyright: '© {year} Saathi Foundation. All rights reserved.',
  },
  donation: {
    currency: 'INR',
    presetAmounts: [100000, 250000, 500000, 1000000],
    minAmount: 10000,
    maxAmount: 100000000,
    recurringEnabled: true,
    allowAnonymous: true,
    collectPhone: true,
    collectPan: false,
    thankYouHeading: 'Thank you for standing with us',
    thankYouMessage:
      'Your generosity reaches the communities we work with. A confirmation and receipt have been sent to your email address.',
    bankTransfer: { enabled: false, accountName: '', accountNumber: '', ifsc: '', bankName: '', branch: '', notes: '' },
    upi: { enabled: false, vpa: '', payeeName: '' },
    receiptFooter: 'This is a computer-generated receipt.',
    signatoryName: '',
    signatoryTitle: '',
  },
  seo: {
    titleTemplate: '%s | {site}',
    defaultDescription: 'A community-led nonprofit working across education, healthcare, livelihoods and the environment.',
    ogImage: '',
  },
  analytics: { googleAnalyticsId: '', plausibleDomain: '' },
  cookieConsent: {
    enabled: true,
    text: 'We use essential cookies to run this site and, with your consent, analytics to understand how it is used.',
    policyHref: '/privacy-policy',
  },
  features: { volunteers: true, events: true, blog: true, donorPortal: true, whatsappButton: true, languageSwitcher: false },
  languages: [{ code: 'en', label: 'English' }],
};

export const DEFAULT_NAVIGATION: Navigation = {
  header: [
    {
      label: 'About',
      href: '/about',
      children: [
        { label: 'Our Story', href: '/about', description: 'History, mission, vision and values' },
        { label: 'Leadership & Team', href: '/team', description: 'The people behind our work' },
        { label: 'Transparency', href: '/transparency', description: 'Financials, reports and policies' },
        { label: 'Careers', href: '/careers', description: 'Jobs, fellowships and internships' },
      ],
    },
    {
      label: 'Our Work',
      href: '/causes',
      children: [
        { label: 'Causes', href: '/causes', description: 'The issues we work on' },
        { label: 'Projects', href: '/projects', description: 'Programmes on the ground' },
        { label: 'Success Stories', href: '/stories', description: 'Change in people’s own words' },
        { label: 'Gallery', href: '/gallery', description: 'Moments from the field' },
      ],
    },
    { label: 'Campaigns', href: '/campaigns', children: [] },
    {
      label: 'Get Involved',
      href: '/volunteer',
      children: [
        { label: 'Volunteer', href: '/volunteer', description: 'Give your time and skills' },
        { label: 'Events', href: '/events', description: 'Join us on the ground' },
        { label: 'Fundraise', href: '/fundraise', description: 'Start a fundraiser for a cause' },
        { label: 'Become a Member', href: '/membership', description: 'Join our member community' },
        { label: 'Corporate & CSR', href: '/csr-partnerships', description: 'Partner with us' },
        { label: 'Sponsor a Program', href: '/sponsor', description: 'Fund a programme end-to-end' },
      ],
    },
    { label: 'News', href: '/blog', children: [] },
    { label: 'Contact', href: '/contact', children: [] },
  ],
  footer: [
    {
      title: 'Organisation',
      links: [
        { label: 'About us', href: '/about' },
        { label: 'Team', href: '/team' },
        { label: 'Annual reports', href: '/reports' },
        { label: 'Transparency', href: '/transparency' },
        { label: 'Careers', href: '/careers' },
      ],
    },
    {
      title: 'Our work',
      links: [
        { label: 'Causes', href: '/causes' },
        { label: 'Campaigns', href: '/campaigns' },
        { label: 'Projects', href: '/projects' },
        { label: 'Stories', href: '/stories' },
        { label: 'Events', href: '/events' },
      ],
    },
    {
      title: 'Get involved',
      links: [
        { label: 'Donate', href: '/donate' },
        { label: 'Volunteer', href: '/volunteer' },
        { label: 'Corporate partnerships', href: '/corporate-partnerships' },
        { label: 'FAQs', href: '/faqs' },
        { label: 'Contact', href: '/contact' },
      ],
    },
  ],
  legal: [
    { label: 'Privacy', href: '/privacy-policy' },
    { label: 'Terms', href: '/terms' },
    { label: 'Donation & refunds', href: '/donation-refund-policy' },
    { label: 'Child safeguarding', href: '/child-safeguarding-policy' },
    { label: 'Volunteer code', href: '/volunteer-code-of-conduct' },
    { label: 'Accessibility', href: '/accessibility' },
  ],
};
