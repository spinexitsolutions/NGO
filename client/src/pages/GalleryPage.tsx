import { Link } from 'react-router-dom';
import { Images } from 'lucide-react';
import { plural } from '@/lib/format';
import { useCollection } from '@/lib/queries';
import type { Album } from '@/lib/types';
import { CardGridSkeleton, EmptyState, ErrorState } from '@/components/ui';
import { Reveal } from '@/components/site/motion';
import { SampleBadge } from '@/components/site/SampleBadge';
import { SmartImage } from '@/components/site/SmartImage';
import { CmsPage } from './CmsPage';

function AlbumGrid() {
  const { data, isLoading, error, refetch } = useCollection<Album>('galleryAlbums', { limit: 50 });
  const items = data?.data ?? [];
  return (
    <section className="container-x section-y" aria-label="Photo albums">
      {isLoading ? (
        <CardGridSkeleton count={6} />
      ) : error ? (
        <ErrorState message="We couldn’t load the gallery." onRetry={() => refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon={Images} title="No albums yet">Photographs from our work will appear here.</EmptyState>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((a, i) => (
            <Reveal key={a.id} delay={(i % 3) * 0.08}>
              <Link to={`/gallery/${a.slug}`} className="group relative block overflow-hidden rounded-theme-img">
                <div className="aspect-[4/5]">
                  <SmartImage src={a.coverImage || a.items[0]?.url} alt={a.title} sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" width={900} className="transition-transform duration-[1.2s] group-hover:scale-105" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                <SampleBadge show={a.isSample} className="absolute right-3 top-3" />
                <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                  <p className="text-xs font-semibold uppercase tracking-wider text-accent">{plural(a.items.length, 'photo')}</p>
                  <h3 className="mt-1 font-heading text-2xl">{a.title}</h3>
                  {a.description && <p className="mt-1 line-clamp-2 text-sm text-white/80">{a.description}</p>}
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      )}
    </section>
  );
}

export default function GalleryPage() {
  return (
    <CmsPage slug="gallery" fallbackTitle="Gallery">
      <AlbumGrid />
    </CmsPage>
  );
}
