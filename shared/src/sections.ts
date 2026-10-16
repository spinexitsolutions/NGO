import { z } from 'zod';
import { defaultsFor, fieldsToZod, zodIssues, type FieldDef, type ValidationIssue } from './fields.js';
import { seoSchema } from './common.js';
import { ICONS, INQUIRY_TYPES, INQUIRY_TYPE_LABELS } from './enums.js';

function ICON_OPTIONS() {
  return ICONS.map((i) => ({ value: i, label: i.replace(/([a-z])([A-Z0-9])/g, '$1 $2') }));
}

const cta: FieldDef = {
  name: 'ctas',
  label: 'Buttons',
  type: 'repeater',
  maxItems: 3,
  fields: [
    { name: 'label', label: 'Label', type: 'text', required: true, max: 40 },
    { name: 'href', label: 'Link', type: 'link', required: true },
    {
      name: 'variant',
      label: 'Style',
      type: 'select',
      options: [
        { value: 'primary', label: 'Primary' },
        { value: 'accent', label: 'Accent' },
        { value: 'outline', label: 'Outline' },
        { value: 'ghost', label: 'Text link' },
      ],
    },
  ],
};
const eyebrow: FieldDef = { name: 'eyebrow', label: 'Eyebrow (small label above heading)', type: 'text', max: 60 };
const heading: FieldDef = { name: 'heading', label: 'Heading', type: 'text', max: 160 };
const intro: FieldDef = { name: 'intro', label: 'Introduction', type: 'textarea', max: 600 };
const limit = (def = 3): FieldDef => ({ name: 'limit', label: 'Number of items', type: 'number', min: 1, max: 12, help: `Default ${def}` });
const linkLabel: FieldDef = { name: 'linkLabel', label: '“View all” link label', type: 'text', max: 40 };
const layout = (opts: [string, string][]): FieldDef => ({
  name: 'layout',
  label: 'Layout',
  type: 'select',
  options: opts.map(([value, label]) => ({ value, label })),
});

export type DataSource =
  | 'causes'
  | 'campaigns'
  | 'projects'
  | 'stories'
  | 'events'
  | 'posts'
  | 'testimonials'
  | 'partners'
  | 'team'
  | 'impactStats'
  | 'faqs'
  | 'documents'
  | 'opportunities'
  | 'jobs'
  | 'gallery';

export interface SectionMeta {
  label: string;
  description: string;
  icon: string; // lucide icon name, used by the admin
  dataSource?: DataSource;
  fields: FieldDef[];
  defaults: Record<string, unknown>;
}

function meta(m: Omit<SectionMeta, 'defaults'> & { defaults?: Record<string, unknown> }): SectionMeta {
  return { ...m, defaults: { ...defaultsFor(m.fields), ...(m.defaults ?? {}) } };
}

