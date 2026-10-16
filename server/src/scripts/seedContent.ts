import { createSection, type Section } from '@ngo/shared';

/**
 * Photography: Unsplash (https://unsplash.com/license — free to use, no permission needed).
 * These are placeholders that illustrate the design. Replace them with your own photographs of your
 * programmes (with consent) from Admin → Media. Never present stock images as proof of your activities.
 */
export const img = (id: string, w = 1600) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

export const IMAGES = {
  heroChildren: img('1488521787991-ed7bbaae773c', 2400),
  heroLearning: img('1509099836639-18ba1795216d', 2400),
  heroVolunteers: img('1593113598332-cd288d649433', 2400),
  classroom: img('1503676260728-1c00da094a0b'),
  classroom2: img('1509062522246-3755977927d7'),
  classroom3: img('1497486751825-1233686d5d80'),
  health: img('1532938911079-1b06ac7ceec7'),
  health2: img('1579684385127-1ef15d508118'),
  health3: img('1505751172876-fa1923c5c528'),
  women: img('1556761175-5973dc0f32e7'),
  women2: img('1573497019940-1c28c88b4f3e'),
  food: img('1593113598332-cd288d649433'),
  food2: img('1488459716781-31db52582fe9'),
  food3: img('1512621776951-a57141f2eefd'),
  sapling: img('1542601906990-b4d3fb778b09'),
  forest: img('1441974231531-c6227db76b6e', 2400),
  garden: img('1416879595882-3373a0480b5b'),
  soil: img('1523348837708-15d4a09cfac2'),
  fields: img('1500382017468-9049fed747ef', 2400),
  farm: img('1464226184884-fa280b87c399'),
  dogs: img('1548199973-03cce0bbc87b'),
  volunteers: img('1559027615-cd4628902d4a'),
  volunteers2: img('1532629345422-7515f3d16bb6'),
  hands: img('1469571486292-0ba58a3f068b'),
  community: img('1529156069898-49953e39b3ac'),
  community2: img('1511632765486-a01980e01a18'),
  conference: img('1540575467063-178a50c2df87'),
  hall: img('1511578314322-379afb476865'),
  study: img('1522202176988-66273c2fd55f'),
  meeting: img('1517048676732-d65bc937f952'),
  mountains: img('1470071459604-3b5ec3a7fe05', 2400),
  p1: img('1573497019940-1c28c88b4f3e', 800),
  p2: img('1507003211169-0a1dd7228f2d', 800),
  p3: img('1438761681033-6461ffad8d80', 800),
  p4: img('1500648767791-00dcc994a43e', 800),
  p5: img('1494790108377-be9c29b29330', 800),
  p6: img('1472099645785-5658abf4ff4e', 800),
  p7: img('1544005313-94ddf0286df2', 800),
  p8: img('1560250097-0b93528c311a', 800),
};

const btn = (label: string, href: string, variant: 'primary' | 'accent' | 'outline' | 'ghost' = 'primary') => ({ label, href, variant });
const s = (type: Parameters<typeof createSection>[0], props: Record<string, unknown>, extra: Partial<Section> = {}): Section => ({ ...createSection(type, props), ...extra });
const innerHero = (heading: string, subheading: string, image: string, eyebrow = '', alt = '') =>
  s('hero', { eyebrow, heading, subheading, images: [image], imageAlts: [alt || heading], height: 'medium', overlay: 55, layout: 'left', showScrollHint: false, ctas: [] });

const legalNote =
  '> **Template text.** This policy is a starting point provided with the website. Review and adapt it with a qualified adviser for your jurisdiction before relying on it.\n\n';

export interface SeedPage {
  slug: string;
  title: string;
  description: string;
  sections: Section[];
}

