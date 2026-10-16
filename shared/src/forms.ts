import { z } from 'zod';
import { INQUIRY_TYPES } from './enums.js';

const name = z.string().trim().min(2, 'Please enter your name').max(100);
const email = z.string().trim().toLowerCase().email('Please enter a valid email address').max(200);
const phone = z
  .string()
  .trim()
  .max(20)
  .refine((v) => v === '' || /^\+?[0-9 ()-]{7,20}$/.test(v), 'Please enter a valid phone number')
  .optional()
  .default('');
/** Hidden honeypot field: humans leave it empty. */
const honeypot = z.string().max(0, 'Spam detected').optional().default('');

export const utmSchema = z
  .object({
    source: z.string().max(100).optional(),
    medium: z.string().max(100).optional(),
    campaign: z.string().max(100).optional(),
    referrer: z.string().max(300).optional(),
  })
  .optional();

export const donationCheckoutSchema = z.object({
  amount: z.number().int().positive(), // minor units — re-validated against settings on the server
  frequency: z.enum(['ONE_TIME', 'MONTHLY']).default('ONE_TIME'),
  campaignSlug: z.string().max(120).optional(),
  causeSlug: z.string().max(120).optional(),
  eventSlug: z.string().max(120).optional(),
  name,
  email,
  phone,
  pan: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === '' || /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v), 'Invalid PAN')
    .optional()
    .default(''),
  address: z.string().trim().max(300).optional().default(''),
  isAnonymous: z.boolean().default(false),
  message: z.string().trim().max(500).optional().default(''),
  marketingOptIn: z.boolean().default(false),
  utm: utmSchema,
  website: honeypot,
});
export type DonationCheckoutInput = z.infer<typeof donationCheckoutSchema>;

export const volunteerApplicationSchema = z.object({
  name,
  email,
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, 'Please enter a valid phone number'),
  city: z.string().trim().min(2).max(100),
  dateOfBirth: z.string().refine((v) => v === '' || !Number.isNaN(Date.parse(v)), 'Invalid date').optional().default(''),
  occupation: z.string().trim().max(120).optional().default(''),
  interests: z.array(z.string().trim().max(60)).min(1, 'Choose at least one area of interest').max(10),
  skills: z.array(z.string().trim().max(60)).max(15).default([]),
  experience: z.string().trim().max(2000).optional().default(''),
  availability: z.enum(['WEEKDAYS', 'WEEKENDS', 'FLEXIBLE', 'FULL_TIME', 'REMOTE_ONLY']),
  hoursPerWeek: z.number().int().min(1).max(60).optional(),
  preferredLocation: z.string().trim().max(120).optional().default(''),
  motivation: z.string().trim().min(20, 'Tell us a little more (at least 20 characters)').max(2000),
  opportunitySlug: z.string().max(120).optional(),
  emergencyContact: z.string().trim().max(160).optional().default(''),
  agreeCodeOfConduct: z.literal(true, { errorMap: () => ({ message: 'Please accept the volunteer code of conduct' }) }),
  consentDataProcessing: z.literal(true, { errorMap: () => ({ message: 'Consent is required to process your application' }) }),
  website: honeypot,
});
export type VolunteerApplicationInput = z.infer<typeof volunteerApplicationSchema>;

export const eventRegistrationSchema = z.object({
  name,
  email,
  phone,
  type: z.enum(['ATTENDEE', 'VOLUNTEER']).default('ATTENDEE'),
  guests: z.number().int().min(0).max(5).default(0),
  website: honeypot,
});

export const inquirySchema = z.object({
  type: z.enum(INQUIRY_TYPES).default('GENERAL'),
  name,
  email,
  phone,
  organization: z.string().trim().max(160).optional().default(''),
  subject: z.string().trim().min(3, 'Please add a subject').max(160),
  message: z.string().trim().min(10, 'Please write a little more').max(4000),
  consent: z.literal(true, { errorMap: () => ({ message: 'Please agree so we can respond to you' }) }),
  website: honeypot,
});

export const newsletterSchema = z.object({
  email,
  name: z.string().trim().max(100).optional().default(''),
  consent: z.literal(true, { errorMap: () => ({ message: 'Please confirm you want to receive emails' }) }),
  source: z.string().max(60).optional(),
  website: honeypot,
});

export const VOLUNTEER_INTERESTS = [
  'Teaching & mentoring',
  'Healthcare camps',
  'Food distribution',
  'Women’s skill training',
  'Environment & tree planting',
  'Animal welfare',
  'Fundraising & events',
  'Design & communications',
  'Technology',
  'Research & documentation',
] as const;
