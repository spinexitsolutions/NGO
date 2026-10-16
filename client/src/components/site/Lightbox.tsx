import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { sized } from '@/lib/image';
import { SmartImage } from './SmartImage';

export interface GalleryImage { url: string; alt: string; caption?: string }

/** Masonry-style gallery with an accessible, keyboard-navigable lightbox. */
export function Gallery({ images, columns = 3 }: { images: GalleryImage[]; columns?: 2 | 3 | 4 }) {
  const [index, setIndex] = useState<number | null>(null);
  const cols = { 2: 'sm:columns-2', 3: 'sm:columns-2 lg:columns-3', 4: 'sm:columns-3 lg:columns-4' }[columns];
  return (
    <>
      <ul className={`columns-1 gap-4 ${cols} [&>li]:mb-4`}>
        {images.map((img, i) => (
          <li key={`${img.url}-${i}`} className="break-inside-avoid">
            <button onClick={() => setIndex(i)} className="group relative block w-full overflow-hidden rounded-theme-img focus-visible:outline-offset-4" aria-label={`Open image: ${img.alt || `photo ${i + 1}`}`}>
              <div className={i % 3 === 1 ? 'aspect-[3/4]' : 'aspect-[4/3]'}>
                <SmartImage src={img.url} alt={img.alt} sizes="(min-width:1024px) 33vw, 100vw" width={900} className="transition duration-700 group-hover:scale-105" />
              </div>
              <span className="absolute inset-0 bg-black/0 transition group-hover:bg-black/15" />
            </button>
          </li>
        ))}
      </ul>
      <Lightbox images={images} index={index} onChange={setIndex} />
    </>
  );
}

export function Lightbox({ images, index, onChange }: { images: GalleryImage[]; index: number | null; onChange: (i: number | null) => void }) {
  const go = useCallback((d: number) => index !== null && onChange((index + d + images.length) % images.length), [index, images.length, onChange]);
  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onChange(null);
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [index, go, onChange]);
  const img = index !== null ? images[index] : null;
  return createPortal(
    <AnimatePresence>
      {img && (
        <motion.div role="dialog" aria-modal="true" aria-label="Image viewer" className="fixed inset-0 z-[150] flex items-center justify-center bg-black/95 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => onChange(null)}>
          <button className="absolute right-4 top-4 rounded-full bg-white/10 p-3 text-white hover:bg-white/20" onClick={() => onChange(null)} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
          {images.length > 1 && (
            <>
              <button className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 sm:left-6" onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="Previous image">
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 sm:right-6" onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="Next image">
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
          <motion.figure key={img.url} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="max-h-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <img src={sized(img.url, 2000)} alt={img.alt} className="max-h-[80vh] w-auto rounded-lg object-contain" />
            <figcaption className="mt-3 text-center text-sm text-white/75">
              {img.caption || img.alt} <span className="ml-2 text-white/40">{(index ?? 0) + 1} / {images.length}</span>
            </figcaption>
          </motion.figure>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