export const SEED_PAGES: SeedPage[] = [
  {
    slug: 'home',
    title: 'Home',
    description: 'A community-led nonprofit working across education, healthcare, livelihoods and the environment.',
    sections: [
      s('hero', {
        eyebrow: 'Since 2012 · Community-led change',
        heading: 'Every child deserves the chance to learn, grow and dream',
        subheading: 'We walk alongside families in underserved communities — opening classrooms, running health camps, training women entrepreneurs and restoring the land they depend on.',
        images: [IMAGES.heroChildren, IMAGES.heroLearning, IMAGES.heroVolunteers],
        imageAlts: ['Children smiling together outdoors', 'A young student writing in a notebook', 'Volunteers packing food supplies into boxes'],
        overlay: 50,
        layout: 'left',
        height: 'full',
        ctas: [btn('Donate now', '/donate', 'accent'), btn('Volunteer with us', '/volunteer', 'outline'), btn('Explore our work', '/causes', 'ghost')],
        showScrollHint: true,
      }),
      s('imageText', {
        eyebrow: 'Who we are',
        heading: 'Rooted in communities. Accountable to them.',
        body: 'We are a nonprofit that believes lasting change is built **with** communities, not for them. Our field teams live where they work, our programmes are shaped by local leaders, and every rupee is tracked from donor to doorstep.\n\nFrom village classrooms to mobile health clinics, we focus on the foundations of a dignified life: learning, health, livelihoods and a healthy environment.',
        image: IMAGES.community,
        imageAlt: 'A group of friends from the community laughing together',
        secondaryImage: IMAGES.classroom,
        imagePosition: 'right',
        highlights: ['Programmes co-designed with community leaders', 'Independent annual audits', 'Every donation receipted and traceable'],
        ctas: [btn('Our story', '/about', 'primary'), btn('See our financials', '/transparency', 'ghost')],
      }),
      s('missionVision', {
        eyebrow: 'What guides us',
        heading: 'Mission, vision and values',
        mission: 'To empower underserved communities with access to quality education, healthcare and livelihoods, while protecting the environment they depend on.',
        vision: 'A world where every person, regardless of where they are born, can live with dignity, health and opportunity.',
        values: [
          { title: 'Dignity first', description: 'We tell stories with consent and treat every person as the author of their own change.', icon: 'HeartHandshake' },
          { title: 'Radical transparency', description: 'Audited accounts, published reports and receipts for every gift.', icon: 'Eye' },
          { title: 'Community-led', description: 'Local leaders shape priorities, budgets and how success is measured.', icon: 'Users' },
          { title: 'Long-term thinking', description: 'We stay for the long haul and design for what lasts after we leave.', icon: 'Sprout' },
        ],
      }, { background: 'alt' }),
      s('stats', {
        eyebrow: 'Our impact',
        heading: 'Change you can measure',
        intro: 'Numbers are updated from our programme records each quarter.',
        background: 'image',
        image: IMAGES.fields,
        footnote: 'Sample figures for demonstration. Replace with verified numbers in Admin → Content → Impact statistics.',
      }),
      s('causes', { eyebrow: 'What we do', heading: 'Causes we work for', intro: 'Choose a cause close to your heart. Every programme is designed with the people it serves.', limit: 6, layout: 'feature', linkLabel: 'All causes' }),
      s('campaigns', { eyebrow: 'Give today', heading: 'Campaigns that need you now', intro: 'Progress bars show only verified, successful donations.', limit: 3, featuredOnly: false, linkLabel: 'All campaigns' }, { background: 'alt' }),
      s('donationBanner', {
        eyebrow: 'Make a difference',
        heading: 'Your gift goes where it is needed most',
        body: 'Give once or every month. You will receive an instant receipt by email.',
        image: IMAGES.classroom2,
        campaignSlug: '',
        impactLines: ['₹1,000 — a full set of school supplies for a child', '₹2,500 — a health check-up camp visit for a family', '₹5,000 — seed capital for a woman’s micro-enterprise'],
      }),
      s('projects', { eyebrow: 'On the ground', heading: 'Latest projects and field activities', limit: 3, linkLabel: 'All projects' }),
      s('stories', { eyebrow: 'Stories of change', heading: 'In their own words', intro: 'Shared with consent. Names are changed where people asked us to.', limit: 3, linkLabel: 'More stories' }, { background: 'alt' }),
      s('events', { eyebrow: 'Join us', heading: 'Upcoming events', limit: 3, linkLabel: 'All events' }),
      s('cta', {
        eyebrow: 'Get involved',
        heading: 'Give your time, skills or voice',
        body: 'Teach a class, run a health camp, design a campaign or organise a fundraiser. There is a place for everyone.',
        image: IMAGES.volunteers,
        style: 'image',
        ctas: [btn('Become a volunteer', '/volunteer', 'accent'), btn('Start a fundraiser', '/fundraise', 'outline')],
      }),
      s('fundUtilisation', {
        eyebrow: 'Transparency',
        heading: 'Where your money goes',
        intro: 'We publish audited financial statements every year.',
        period: 'FY 2025-26',
        items: [
          { label: 'Programmes', percent: 82 },
          { label: 'Fundraising', percent: 10 },
          { label: 'Administration', percent: 8 },
        ],
        sourceLabel: 'Audited financial statements',
        sourceHref: '/transparency',
        isSample: true,
      }, { background: 'alt' }),
      s('posts', { eyebrow: 'News & insights', heading: 'From the field', limit: 3, linkLabel: 'Read the blog' }),
      s('testimonials', { eyebrow: 'Voices', heading: 'What our supporters say', limit: 6 }),
      s('partners', { eyebrow: 'Together', heading: 'Partners and supporters', partnerType: 'all' }),
      s('newsletter', { eyebrow: 'Stay close', heading: 'Stories of change, once a month', body: 'Field updates, impact reports and ways to help. Unsubscribe anytime.' }, { background: 'dark' }),
    ],
  },
  {
    slug: 'about',
    title: 'About us',
    description: 'Our history, mission, values, leadership and registration details.',
    sections: [
      innerHero('About us', 'A community-led nonprofit working for education, health, livelihoods and a greener tomorrow.', IMAGES.community2, 'Our story', 'Community members gathered together'),
      s('imageText', {
        eyebrow: 'How it began',
        heading: 'From one evening class to a movement',
        body: 'It started with a handful of volunteers teaching children under a streetlight. Parents asked for more — then for health camps, then for skills training. Over a decade later, the same spirit guides everything we do: listen first, act together, and stay accountable.\n\n*(Sample history — replace with your organisation’s story.)*',
        image: IMAGES.classroom3,
        imageAlt: 'Children in a classroom',
        imagePosition: 'left',
        highlights: [],
        ctas: [],
      }),
      s('missionVision', {
        eyebrow: 'Our compass',
        heading: 'Mission, vision and values',
        mission: 'To empower underserved communities with access to quality education, healthcare and livelihoods, while protecting the environment they depend on.',
        vision: 'A world where every person can live with dignity, health and opportunity.',
        values: [
          { title: 'Dignity first', description: 'Consent and respect in everything we do and say.', icon: 'HeartHandshake' },
          { title: 'Transparency', description: 'Open books, published audits, receipts for every gift.', icon: 'Eye' },
          { title: 'Community-led', description: 'Local leaders shape what we do and how we measure it.', icon: 'Users' },
          { title: 'Safeguarding', description: 'Zero tolerance for harm, especially to children.', icon: 'ShieldCheck' },
        ],
      }, { background: 'alt' }),
      s('timeline', {
        eyebrow: 'Milestones',
        heading: 'Our journey',
        items: [
          { year: '2012', title: 'First evening class', description: 'Volunteers start teaching 20 children. (Sample)' },
          { year: '2015', title: 'Health camps begin', description: 'Monthly medical camps with partner doctors. (Sample)' },
          { year: '2019', title: 'Women’s livelihood programme', description: 'Skills training and seed capital for women entrepreneurs. (Sample)' },
          { year: '2024', title: 'Green villages', description: 'Community tree planting and water conservation. (Sample)' },
        ],
      }),
      s('team', { eyebrow: 'Leadership', heading: 'The people behind our work', group: 'LEADERSHIP', intro: '' }, { background: 'alt' }),
      s('credentials', { eyebrow: 'Accountability', heading: 'Registration and credentials', intro: 'Our legal registration details. Copies of certificates are available on request.' }),
      s('documents', { eyebrow: 'Reports', heading: 'Annual reports and policies', intro: '', docType: 'all' }, { background: 'alt' }),
      s('partners', { eyebrow: 'Together', heading: 'Partners and institutional supporters', partnerType: 'all' }),
      s('cta', { heading: 'Join us in building a fairer world', body: 'Give, volunteer or partner with us.', style: 'primary', image: '', ctas: [btn('Donate', '/donate', 'accent'), btn('Partner with us', '/corporate-partnerships', 'outline')] }),
    ],
  },
  {
    slug: 'team',
    title: 'Leadership & team',
    description: 'Founders, leadership, board members, advisors and staff.',
    sections: [
      innerHero('Leadership & team', 'The founders, board, advisors and staff who make our work possible.', IMAGES.meeting, 'Our people', 'A team meeting around a table'),
      s('team', { eyebrow: 'Founders', heading: 'Founders', group: 'FOUNDER' }),
      s('team', { eyebrow: 'Leadership', heading: 'Leadership team', group: 'LEADERSHIP' }, { background: 'alt' }),
      s('team', { eyebrow: 'Governance', heading: 'Board members', group: 'BOARD' }),
      s('team', { eyebrow: 'Guidance', heading: 'Advisors', group: 'ADVISOR' }, { background: 'alt' }),
      s('team', { eyebrow: 'Our staff', heading: 'Staff', group: 'STAFF' }),
    ],
  },
  {
    slug: 'causes',
    title: 'Our causes',
    description: 'Education, healthcare, women empowerment, food security, environment and more.',
    sections: [innerHero('Our causes', 'The issues we work on, together with the communities who live them.', IMAGES.classroom, 'What we do', 'Children in a classroom raising hands')],
  },
  {
    slug: 'campaigns',
    title: 'Campaigns',
    description: 'Active, upcoming and completed fundraising campaigns.',
    sections: [innerHero('Campaigns', 'Back a specific goal and follow its progress — every total is calculated from verified donations.', IMAGES.volunteers2, 'Give with purpose', 'Volunteers holding a donation box')],
  },
  {
    slug: 'projects',
    title: 'Projects & impact',
    description: 'Our programmes on the ground, with progress updates and outcomes.',
    sections: [innerHero('Projects & impact', 'Where we work, what we do and what has changed.', IMAGES.farm, 'On the ground', 'Green farmland')],
  },
  {
    slug: 'stories',
    title: 'Success stories',
    description: 'Stories of change, shared with consent.',
    sections: [innerHero('Success stories', 'Change in people’s own words — always shared with consent.', IMAGES.community, 'Voices', 'Friends laughing together')],
  },
  {
    slug: 'events',
    title: 'Events & activities',
    description: 'Upcoming events, fundraisers and volunteer drives.',
    sections: [innerHero('Events & activities', 'Walks, drives, camps and celebrations — come and be part of it.', IMAGES.conference, 'Join us', 'A crowd at an event')],
  },
  {
    slug: 'gallery',
    title: 'Gallery',
    description: 'Moments from our work.',
    sections: [innerHero('Gallery', 'Moments from classrooms, clinics, fields and gatherings.', IMAGES.forest, 'In pictures', 'Sunlight through a forest')],
  },
  {
    slug: 'blog',
    title: 'News & blog',
    description: 'News, field notes and insights.',
    sections: [innerHero('News & blog', 'Field notes, announcements and ideas from our team.', IMAGES.study, 'Read', 'People studying together')],
  },
  {
    slug: 'donate',
    title: 'Donate',
    description: 'Make a secure one-time or monthly donation.',
    sections: [
      innerHero('Make a gift that lasts', 'Secure, receipted and traceable. Choose a cause or let us direct your gift where it is needed most.', IMAGES.hands, 'Donate', 'Hands joined together'),
      s('faq', { eyebrow: 'Questions', heading: 'Donation FAQs', category: 'Donations' }, { background: 'alt' }),
    ],
  },
  {
    slug: 'volunteer',
    title: 'Volunteer with us',
    description: 'Give your time and skills.',
    sections: [
      innerHero('Volunteer with us', 'Teach, heal, build, design, organise — your time changes lives.', IMAGES.volunteers, 'Get involved', 'Volunteers working together'),
      s('steps', {
        eyebrow: 'How it works',
        heading: 'From application to impact',
        items: [
          { title: 'Apply online', description: 'Tell us about your interests, skills and availability.' },
          { title: 'Meet the team', description: 'A short conversation with our volunteer coordinator.' },
          { title: 'Orientation', description: 'Safeguarding, code of conduct and programme briefing.' },
          { title: 'Start making a difference', description: 'Get assigned to a project or event and log your hours.' },
        ],
      }),
      s('iconCards', {
        eyebrow: 'Ways to help',
        heading: 'Find your fit',
        items: [
          { icon: 'GraduationCap', title: 'Teach & mentor', description: 'Weekend classes, reading circles and career mentoring.', href: '' },
          { icon: 'Stethoscope', title: 'Health camps', description: 'Doctors, nurses and helpers for community health camps.', href: '' },
          { icon: 'Utensils', title: 'Food drives', description: 'Pack and distribute nutrition kits.', href: '' },
          { icon: 'Leaf', title: 'Green action', description: 'Tree planting and water conservation drives.', href: '' },
          { icon: 'Lightbulb', title: 'Skilled volunteering', description: 'Design, tech, research, finance and communications.', href: '' },
          { icon: 'Sparkles', title: 'Fundraise', description: 'Run a fundraiser among friends or at work.', href: '/fundraise' },
        ],
      }, { background: 'alt' }),
    ],
  },
  ...(
    [
      ['membership', 'Become a member', 'Join our member community and help shape our direction.', 'MEMBERSHIP', IMAGES.community2, 'Members receive our quarterly impact briefings, vote at the annual general meeting (where applicable under our constitution) and join member-only field visits.'],
      ['fundraise', 'Fundraise for our cause', 'Run a marathon, celebrate a birthday or rally your workplace.', 'FUNDRAISE', IMAGES.volunteers2, 'Tell us what you have in mind and we will set up a campaign page, share stories and photos you can use, and send receipts to everyone who gives.'],
      ['corporate-partnerships', 'Corporate partnerships', 'Partner with us for employee engagement, cause marketing and in-kind support.', 'CORPORATE', IMAGES.meeting, 'We work with companies on employee volunteering days, matched giving, cause-related marketing and pro-bono expertise — with clear reporting on outcomes.'],
      ['csr-partnerships', 'CSR partnerships', 'Implement your CSR programmes with an accountable, community-led partner.', 'CSR', IMAGES.fields, 'We design and implement CSR projects aligned with your focus areas, with baseline studies, milestone-based reporting, utilisation certificates and field visits. Eligibility details are shared on request once verified.'],
      ['sponsor', 'Sponsor a programme', 'Fund a classroom, a health camp series or a livelihood cohort end-to-end.', 'SPONSOR', IMAGES.classroom2, 'Sponsors receive a programme plan, quarterly progress updates with photographs (shared with consent) and a final outcome report.'],
    ] as const
  ).map(([slug, title, sub, formType, image, body]) => ({
    slug,
    title,
    description: sub,
    sections: [
      innerHero(title, sub, image, 'Get involved'),
      s('imageText', { eyebrow: 'Why partner with us', heading: title, body, image, imageAlt: title, imagePosition: 'right', highlights: ['Dedicated relationship manager', 'Transparent reporting', 'Field visits on request'], ctas: [] }),
      s('inquiryForm', { heading: 'Start the conversation', intro: 'Share a few details and our team will get back to you within two working days.', formType, submitLabel: 'Send', successMessage: 'Thank you! We have received your message and will be in touch soon.' }, { background: 'alt' }),
    ],
  })),
  {
    slug: 'careers',
    title: 'Careers & internships',
    description: 'Jobs, fellowships and internships.',
    sections: [
      innerHero('Careers & internships', 'Build a career with purpose.', IMAGES.study, 'Work with us', 'People studying together'),
      s('jobs', { eyebrow: 'Open positions', heading: 'Current openings', intro: '' }),
      s('inquiryForm', { heading: 'Don’t see a role?', intro: 'Tell us about yourself and the kind of work you would like to do.', formType: 'CAREERS', submitLabel: 'Send', successMessage: 'Thanks! We keep every message on file and reach out when a fitting role opens.' }, { background: 'alt' }),
    ],
  },
  {
    slug: 'transparency',
    title: 'Financial transparency',
    description: 'How we raise and use funds, audited statements and policies.',
    sections: [
      innerHero('Financial transparency', 'Open books, audited accounts and a receipt for every gift.', IMAGES.mountains, 'Accountability', 'Misty mountains'),
      s('richText', {
        heading: 'Our approach',
        body: '- Every online donation is verified with the payment gateway before it is counted.\n- Totals on this website are calculated live from successful transactions — never typed in by hand.\n- Our accounts are audited every year by an independent auditor, and the reports are published below.\n- We never sell or share donor data.',
        width: 'narrow',
      }),
      s('fundUtilisation', {
        eyebrow: 'Fund utilisation',
        heading: 'Where the money goes',
        intro: '',
        period: 'FY 2025-26',
        items: [
          { label: 'Programmes', percent: 82 },
          { label: 'Fundraising', percent: 10 },
          { label: 'Administration', percent: 8 },
        ],
        sourceLabel: 'Audited financial statements',
        sourceHref: '/reports',
        isSample: true,
      }, { background: 'alt' }),
      s('credentials', { eyebrow: 'Legal', heading: 'Registration details', intro: '' }),
      s('documents', { eyebrow: 'Documents', heading: 'Financial statements & audit reports', intro: '', docType: 'FINANCIAL_STATEMENT' }, { background: 'alt' }),
      s('documents', { eyebrow: 'Governance', heading: 'Policies', intro: '', docType: 'POLICY' }),
    ],
  },
  {
    slug: 'reports',
    title: 'Annual reports',
    description: 'Annual reports and impact reports.',
    sections: [innerHero('Annual reports', 'Our year in review — programmes, people and finances.', IMAGES.garden, 'Reports'), s('documents', { heading: 'All reports', docType: 'all', intro: '' })],
  },
  {
    slug: 'faqs',
    title: 'Frequently asked questions',
    description: 'Answers about donating, volunteering, receipts and our work.',
    sections: [innerHero('Frequently asked questions', 'Can’t find an answer? Contact us.', IMAGES.hands, 'Help'), s('faq', { heading: 'Questions & answers', category: '', intro: '' })],
  },
  {
    slug: 'contact',
    title: 'Contact us',
    description: 'Get in touch with our team.',
    sections: [innerHero('Contact us', 'We would love to hear from you.', IMAGES.community2, 'Say hello'), s('contact', { heading: 'Get in touch', intro: 'Write to us, call, or drop by during office hours.', showMap: true })],
  },
  ...(
    [
      ['privacy-policy', 'Privacy policy', `${legalNote}## What we collect\nWhen you donate, volunteer, register for an event, subscribe or contact us, we collect the details you provide (such as name, email, phone and, where required for receipts, address and PAN). Payment card details are handled entirely by our payment partner and are **never** stored on our systems.\n\n## Why we use it\nTo process donations and issue receipts, respond to you, manage volunteering and events, and — only if you opt in — send you updates.\n\n## Sharing\nWe never sell your data. We share it only with service providers who help us operate (payments, email, hosting) under confidentiality obligations, or where required by law.\n\n## Your choices\nYou can unsubscribe from emails at any time, download your donor data from the donor portal, or ask us to correct or erase your personal data (financial records are retained as required by law).\n\n## Retention\nDonation records are kept for the period required by applicable law. Other data is deleted when no longer needed.\n\n## Contact\nWrite to us using the details on our contact page.`],
      ['terms', 'Terms and conditions', `${legalNote}By using this website you agree to use it lawfully and not to misuse forms or attempt to disrupt the service. Content is provided for information; while we work to keep it accurate, it may change without notice. Photographs of people are used with consent and may not be reused without permission.`],
      ['donation-refund-policy', 'Donation and refund policy', `${legalNote}## Donations\nDonations are voluntary contributions towards our charitable objectives. You will receive an email confirmation and a receipt once your payment is verified.\n\n## Refunds\nIf you donated in error (for example, a wrong amount or a duplicate payment), contact us within 15 days with your donation reference. Approved refunds are processed to the original payment method, usually within 5–10 working days.\n\n## Monthly giving\nYou can cancel a monthly donation at any time from the donor portal or by contacting us. Cancellation stops future charges.\n\n## Tax benefits\nTax-benefit information is shown on receipts **only** where our registrations have been verified and the benefit applies.`],
      ['child-safeguarding-policy', 'Child safeguarding policy', `${legalNote}We have zero tolerance for abuse or exploitation of children. Every staff member and volunteer working with children undergoes screening, signs our code of conduct and completes safeguarding orientation.\n\n- We never publish children’s full names, home addresses, school names or other identifying details.\n- Photographs are taken and used only with informed consent from parents or guardians.\n- Adults never spend time alone with a child out of sight of others.\n- Concerns can be reported confidentially to our designated safeguarding officer via the contact page.`],
      ['volunteer-code-of-conduct', 'Volunteer code of conduct', `${legalNote}As a volunteer you agree to:\n\n1. Treat everyone with respect and dignity, without discrimination.\n2. Follow our child safeguarding policy at all times.\n3. Protect the privacy of the people we serve — no photos or posts without consent and approval.\n4. Never accept or offer gifts or money in connection with your volunteering.\n5. Represent the organisation honestly and follow staff instructions on site.\n6. Report any concern or incident to the volunteer coordinator immediately.`],
      ['accessibility', 'Accessibility statement', `${legalNote}We want everyone to be able to use this website. It is designed to meet WCAG 2.1 AA: keyboard navigation, visible focus states, sufficient colour contrast, descriptive alternative text, captions where available and support for reduced-motion preferences.\n\nIf you find something difficult to use, please tell us through the contact page and we will fix it.`],
    ] as const
  ).map(([slug, title, body]) => ({
    slug,
    title,
    description: title,
    sections: [s('hero', { heading: title, subheading: '', images: [], imageAlts: [], height: 'medium', overlay: 0, layout: 'left', ctas: [], showScrollHint: false }), s('richText', { body, width: 'narrow' })],
  })),
];

