import { useParams } from 'react-router-dom';
import { Images } from 'lucide-react';
import { plural } from '@/lib/format';
import { usePublic } from '@/lib/queries';
import type { Album } from '@/lib/types';
import { EmptyState } from '@/components/ui';
import { Gallery } from '@/components/site/Lightbox';
import { Seo } from '@/components/site/Seo';
import { ShareButtons } from '@/components/site/ShareButtons';
import { DetailBanner, QueryGate } from './page-kit';

export default function AlbumPage() {
  const { slug = '' } = useParams();
  const query = usePublic<Album>(`/public/c/galleryAlbums/${slug}`);
  return (
    <QueryGate query={query}>
      {(a) => {
        const images = a.items.filter((i) => i.url).map((i, n) => ({ url: i.url, alt: i.alt || `${a.title} — photo ${n + 1}`, caption: i.caption }));
        return (
          <>
            <Seo title={a.title} description={a.description} image={a.coverImage || images[0]?.url} />
            <DetailBanner image={a.coverImage || images[0]?.url} alt={a.title} eyebrow={plural(images.length, 'photo')} title={a.title} subtitle={a.description} isSample={a.isSample} back={{ href: '/gallery', label: 'All albums' }} size="medium" />
            <div className="container-x section-y">
              {images.length ? <Gallery images={images} /> : <EmptyState icon={Images} title="This album is empty">Photos will be added soon.</EmptyState>}
              <div className="mt-12 border-t border-line pt-8"><ShareButtons title={a.title} /></div>
            </div>
          </>
        );
      }}
    </QueryGate>
  );
}