export const SECTION_META = {
  hero: meta({
    label: 'Hero',
    description: 'Full-width cinematic banner with headline, buttons and rotating background photographs.',
    icon: 'Image',
    fields: [
      eyebrow,
      { ...heading, required: true },
      { name: 'subheading', label: 'Subheading', type: 'textarea', max: 400 },
      { name: 'images', label: 'Background images (rotate every few seconds)', type: 'images', maxItems: 6 },
      { name: 'imageAlts', label: 'Image descriptions (alt text, same order as images)', type: 'list', maxItems: 6 },
      { name: 'overlay', label: 'Darkening overlay (%)', type: 'number', min: 0, max: 90 },
      layout([
        ['left', 'Text left'],
        ['center', 'Text centred'],
      ]),
      {
        name: 'height',
        label: 'Height',
        type: 'select',
        options: [
          { value: 'full', label: 'Full screen' },
          { value: 'large', label: 'Large' },
          { value: 'medium', label: 'Medium (inner pages)' },
        ],
      },
      cta,
      { name: 'showScrollHint', label: 'Show scroll indicator', type: 'boolean' },
    ],
    defaults: { overlay: 55, height: 'full', showScrollHint: true },
  }),
  imageText: meta({
    label: 'Image + text',
    description: 'Story block with a large photograph beside text, highlights and buttons.',
    icon: 'LayoutPanelLeft',
    fields: [
      eyebrow,
      { ...heading, required: true },
      { name: 'body', label: 'Text', type: 'richtext', max: 6000 },
      { name: 'image', label: 'Image', type: 'image' },
      { name: 'imageAlt', label: 'Image description (alt text)', type: 'text', max: 200 },
      { name: 'secondaryImage', label: 'Secondary inset image (optional)', type: 'image' },
      {
        name: 'imagePosition',
        label: 'Image position',
        type: 'select',
        options: [
          { value: 'right', label: 'Right' },
          { value: 'left', label: 'Left' },
        ],
      },
      { name: 'highlights', label: 'Highlights (bullet points)', type: 'list', maxItems: 6, max: 160 },
      cta,
    ],
  }),
  missionVision: meta({
    label: 'Mission, vision & values',
    description: 'Mission and vision statements with a grid of core values.',
    icon: 'Compass',
    fields: [
      eyebrow,
      heading,
      { name: 'mission', label: 'Mission', type: 'textarea', max: 600 },
      { name: 'vision', label: 'Vision', type: 'textarea', max: 600 },
      {
        name: 'values',
        label: 'Core values',
        type: 'repeater',
        maxItems: 8,
        fields: [
          { name: 'title', label: 'Title', type: 'text', required: true, max: 60 },
          { name: 'description', label: 'Description', type: 'textarea', max: 300 },
          { name: 'icon', label: 'Icon', type: 'select', options: ICON_OPTIONS() },
        ],
      },
    ],
  }),
  stats: meta({
    label: 'Impact statistics',
    description: 'Animated counters from the Impact Statistics collection. Only published statistics are shown.',
    icon: 'BarChart3',
    dataSource: 'impactStats',
    fields: [
      eyebrow,
      heading,
      intro,
      {
        name: 'background',
        label: 'Background',
        type: 'select',
        options: [
          { value: 'primary', label: 'Brand colour' },
          { value: 'image', label: 'Photograph' },
          { value: 'light', label: 'Light' },
        ],
      },
      { name: 'image', label: 'Background photograph', type: 'image' },
      { name: 'footnote', label: 'Footnote (data source / period)', type: 'text', max: 200 },
    ],
  }),
  causes: meta({
    label: 'Causes grid',
    description: 'Cards for active causes from the Causes collection.',
    icon: 'HeartHandshake',
    dataSource: 'causes',
    fields: [eyebrow, heading, intro, limit(6), layout([['grid', 'Grid'], ['feature', 'Feature first']]), linkLabel],
    defaults: { limit: 6 },
  }),
  campaigns: meta({
    label: 'Campaigns',
    description: 'Active fundraising campaigns with live, verified progress.',
    icon: 'Target',
    dataSource: 'campaigns',
    fields: [
      eyebrow,
      heading,
      intro,
      limit(3),
      { name: 'featuredOnly', label: 'Only featured campaigns', type: 'boolean' },
      linkLabel,
    ],
    defaults: { limit: 3 },
  }),
  projects: meta({
    label: 'Projects',
    description: 'Latest projects and field activities.',
    icon: 'FolderKanban',
    dataSource: 'projects',
    fields: [eyebrow, heading, intro, limit(3), linkLabel],
    defaults: { limit: 3 },
  }),
  stories: meta({
    label: 'Success stories',
    description: 'Consented stories from communities.',
    icon: 'BookOpen',
    dataSource: 'stories',
    fields: [eyebrow, heading, intro, limit(3), linkLabel],
    defaults: { limit: 3 },
  }),
  events: meta({
    label: 'Upcoming events',
    description: 'Published upcoming events.',
    icon: 'CalendarDays',
    dataSource: 'events',
    fields: [eyebrow, heading, intro, limit(3), linkLabel],
    defaults: { limit: 3 },
  }),
  posts: meta({
    label: 'News & blog',
    description: 'Latest published blog posts.',
    icon: 'Newspaper',
    dataSource: 'posts',
    fields: [eyebrow, heading, intro, limit(3), linkLabel],
    defaults: { limit: 3 },
  }),
  testimonials: meta({
    label: 'Testimonials',
    description: 'Authorised testimonials (only those marked as consented are shown).',
    icon: 'Quote',
    dataSource: 'testimonials',
    fields: [eyebrow, heading, limit(6)],
    defaults: { limit: 6 },
  }),
  partners: meta({
    label: 'Partners & supporters',
    description: 'Partner logos from the Partners collection.',
    icon: 'Handshake',
    dataSource: 'partners',
    fields: [
      eyebrow,
      heading,
      intro,
      {
        name: 'partnerType',
        label: 'Show partner type',
        type: 'select',
        options: [
          { value: 'all', label: 'All' },
          { value: 'CORPORATE', label: 'Corporate' },
          { value: 'INSTITUTIONAL', label: 'Institutional' },
          { value: 'CSR', label: 'CSR' },
          { value: 'GOVERNMENT', label: 'Government' },
          { value: 'NGO', label: 'NGO / community' },
        ],
      },
    ],
  }),
  team: meta({
    label: 'Team',
    description: 'Team members from the Team collection, filtered by group.',
    icon: 'Users',
    dataSource: 'team',
    fields: [
      eyebrow,
      heading,
      intro,
      {
        name: 'group',
        label: 'Group',
        type: 'select',
        options: [
          { value: 'all', label: 'Everyone' },
          { value: 'FOUNDER', label: 'Founders' },
          { value: 'LEADERSHIP', label: 'Leadership' },
          { value: 'BOARD', label: 'Board members' },
          { value: 'ADVISOR', label: 'Advisors' },
          { value: 'STAFF', label: 'Staff' },
        ],
      },
    ],
  }),
  cta: meta({
    label: 'Call to action',
    description: 'A bold banner encouraging visitors to act.',
    icon: 'Megaphone',
    fields: [
      eyebrow,
      { ...heading, required: true },
      { name: 'body', label: 'Text', type: 'textarea', max: 600 },
      { name: 'image', label: 'Background photograph', type: 'image' },
      {
        name: 'style',
        label: 'Style',
        type: 'select',
        options: [
          { value: 'image', label: 'Photograph' },
          { value: 'primary', label: 'Brand colour' },
          { value: 'accent', label: 'Accent colour' },
        ],
      },
      cta,
    ],
  }),
  donationBanner: meta({
    label: 'Donation banner',
    description: 'Quick-donate panel with preset amounts that links into checkout.',
    icon: 'HandCoins',
    fields: [
      eyebrow,
      { ...heading, required: true },
      { name: 'body', label: 'Text', type: 'textarea', max: 600 },
      { name: 'image', label: 'Photograph', type: 'image' },
      { name: 'campaignSlug', label: 'Campaign slug (optional — donate to this campaign)', type: 'text', max: 120 },
      { name: 'impactLines', label: 'What a gift does (e.g. “₹1,000 — school kit for a child”)', type: 'list', maxItems: 4, max: 140 },
    ],
  }),
  newsletter: meta({
    label: 'Newsletter signup',
    description: 'Email subscription with consent.',
    icon: 'Mail',
    fields: [eyebrow, { ...heading, required: true }, { name: 'body', label: 'Text', type: 'textarea', max: 400 }],
  }),
  richText: meta({
    label: 'Rich text',
    description: 'Formatted text — policies, articles and long-form content.',
    icon: 'FileText',
    fields: [
      eyebrow,
      heading,
      { name: 'body', label: 'Content', type: 'richtext', required: true, max: 60000 },
      {
        name: 'width',
        label: 'Width',
        type: 'select',
        options: [
          { value: 'narrow', label: 'Narrow (reading)' },
          { value: 'standard', label: 'Standard' },
        ],
      },
    ],
  }),
  iconCards: meta({
    label: 'Icon cards',
    description: 'A grid of cards with icon, title and description (ways to help, programme areas…).',
    icon: 'LayoutGrid',
    fields: [
      eyebrow,
      heading,
      intro,
      {
        name: 'items',
        label: 'Cards',
        type: 'repeater',
        maxItems: 9,
        required: true,
        fields: [
          { name: 'icon', label: 'Icon', type: 'select', options: ICON_OPTIONS() },
          { name: 'title', label: 'Title', type: 'text', required: true, max: 80 },
          { name: 'description', label: 'Description', type: 'textarea', max: 300 },
          { name: 'href', label: 'Link (optional)', type: 'link' },
        ],
      },
    ],
  }),
  steps: meta({
    label: 'Steps / process',
    description: 'Numbered steps (how it works, how to apply).',
    icon: 'ListOrdered',
    fields: [
      eyebrow,
      heading,
      intro,
      {
        name: 'items',
        label: 'Steps',
        type: 'repeater',
        maxItems: 8,
        required: true,
        fields: [
          { name: 'title', label: 'Title', type: 'text', required: true, max: 80 },
          { name: 'description', label: 'Description', type: 'textarea', max: 300 },
        ],
      },
    ],
  }),
  timeline: meta({
    label: 'Timeline',
    description: 'Organisation history milestones.',
    icon: 'History',
    fields: [
      eyebrow,
      heading,
      {
        name: 'items',
        label: 'Milestones',
        type: 'repeater',
        maxItems: 20,
        required: true,
        fields: [
          { name: 'year', label: 'Year', type: 'text', required: true, max: 12 },
          { name: 'title', label: 'Title', type: 'text', required: true, max: 100 },
          { name: 'description', label: 'Description', type: 'textarea', max: 400 },
        ],
      },
    ],
  }),
  gallery: meta({
    label: 'Photo gallery',
    description: 'A masonry gallery with lightbox — from an album or hand-picked images.',
    icon: 'Images',
    dataSource: 'gallery',
    fields: [
      eyebrow,
      heading,
      { name: 'albumSlug', label: 'Album slug (leave empty to use the images below)', type: 'text', max: 120 },
      { name: 'images', label: 'Images', type: 'images', maxItems: 24 },
      limit(9),
    ],
    defaults: { limit: 9 },
  }),
  video: meta({
    label: 'Video',
    description: 'Embedded YouTube or Vimeo video with poster image.',
    icon: 'PlayCircle',
    fields: [
      eyebrow,
      heading,
      intro,
      { name: 'url', label: 'YouTube or Vimeo URL', type: 'link', required: true },
      { name: 'poster', label: 'Poster image', type: 'image' },
    ],
  }),
  faq: meta({
    label: 'FAQs',
    description: 'Accordion of questions from the FAQ collection.',
    icon: 'HelpCircle',
    dataSource: 'faqs',
    fields: [eyebrow, heading, intro, { name: 'category', label: 'Category filter (optional)', type: 'text', max: 60 }],
  }),
  documents: meta({
    label: 'Reports & documents',
    description: 'Downloadable annual reports, financial statements and policies.',
    icon: 'FileDown',
    dataSource: 'documents',
    fields: [
      eyebrow,
      heading,
      intro,
      {
        name: 'docType',
        label: 'Document type',
        type: 'select',
        options: [
          { value: 'all', label: 'All' },
          { value: 'ANNUAL_REPORT', label: 'Annual reports' },
          { value: 'FINANCIAL_STATEMENT', label: 'Financial statements' },
          { value: 'AUDIT_REPORT', label: 'Audit reports' },
          { value: 'IMPACT_REPORT', label: 'Impact reports' },
          { value: 'POLICY', label: 'Policies' },
          { value: 'REGISTRATION', label: 'Registration certificates' },
        ],
      },
    ],
  }),
  fundUtilisation: meta({
    label: 'Fund utilisation',
    description: 'How funds were used — enter only approved, audited figures and link the source statement.',
    icon: 'PieChart',
    fields: [
      eyebrow,
      heading,
      intro,
      { name: 'period', label: 'Financial year / period', type: 'text', max: 40 },
      {
        name: 'items',
        label: 'Allocation',
        type: 'repeater',
        maxItems: 8,
        fields: [
          { name: 'label', label: 'Label', type: 'text', required: true, max: 60 },
          { name: 'percent', label: 'Percent', type: 'number', required: true, min: 0, max: 100 },
        ],
      },
      { name: 'sourceLabel', label: 'Source label', type: 'text', max: 120 },
      { name: 'sourceHref', label: 'Source document link', type: 'link' },
      { name: 'isSample', label: 'These are sample figures (shows a “sample data” label)', type: 'boolean' },
    ],
  }),
  contact: meta({
    label: 'Contact details & form',
    description: 'Office address, phone, email, map and a contact form.',
    icon: 'MapPin',
    fields: [eyebrow, heading, intro, { name: 'showMap', label: 'Show map (if configured in settings)', type: 'boolean' }],
    defaults: { showMap: true },
  }),
  inquiryForm: meta({
    label: 'Inquiry form',
    description: 'A form for partnerships, CSR, membership, fundraising, sponsorship or donation support.',
    icon: 'ClipboardList',
    fields: [
      eyebrow,
      { ...heading, required: true },
      intro,
      {
        name: 'formType',
        label: 'Form type',
        type: 'select',
        options: INQUIRY_TYPES.map((t) => ({ value: t, label: INQUIRY_TYPE_LABELS[t] })),
      },
      { name: 'submitLabel', label: 'Submit button label', type: 'text', max: 40 },
      { name: 'successMessage', label: 'Success message', type: 'textarea', max: 300 },
    ],
  }),
  opportunities: meta({
    label: 'Volunteer opportunities',
    description: 'Open volunteer opportunities with apply buttons.',
    icon: 'HandHeart',
    dataSource: 'opportunities',
    fields: [eyebrow, heading, intro, limit(6)],
    defaults: { limit: 6 },
  }),
  jobs: meta({
    label: 'Careers & internships',
    description: 'Open positions from the Careers collection.',
    icon: 'Briefcase',
    dataSource: 'jobs',
    fields: [eyebrow, heading, intro],
  }),
  credentials: meta({
    label: 'Registration & credentials',
    description: 'Shows legal registration details from settings — only when marked verified.',
    icon: 'BadgeCheck',
    fields: [eyebrow, heading, intro],
  }),
} satisfies Record<string, SectionMeta>;

