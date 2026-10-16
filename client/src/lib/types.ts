/** Shapes returned by the public API (only the fields the UI uses). */
export interface Cause { id: string; slug: string; title: string; summary: string; body: string; icon: string; coverImage: string; coverAlt: string; gallery: string[]; goals: string[]; activities: string[]; outcomes: string[]; isSample: boolean; seoTitle: string; seoDescription: string }
export interface Milestone { title: string; description: string; targetAmount: number | null; achieved: boolean; date: string | null }
export interface Campaign {
  id: string; slug: string; title: string; summary: string; body: string; coverImage: string; coverAlt: string; gallery: string[]; goalAmount: number; currency: string; suggestedAmounts: string[];
  startDate: string; endDate: string | null; isFeatured: boolean; milestones: Milestone[]; isSample: boolean; raised: number; donors: number; percent: number; phase: 'active' | 'upcoming' | 'completed';
  cause: { title: string; slug: string } | null; seoTitle: string; seoDescription: string; status: string;
}
export interface Project {
  id: string; slug: string; title: string; summary: string; body: string; coverImage: string; coverAlt: string; gallery: string[]; videoUrl: string; phase: 'PLANNED' | 'ONGOING' | 'COMPLETED'; location: string;
  startDate: string; endDate: string | null; objectives: string[]; activities: string[]; outcomes: string[]; beneficiariesReached: number | null; budgetAmount?: number | null; fundingSecured?: number | null; showBudget: boolean; isSample: boolean;
  cause?: { title: string; slug: string } | null; campaign?: { title: string; slug: string; status: string } | null; seoTitle: string; seoDescription: string;
}
export interface Story { id: string; slug: string; title: string; excerpt: string; body: string; image: string; imageAlt: string; personName: string; location: string; publishedAt: string | null; isSample: boolean; seoTitle: string; seoDescription: string }
export interface EventItem {
  id: string; slug: string; title: string; summary: string; body: string; coverImage: string; coverAlt: string; gallery: string[]; startsAt: string; endsAt: string | null; venue: string; address: string; mapUrl: string;
  capacity: number | null; registrationOpen: boolean; volunteerSlots: number | null; isFundraiser: boolean; status: string; cancellationNote: string; materials: { label: string; url: string }[]; isSample: boolean;
  spotsLeft?: number | null; volunteerSpotsLeft?: number; isPast?: boolean; campaign?: { slug: string; title: string } | null; seoTitle: string; seoDescription: string;
}
export interface Post { id: string; slug: string; title: string; excerpt: string; body?: string; coverImage: string; coverAlt: string; authorName: string; tags: string[]; publishedAt: string; category?: { name: string; slug: string } | null; isSample: boolean; seoTitle: string; seoDescription: string }
export interface TeamMember { id: string; name: string; title: string; group: string; bio: string; photo: string; linkedinUrl: string; isSample: boolean }
export interface Partner { id: string; name: string; type: string; logo: string; url: string; description: string }
export interface Testimonial { id: string; quote: string; author: string; role: string; photo: string }
export interface ImpactStat { id: string; label: string; value: number; prefix: string; suffix: string; icon: string; source: string; isVerified: boolean; isSample: boolean }
export interface Faq { id: string; question: string; answer: string; category: string }
export interface DocumentItem { id: string; title: string; type: string; year: string; description: string; fileUrl: string; coverImage: string; isSample: boolean }
export interface Album { id: string; slug: string; title: string; description: string; coverImage: string; items: { url: string; alt: string; caption: string }[]; isSample: boolean }
export interface Opportunity { id: string; slug: string; title: string; summary: string; description: string; location: string; mode: string; commitment: string; skills: string[]; slots: number | null; deadline: string | null; image: string; isSample: boolean }
export interface Job { id: string; slug: string; title: string; type: string; location: string; summary: string; description: string; deadline: string | null; isSample: boolean }
export interface Paged<T> { data: T[]; meta: { page: number; limit: number; total: number; pages: number } }
