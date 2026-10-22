/**
 * Seeds roles/permissions, configuration, email templates, system pages and CLEARLY LABELLED sample content.
 * Safe to re-run: existing records are left untouched (upserts by unique key).
 *
 *   npm run seed                 # roles, config, templates, pages + sample content
 *   npm run seed -- --no-sample  # everything except sample content
 *
 * No donations, partners or testimonials are ever seeded — those must come from real records.
 */
import type { Prisma } from '@prisma/client';
import { ALL_PERMISSIONS, DEFAULT_ROLES, PERMISSIONS } from '@ngo/shared';
import { prisma, syncDatabase } from '../config/db.js';
import { getPublished } from '../services/config.service.js';
import { IMAGES, SEED_CAUSES, SEED_PAGES } from './seedContent.js';

const withSample = !process.argv.includes('--no-sample');
const day = 86_400_000;
const at = (offsetDays: number, hour = 10) => {
  const d = new Date(Date.now() + offsetDays * day);
  d.setHours(hour, 0, 0, 0);
  return d;
};

async function seedAccess() {
  for (const key of ALL_PERMISSIONS) {
    const p = PERMISSIONS[key];
    await prisma.permission.upsert({ where: { key }, create: { key, group: p.group, description: p.label }, update: { group: p.group, description: p.label } });
  }
  for (const r of DEFAULT_ROLES) {
    const existing = await prisma.role.findUnique({ where: { key: r.key } });
    if (existing) continue; // keep admin customisations
    await prisma.role.create({ data: { key: r.key, name: r.name, description: r.description, isSystem: true, permissions: { create: r.permissions.map((permissionKey) => ({ permissionKey })) } } });
  }
  console.log(`✓ ${ALL_PERMISSIONS.length} permissions, ${DEFAULT_ROLES.length} roles`);
}

async function seedConfig() {
  await Promise.all([getPublished('theme'), getPublished('settings'), getPublished('navigation')]);
  console.log('✓ theme, settings and navigation (email templates use built-in defaults until customised)');
}

async function seedPages() {
  let created = 0;
  for (const p of SEED_PAGES) {
    if (await prisma.page.findUnique({ where: { slug: p.slug } })) continue;
    const draft = { title: p.title, seo: { title: '', description: p.description, image: '', noIndex: false }, sections: p.sections } as unknown as Prisma.InputJsonValue;
    const page = await prisma.page.create({ data: { slug: p.slug, isSystem: true, draft, status: 'PUBLISHED' } });
    const v = await prisma.pageVersion.create({ data: { pageId: page.id, version: 1, data: draft, note: 'Initial content' } });
    await prisma.page.update({ where: { id: page.id }, data: { publishedVersionId: v.id } });
    created++;
  }
  console.log(`✓ ${created} pages created (${SEED_PAGES.length - created} already existed)`);
}