export type SectionType = keyof typeof SECTION_META;
export const SECTION_TYPES = Object.keys(SECTION_META) as SectionType[];

export const sectionPropsSchemas = Object.fromEntries(
  SECTION_TYPES.map((t) => [t, fieldsToZod(SECTION_META[t].fields)]),
) as Record<SectionType, ReturnType<typeof fieldsToZod>>;

export const sectionBaseSchema = z.object({
  id: z.string().min(1).max(40),
  type: z.enum(SECTION_TYPES as [SectionType, ...SectionType[]]),
  visible: z.boolean().default(true),
  background: z.enum(['default', 'alt', 'dark']).default('default'),
  anchor: z.string().regex(/^[a-z0-9-]*$/).max(40).default(''),
  props: z.record(z.unknown()),
});
export type Section = z.infer<typeof sectionBaseSchema>;

/** Draft schema: structure is checked, props may be incomplete. */
export const pageDraftSchema = z.object({
  title: z.string().trim().max(160).default(''),
  seo: seoSchema,
  sections: z.array(sectionBaseSchema).max(40).default([]),
});
export type PageDraft = z.infer<typeof pageDraftSchema>;

export interface SectionError {
  index: number;
  id: string;
  type: string;
  issues: ValidationIssue[];
}

/** Full validation used on publish: every section's props must satisfy its schema. */
export function validateSections(sections: Section[]): { sections: Section[]; errors: SectionError[] } {
  const errors: SectionError[] = [];
  const out: Section[] = [];
  sections.forEach((s, index) => {
    const schema = sectionPropsSchemas[s.type as SectionType];
    const r = schema.safeParse(s.props);
    if (!r.success) errors.push({ index, id: s.id, type: s.type, issues: zodIssues(r.error) });
    else out.push({ ...s, props: r.data });
  });
  return { sections: out, errors };
}

export function newSectionId(): string {
  return `s_${Math.random().toString(36).slice(2, 10)}`;
}

export function createSection(type: SectionType, props: Record<string, unknown> = {}): Section {
  return {
    id: newSectionId(),
    type,
    visible: true,
    background: 'default',
    anchor: '',
    props: structuredClone({ ...SECTION_META[type].defaults, ...props }),
  };
}

