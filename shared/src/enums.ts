// --- shared enums used by sections & forms --------------------------------------------------------

export const INQUIRY_TYPES = [
  'GENERAL',
  'VOLUNTEER',
  'CORPORATE',
  'CSR',
  'DONATION_SUPPORT',
  'MEMBERSHIP',
  'FUNDRAISE',
  'SPONSOR',
  'CAREERS',
  'MEDIA',
] as const;
export type InquiryType = (typeof INQUIRY_TYPES)[number];
export const INQUIRY_TYPE_LABELS: Record<InquiryType, string> = {
  GENERAL: 'General inquiry',
  VOLUNTEER: 'Volunteer inquiry',
  CORPORATE: 'Corporate partnership',
  CSR: 'CSR partnership',
  DONATION_SUPPORT: 'Donation support',
  MEMBERSHIP: 'Membership',
  FUNDRAISE: 'Fundraise for our cause',
  SPONSOR: 'Sponsor a programme',
  CAREERS: 'Careers & internships',
  MEDIA: 'Media & press',
};

export const ICONS = [
  'GraduationCap',
  'Stethoscope',
  'HeartHandshake',
  'Users',
  'Leaf',
  'Utensils',
  'Home',
  'Accessibility',
  'PawPrint',
  'Droplets',
  'Sprout',
  'ShieldCheck',
  'Scale',
  'Sparkles',
  'HandHeart',
  'Globe2',
  'Lightbulb',
  'BookOpen',
  'Building2',
  'Eye',
  'Target',
  'Award',
] as const;