async function seedSample() {
  if (await prisma.cause.count()) {
    console.log('• sample content skipped (content already exists)');
    return;
  }
  const causes: Record<string, string> = {};
  let order = 0;
  for (const [slug, title, summary, icon, coverImage, coverAlt, gallery] of SEED_CAUSES) {
    const c = await prisma.cause.create({
      data: {
        slug,
        title,
        summary,
        icon,
        coverImage,
        coverAlt,
        gallery: [...gallery],
        body: `${summary}\n\nOur approach combines direct services with long-term capacity building, so that communities can sustain the change themselves.\n\n*Sample description — edit this cause in Admin → Content → Causes.*`,
        goals: ['Reach the most excluded families first', 'Build local leadership and ownership', 'Measure outcomes, not just outputs'],
        activities: ['Needs assessment with community members', 'Direct programme delivery', 'Follow-up visits and referrals'],
        outcomes: ['Improved access to services', 'Stronger community institutions'],
        sortOrder: order++,
        status: slug === 'animal-welfare' ? 'DRAFT' : 'PUBLISHED',
        isSample: true,
      },
    });
    causes[slug] = c.id;
  }

  const campaigns = [
    ['back-to-school-2026', 'Back to school: 1,000 school kits', 'Help children in remote villages start the school year with books, bags and uniforms.', IMAGES.classroom2, 'education', 50_000_000, -20, 40, true],
    ['monsoon-health-camps', 'Monsoon health camps', 'Fund mobile medical camps during the monsoon, when water-borne diseases peak.', IMAGES.health2, 'healthcare', 30_000_000, -10, 60, true],
    ['one-lakh-trees', 'One lakh trees', 'Plant and nurture native trees with village forest committees.', IMAGES.sapling, 'environment', 80_000_000, -45, 120, true],
    ['winter-nutrition-drive', 'Winter nutrition drive', 'Nutrition kits for families facing food insecurity this winter.', IMAGES.food, 'food-nutrition', 20_000_000, 25, 75, false],
  ] as const;
  const campaignIds: Record<string, string> = {};
  for (const [slug, title, summary, coverImage, cause, goal, start, length, featured] of campaigns) {
    const c = await prisma.campaign.create({
      data: {
        slug,
        title,
        summary,
        coverImage,
        coverAlt: title,
        causeId: causes[cause],
        goalAmount: goal,
        startDate: at(start),
        endDate: at(start + length),
        isFeatured: featured,
        status: 'ACTIVE',
        isSample: true,
        suggestedAmounts: ['500', '1000', '2500', '5000'],
        body: `## Why this matters\n${summary}\n\n## What your gift does\n- Every contribution goes directly to programme costs for this campaign.\n- We publish updates as milestones are reached.\n\n*Sample campaign — edit or archive it in Admin → Campaigns. Raised amounts shown are real: they come only from verified donations.*`,
        milestones: [
          { title: 'Needs assessment complete', description: 'Families and locations identified with community leaders.', targetAmount: null, achieved: true, date: at(start).toISOString().slice(0, 10) },
          { title: 'First distribution', description: 'First batch delivered.', targetAmount: Math.round(goal / 3), achieved: false, date: null },
          { title: 'Goal reached', description: 'All planned beneficiaries reached.', targetAmount: goal, achieved: false, date: null },
        ],
      },
    });
    campaignIds[slug] = c.id;
    await prisma.campaignUpdate.create({ data: { campaignId: c.id, title: 'Campaign launched', body: 'Thank you to everyone who has shared this campaign. (Sample update)', publishedAt: at(start), status: 'PUBLISHED' } });
  }

  const projects = [
    ['community-learning-centres', 'Community learning centres', 'After-school learning centres run by trained local youth.', IMAGES.classroom3, 'education', 'back-to-school-2026', 'Sample District A', -400],
    ['mobile-health-van', 'Mobile health van', 'A fully equipped van bringing doctors and medicines to remote villages every week.', IMAGES.health3, 'healthcare', 'monsoon-health-camps', 'Sample District B', -300],
    ['women-enterprise-circles', 'Women’s enterprise circles', 'Savings groups, skills training and seed capital for women-led micro-enterprises.', IMAGES.women2, 'women-empowerment', null, 'Sample District C', -200],
    ['green-villages', 'Green villages', 'Native tree planting, check dams and kitchen gardens with village committees.', IMAGES.forest, 'environment', 'one-lakh-trees', 'Sample District D', -90],
  ] as const;
  const projectIds: string[] = [];
  for (const [slug, title, summary, coverImage, cause, campaign, location, start] of projects) {
    const p = await prisma.project.create({
      data: {
        slug,
        title,
        summary,
        coverImage,
        coverAlt: title,
        gallery: [IMAGES.community, IMAGES.volunteers, IMAGES.hands],
        causeId: causes[cause],
        campaignId: campaign ? campaignIds[campaign] : null,
        phase: 'ONGOING',
        location,
        startDate: at(start),
        objectives: ['Reach the families most in need', 'Train local facilitators', 'Track outcomes every quarter'],
        activities: ['Community meetings', 'Regular sessions', 'Monitoring visits'],
        outcomes: [],
        beneficiariesReached: null,
        beneficiariesVerified: false,
        status: 'PUBLISHED',
        isSample: true,
        body: `${summary}\n\n*Sample project — replace with a real programme in Admin → Projects.*`,
      },
    });
    projectIds.push(p.id);
    await prisma.projectReport.create({ data: { projectId: p.id, title: 'Quarterly progress update', kind: 'UPDATE', body: 'Activities are on track. (Sample update)', publishedAt: at(-15), status: 'PUBLISHED' } });
  }

  const stories = [
    ['first-in-her-family-to-read', 'The first in her family to read', 'At eleven, “Meena” (name changed) had never held a storybook. Today she reads to her younger brothers every night.', IMAGES.classroom, 'education'],
    ['a-shop-of-her-own', 'A shop of her own', 'With a small seed grant and a savings circle behind her, Sunita opened a tailoring shop that now employs two neighbours.', IMAGES.women, 'women-empowerment'],
    ['water-returns-to-the-village', 'Water returns to the village', 'How a village committee revived an old pond and planted 5,000 trees around it.', IMAGES.garden, 'environment'],
  ] as const;
  for (const [slug, title, excerpt, image, cause] of stories) {
    await prisma.story.create({
      data: {
        slug,
        title,
        excerpt,
        image,
        imageAlt: title,
        causeId: causes[cause],
        body: `${excerpt}\n\n*This is a fictional sample story included to demonstrate the layout. Publish real stories only with documented consent, and never identify children.*`,
        personName: '',
        location: 'Sample district',
        anonymized: true,
        consentObtained: true,
        consentNotes: 'SAMPLE CONTENT — fictional. Replace or delete before launch.',
        publishedAt: at(-30),
        status: 'PUBLISHED',
        isSample: true,
      },
    });
  }

  const stats = [
    ['Children in learning programmes', 12000, '', '+', 'GraduationCap'],
    ['Patients seen at health camps', 48000, '', '+', 'Stethoscope'],
    ['Women entrepreneurs supported', 2600, '', '+', 'Users'],
    ['Trees planted', 85000, '', '+', 'Leaf'],
  ] as const;
  let i = 0;
  for (const [label, value, prefix, suffix, icon] of stats) {
    await prisma.impactStat.create({ data: { label, value, prefix, suffix, icon, source: 'Sample figure — replace with verified data', isVerified: false, sortOrder: i++, status: 'PUBLISHED', isSample: true } });
  }

  const team = [
    ['Founder Name', 'Founder & Chairperson', 'FOUNDER', IMAGES.p1],
    ['Executive Director', 'Executive Director', 'LEADERSHIP', IMAGES.p2],
    ['Programme Head', 'Head of Programmes', 'LEADERSHIP', IMAGES.p3],
    ['Finance Head', 'Head of Finance', 'LEADERSHIP', IMAGES.p4],
    ['Board Member', 'Board Member', 'BOARD', IMAGES.p5],
    ['Board Member', 'Board Treasurer', 'BOARD', IMAGES.p6],
    ['Advisor Name', 'Advisor, Public Health', 'ADVISOR', IMAGES.p7],
    ['Staff Member', 'Volunteer Coordinator', 'STAFF', IMAGES.p8],
  ] as const;
  i = 0;
  for (const [name, title, group, photo] of team) {
    await prisma.teamMember.create({ data: { name, title, group, photo, bio: 'Sample profile — replace with a real team member in Admin → Content → Team.', sortOrder: i++, status: 'PUBLISHED', isSample: true } });
  }

  const faqs = [
    ['Donations', 'Is my donation secure?', 'Yes. Payments are processed by a PCI-DSS compliant payment gateway. We never see or store your card details.'],
    ['Donations', 'Will I get a receipt?', 'Yes — a receipt is emailed automatically once your payment is verified. You can also download receipts anytime from the donor portal.'],
    ['Donations', 'Can I cancel a monthly donation?', 'Anytime, from the donor portal or by contacting us.'],
    ['Donations', 'Are donations tax-deductible?', 'Tax-benefit information appears on your receipt only if our registrations for it are verified and applicable. Please check your receipt or contact us.'],
    ['Volunteering', 'Do I need experience to volunteer?', 'No. We match your skills and interests to the right role and provide orientation.'],
    ['Transparency', 'How do you report on spending?', 'We publish audited financial statements and annual reports on our transparency page.'],
  ] as const;
  i = 0;
  for (const [category, question, answer] of faqs) await prisma.faq.create({ data: { category, question, answer, sortOrder: i++, status: 'PUBLISHED', isSample: true } });

  const events = [
    ['run-for-education', 'Run for Education 5K', 'A family-friendly 5K run raising funds for school kits.', IMAGES.community2, 21, true, 'back-to-school-2026', 300, 20],
    ['tree-planting-drive', 'Community tree planting drive', 'Spend a morning planting native saplings with village volunteers.', IMAGES.soil, 35, false, null, 80, 30],
    ['annual-impact-evening', 'Annual impact evening', 'An evening of stories, music and our annual report presentation.', IMAGES.hall, 60, false, null, 150, 10],
  ] as const;
  for (const [slug, title, summary, coverImage, inDays, fundraiser, campaign, capacity, volunteerSlots] of events) {
    await prisma.event.create({
      data: {
        slug,
        title,
        summary,
        coverImage,
        coverAlt: title,
        body: `${summary}\n\n*Sample event — edit it in Admin → Events.*`,
        startsAt: at(inDays, 7),
        endsAt: at(inDays, 11),
        venue: 'Sample venue',
        address: 'Replace with the event address',
        capacity,
        volunteerSlots,
        isFundraiser: fundraiser,
        campaignId: campaign ? campaignIds[campaign] : null,
        registrationOpen: true,
        status: 'PUBLISHED',
        isSample: true,
      },
    });
  }

  const opportunities = [
    ['weekend-teaching-volunteer', 'Weekend teaching volunteer', 'Teach English or maths to children at our learning centres on weekends.', 'Sample District A', 'ON_SITE', '4 hours / week', ['Teaching', 'Patience'], projectIds[0]],
    ['health-camp-volunteer', 'Health camp volunteer', 'Support doctors with registration, crowd management and follow-ups.', 'Sample District B', 'ON_SITE', 'One Saturday a month', ['Communication', 'First aid (preferred)'], projectIds[1]],
    ['design-communications', 'Design & communications volunteer', 'Help us tell stories through design, photography and social media.', 'Remote', 'REMOTE', '3 hours / week', ['Design', 'Writing', 'Social media'], null],
  ] as const;
  for (const [slug, title, summary, location, mode, commitment, skills, projectId] of opportunities) {
    await prisma.volunteerOpportunity.create({ data: { slug, title, summary, description: summary, location, mode, commitment, skills: [...skills], projectId, slots: 10, deadline: at(45), status: 'OPEN', isSample: true } });
  }

  const cat = await prisma.category.create({ data: { slug: 'field-notes', name: 'Field notes', isSample: true } });
  await prisma.category.create({ data: { slug: 'announcements', name: 'Announcements', isSample: true } });
  const posts = [
    ['what-we-learned-from-100-health-camps', 'What we learned from running health camps', 'Five lessons on reaching the families who never make it to a clinic.', IMAGES.health, ['health', 'learning']],
    ['why-we-plant-native-trees', 'Why we only plant native trees', 'Native species survive better, support local wildlife and need less water.', IMAGES.forest, ['environment']],
    ['inside-a-learning-centre', 'A day inside a community learning centre', 'From morning songs to evening homework help — a look at a typical day.', IMAGES.classroom3, ['education']],
  ] as const;
  i = 0;
  for (const [slug, title, excerpt, coverImage, tags] of posts) {
    await prisma.blogPost.create({
      data: { slug, title, excerpt, coverImage, coverAlt: title, body: `${excerpt}\n\n## The details\nSample article body. Write your own in Admin → Blog.\n\n> Quotes, lists and headings are all supported.`, authorName: 'Communications team', categoryId: cat.id, tags: [...tags], publishedAt: at(-7 - i++ * 9), status: 'PUBLISHED', isSample: true },
    });
  }

  await prisma.galleryAlbum.create({
    data: {
      slug: 'in-the-field',
      title: 'In the field',
      description: 'Sample album using stock photography — replace with your own photographs.',
      coverImage: IMAGES.volunteers,
      items: [IMAGES.volunteers, IMAGES.classroom, IMAGES.health2, IMAGES.women, IMAGES.sapling, IMAGES.food2, IMAGES.community2, IMAGES.fields, IMAGES.garden].map((url, n) => ({ url, alt: `Sample photograph ${n + 1}`, caption: '' })),
      status: 'PUBLISHED',
      isSample: true,
    },
  });
  await prisma.jobOpening.create({
    data: { slug: 'programme-associate', title: 'Programme associate (sample)', type: 'JOB', location: 'Sample city', summary: 'Coordinate field activities and community meetings.', description: 'Sample job description — edit in Admin → Content → Careers.', deadline: at(30), status: 'PUBLISHED', isSample: true },
  });
  console.log('✓ sample content (all marked isSample, shown with a “Sample” badge)');
}

async function main() {
  await syncDatabase();
  await seedAccess();
  await seedConfig();
  await seedPages();
  if (withSample) await seedSample();
  await prisma.counter.upsert({ where: { key: 'content' }, create: { key: 'content', value: 1 }, update: { value: { increment: 1 } } });
  console.log('\nDone. Create the first admin with:  npm run create-admin');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
