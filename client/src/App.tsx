import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { MotionConfig } from 'framer-motion';
import { AuthProvider } from '@/app/AuthProvider';
import { SiteProvider } from '@/app/SiteProvider';
import { ConfirmProvider, Spinner, ToastProvider } from '@/components/ui';
import { PublicLayout } from '@/components/site/Layout';
import { CmsPage } from '@/pages/CmsPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});

// Public pages
const CausesPage = lazy(() => import('@/pages/CausesPage'));
const CauseDetailPage = lazy(() => import('@/pages/CauseDetailPage'));
const CampaignsPage = lazy(() => import('@/pages/CampaignsPage'));
const CampaignDetailPage = lazy(() => import('@/pages/CampaignDetailPage'));
const ProjectsPage = lazy(() => import('@/pages/ProjectsPage'));
const ProjectDetailPage = lazy(() => import('@/pages/ProjectDetailPage'));
const StoriesPage = lazy(() => import('@/pages/StoriesPage'));
const StoryDetailPage = lazy(() => import('@/pages/StoryDetailPage'));
const EventsPage = lazy(() => import('@/pages/EventsPage'));
const EventDetailPage = lazy(() => import('@/pages/EventDetailPage'));
const EventCancelPage = lazy(() => import('@/pages/EventCancelPage'));
const BlogPage = lazy(() => import('@/pages/BlogPage'));
const PostDetailPage = lazy(() => import('@/pages/PostDetailPage'));
const GalleryPage = lazy(() => import('@/pages/GalleryPage'));
const AlbumPage = lazy(() => import('@/pages/AlbumPage'));
const DonatePage = lazy(() => import('@/pages/DonatePage'));
const ThankYouPage = lazy(() => import('@/pages/ThankYouPage'));
const VolunteerPage = lazy(() => import('@/pages/VolunteerPage'));
const VolunteerApplyPage = lazy(() => import('@/pages/VolunteerApplyPage'));
const VolunteerStatusPage = lazy(() => import('@/pages/VolunteerStatusPage'));
const DonorPortalPage = lazy(() => import('@/pages/DonorPortalPage'));
const SearchPage = lazy(() => import('@/pages/SearchPage'));
const UnsubscribePage = lazy(() => import('@/pages/UnsubscribePage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const PreviewPage = lazy(() => import('@/pages/PreviewPage'));

// Admin
const AdminLayout = lazy(() => import('@/admin/AdminLayout'));
const LoginPage = lazy(() => import('@/admin/LoginPage'));
const ResetPasswordPage = lazy(() => import('@/admin/ResetPasswordPage'));
const DashboardPage = lazy(() => import('@/admin/pages/DashboardPage'));
const ThemePage = lazy(() => import('@/admin/cms/ThemePage'));
const SettingsPage = lazy(() => import('@/admin/cms/SettingsPage'));
const NavigationPage = lazy(() => import('@/admin/cms/NavigationPage'));
const PagesListPage = lazy(() => import('@/admin/cms/PagesListPage'));
const PageBuilderPage = lazy(() => import('@/admin/cms/PageBuilderPage'));
const CollectionListPage = lazy(() => import('@/admin/cms/CollectionListPage'));
const CollectionEditPage = lazy(() => import('@/admin/cms/CollectionEditPage'));
const MediaPage = lazy(() => import('@/admin/cms/MediaPage'));
const DonationsPage = lazy(() => import('@/admin/pages/DonationsPage'));
const DonationDetailPage = lazy(() => import('@/admin/pages/DonationDetailPage'));
const DonorsPage = lazy(() => import('@/admin/pages/DonorsPage'));
const DonorDetailPage = lazy(() => import('@/admin/pages/DonorDetailPage'));
const RecurringPage = lazy(() => import('@/admin/pages/RecurringPage'));
const VolunteerApplicationsPage = lazy(() => import('@/admin/pages/VolunteerApplicationsPage'));
const VolunteerApplicationDetailPage = lazy(() => import('@/admin/pages/VolunteerApplicationDetailPage'));
const VolunteersPage = lazy(() => import('@/admin/pages/VolunteersPage'));
const VolunteerProfilePage = lazy(() => import('@/admin/pages/VolunteerProfilePage'));
const EventRegistrationsPage = lazy(() => import('@/admin/pages/EventRegistrationsPage'));
const BeneficiariesPage = lazy(() => import('@/admin/pages/BeneficiariesPage'));
const BeneficiaryDetailPage = lazy(() => import('@/admin/pages/BeneficiaryDetailPage'));
const InquiriesPage = lazy(() => import('@/admin/pages/InquiriesPage'));
const InquiryDetailPage = lazy(() => import('@/admin/pages/InquiryDetailPage'));
const SubscribersPage = lazy(() => import('@/admin/pages/SubscribersPage'));
const EmailTemplatesPage = lazy(() => import('@/admin/pages/EmailTemplatesPage'));
const UsersPage = lazy(() => import('@/admin/pages/UsersPage'));
const RolesPage = lazy(() => import('@/admin/pages/RolesPage'));
const ReportsPage = lazy(() => import('@/admin/pages/ReportsPage'));
const AuditPage = lazy(() => import('@/admin/pages/AuditPage'));
const AccountPage = lazy(() => import('@/admin/pages/AccountPage'));

function Loading() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <Spinner />
    </div>
  );
}

const S = ({ children }: { children: ReactNode }) => <Suspense fallback={<Loading />}>{children}</Suspense>;

