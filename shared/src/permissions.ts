/**
 * Permission catalog. The backend enforces these on every protected route; roles are stored in the
 * database and can be edited by a Super Admin. The keys below are the only valid permissions.
 */
export const PERMISSIONS = {
  'dashboard.view': { group: 'Dashboard', label: 'View dashboard overview' },
  'website.theme': { group: 'Website', label: 'Edit and publish theme, settings and navigation' },
  'website.pages': { group: 'Website', label: 'Edit and publish pages and sections' },
  'content.manage': { group: 'Content', label: 'Manage causes, stories, team, partners, FAQs, gallery and reports' },
  'content.publish': { group: 'Content', label: 'Publish content collections' },
  'blog.manage': { group: 'Content', label: 'Manage blog posts, categories and tags' },
  'media.manage': { group: 'Media', label: 'Upload, replace and delete media' },
  'campaigns.manage': { group: 'Campaigns', label: 'Create and manage campaigns, updates and milestones' },
  'projects.manage': { group: 'Projects', label: 'Manage projects and project reports' },
  'donations.view': { group: 'Finance', label: 'View donations and donors' },
  'donations.manage': { group: 'Finance', label: 'Record offline donations, refunds and receipts' },
  'donations.export': { group: 'Finance', label: 'Export donation and donor data' },
  'volunteers.view': { group: 'Volunteers', label: 'View volunteer applications and profiles' },
  'volunteers.manage': { group: 'Volunteers', label: 'Review applications, assignments, hours and opportunities' },
  'events.manage': { group: 'Events', label: 'Create events and manage registrations/attendance' },
  'beneficiaries.view': { group: 'Beneficiaries', label: 'View beneficiary records (sensitive)' },
  'beneficiaries.manage': { group: 'Beneficiaries', label: 'Create and update beneficiary and assistance records' },
  'inquiries.manage': { group: 'Communication', label: 'Manage contact inquiries and newsletter subscribers' },
  'email.templates': { group: 'Communication', label: 'Edit email templates and send announcements' },
  'reports.view': { group: 'Reports', label: 'View and export reports' },
  'users.manage': { group: 'Administration', label: 'Manage staff accounts and roles' },
  'audit.view': { group: 'Administration', label: 'View audit logs' },
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export function isPermission(value: string): value is Permission {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, value);
}

/** Default roles created by the seed script. `super_admin` always has every permission. */
export const DEFAULT_ROLES: { key: string; name: string; description: string; permissions: Permission[] }[] = [
  { key: 'super_admin', name: 'Super Admin', description: 'Full access including staff, roles and audit logs.', permissions: ALL_PERMISSIONS },
  {
    key: 'director',
    name: 'NGO Director',
    description: 'Oversees everything except staff administration.',
    permissions: ALL_PERMISSIONS.filter((p) => p !== 'users.manage'),
  },
  {
    key: 'finance_manager',
    name: 'Finance Manager',
    description: 'Donations, receipts, refunds and financial reports.',
    permissions: ['dashboard.view', 'donations.view', 'donations.manage', 'donations.export', 'reports.view', 'campaigns.manage'],
  },
  {
    key: 'campaign_manager',
    name: 'Campaign Manager',
    description: 'Campaigns, events and their content.',
    permissions: ['dashboard.view', 'campaigns.manage', 'events.manage', 'media.manage', 'donations.view', 'reports.view'],
  },
  {
    key: 'volunteer_coordinator',
    name: 'Volunteer Coordinator',
    description: 'Volunteer applications, opportunities, assignments and events.',
    permissions: ['dashboard.view', 'volunteers.view', 'volunteers.manage', 'events.manage', 'reports.view'],
  },
  {
    key: 'content_editor',
    name: 'Content Editor',
    description: 'Website pages, content, blog and media.',
    permissions: ['dashboard.view', 'website.pages', 'content.manage', 'content.publish', 'blog.manage', 'media.manage', 'inquiries.manage'],
  },
  {
    key: 'project_manager',
    name: 'Project Manager',
    description: 'Projects, beneficiaries and assistance records.',
    permissions: ['dashboard.view', 'projects.manage', 'beneficiaries.view', 'beneficiaries.manage', 'media.manage', 'reports.view'],
  },
];

export const SUPER_ADMIN_ROLE = 'super_admin';