export const SEED_CAUSES = [
  ['education', 'Education & child development', 'Quality learning, from early literacy to career guidance, in schools and community learning centres.', 'GraduationCap', IMAGES.classroom, 'Children raising their hands in a classroom', [IMAGES.classroom2, IMAGES.classroom3, IMAGES.study]],
  ['healthcare', 'Healthcare & medical assistance', 'Mobile health camps, maternal care and referrals to quality treatment for families who cannot afford it.', 'Stethoscope', IMAGES.health, 'A stethoscope on a doctor’s desk', [IMAGES.health2, IMAGES.health3]],
  ['women-empowerment', 'Women empowerment', 'Skills training, savings groups and seed capital that help women build their own livelihoods.', 'Users', IMAGES.women, 'Women collaborating in a workshop', [IMAGES.women2]],
  ['food-nutrition', 'Food & nutrition', 'Nutrition kits, community kitchens and kitchen gardens for families facing hunger.', 'Utensils', IMAGES.food, 'Volunteers packing food boxes', [IMAGES.food2, IMAGES.food3]],
  ['environment', 'Environmental sustainability', 'Tree planting, water conservation and climate-resilient farming with village communities.', 'Leaf', IMAGES.sapling, 'Hands holding a young sapling', [IMAGES.forest, IMAGES.soil, IMAGES.garden]],
  ['rural-development', 'Rural development', 'Community infrastructure, sanitation and access to government schemes in remote villages.', 'Home', IMAGES.fields, 'Golden fields at sunset', [IMAGES.farm]],
  ['poverty-alleviation', 'Poverty alleviation', 'Emergency relief and pathways out of poverty through livelihoods and social protection.', 'HandHeart', IMAGES.volunteers2, 'Volunteers holding a donation box', [IMAGES.hands]],
  ['disability-inclusion', 'Disability inclusion', 'Assistive devices, inclusive classrooms and advocacy for the rights of persons with disabilities.', 'Accessibility', IMAGES.community, 'Friends together', []],
  ['animal-welfare', 'Animal welfare', 'Rescue, vaccination and care for street animals in partnership with local volunteers.', 'PawPrint', IMAGES.dogs, 'Two dogs running on a beach', []],
] as const;