export function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <MotionConfig reducedMotion="user">
          <SiteProvider>
            <ToastProvider>
              <ConfirmProvider>
                <BrowserRouter>
                  <Routes>
                    <Route path="/admin/login" element={<AuthProvider><S><LoginPage /></S></AuthProvider>} />
                    <Route path="/admin/reset-password" element={<S><ResetPasswordPage /></S>} />
                    <Route path="/admin" element={<AuthProvider><S><AdminLayout /></S></AuthProvider>}>
                      <Route index element={<S><DashboardPage /></S>} />
                      <Route path="website/theme" element={<S><ThemePage /></S>} />
                      <Route path="website/settings" element={<S><SettingsPage /></S>} />
                      <Route path="website/navigation" element={<S><NavigationPage /></S>} />
                      <Route path="website/pages" element={<S><PagesListPage /></S>} />
                      <Route path="website/pages/:id" element={<S><PageBuilderPage /></S>} />
                      <Route path="media" element={<S><MediaPage /></S>} />
                      <Route path="content/:collection" element={<S><CollectionListPage /></S>} />
                      <Route path="content/:collection/:id" element={<S><CollectionEditPage /></S>} />
                      <Route path="donations" element={<S><DonationsPage /></S>} />
                      <Route path="donations/:id" element={<S><DonationDetailPage /></S>} />
                      <Route path="donors" element={<S><DonorsPage /></S>} />
                      <Route path="donors/:id" element={<S><DonorDetailPage /></S>} />
                      <Route path="recurring" element={<S><RecurringPage /></S>} />
                      <Route path="volunteers/applications" element={<S><VolunteerApplicationsPage /></S>} />
                      <Route path="volunteers/applications/:id" element={<S><VolunteerApplicationDetailPage /></S>} />
                      <Route path="volunteers" element={<S><VolunteersPage /></S>} />
                      <Route path="volunteers/:id" element={<S><VolunteerProfilePage /></S>} />
                      <Route path="events/:id/registrations" element={<S><EventRegistrationsPage /></S>} />
                      <Route path="beneficiaries" element={<S><BeneficiariesPage /></S>} />
                      <Route path="beneficiaries/:id" element={<S><BeneficiaryDetailPage /></S>} />
                      <Route path="inquiries" element={<S><InquiriesPage /></S>} />
                      <Route path="inquiries/:id" element={<S><InquiryDetailPage /></S>} />
                      <Route path="subscribers" element={<S><SubscribersPage /></S>} />
                      <Route path="email" element={<S><EmailTemplatesPage /></S>} />
                      <Route path="users" element={<S><UsersPage /></S>} />
                      <Route path="roles" element={<S><RolesPage /></S>} />
                      <Route path="reports" element={<S><ReportsPage /></S>} />
                      <Route path="audit" element={<S><AuditPage /></S>} />
                      <Route path="account" element={<S><AccountPage /></S>} />
                      <Route path="*" element={<Navigate to="/admin" replace />} />
                    </Route>

                    <Route element={<PublicLayout />}>
                      <Route index element={<CmsPage slug="home" />} />
                      <Route path="causes" element={<S><CausesPage /></S>} />
                      <Route path="causes/:slug" element={<S><CauseDetailPage /></S>} />
                      <Route path="campaigns" element={<S><CampaignsPage /></S>} />
                      <Route path="campaigns/:slug" element={<S><CampaignDetailPage /></S>} />
                      <Route path="projects" element={<S><ProjectsPage /></S>} />
                      <Route path="projects/:slug" element={<S><ProjectDetailPage /></S>} />
                      <Route path="stories" element={<S><StoriesPage /></S>} />
                      <Route path="stories/:slug" element={<S><StoryDetailPage /></S>} />
                      <Route path="events" element={<S><EventsPage /></S>} />
                      <Route path="events/:slug" element={<S><EventDetailPage /></S>} />
                      <Route path="events/:slug/cancel" element={<S><EventCancelPage /></S>} />
                      <Route path="blog" element={<S><BlogPage /></S>} />
                      <Route path="blog/:slug" element={<S><PostDetailPage /></S>} />
                      <Route path="gallery" element={<S><GalleryPage /></S>} />
                      <Route path="gallery/:slug" element={<S><AlbumPage /></S>} />
                      <Route path="donate" element={<S><DonatePage /></S>} />
                      <Route path="donate/thank-you/:reference" element={<S><ThankYouPage /></S>} />
                      <Route path="volunteer" element={<S><VolunteerPage /></S>} />
                      <Route path="volunteer/apply" element={<S><VolunteerApplyPage /></S>} />
                      <Route path="volunteer/status" element={<S><VolunteerStatusPage /></S>} />
                      <Route path="donor" element={<S><DonorPortalPage /></S>} />
                      <Route path="search" element={<S><SearchPage /></S>} />
                      <Route path="unsubscribe" element={<S><UnsubscribePage /></S>} />
                      <Route path="404" element={<S><NotFoundPage /></S>} />
                      <Route path="__preview" element={<S><PreviewPage /></S>} />
                      <Route path=":slug" element={<CmsPage />} />
                      <Route path="*" element={<S><NotFoundPage /></S>} />
                    </Route>
                  </Routes>
                </BrowserRouter>
              </ConfirmProvider>
            </ToastProvider>
          </SiteProvider>
        </MotionConfig>
      </QueryClientProvider>
    </HelmetProvider>
  );
}
