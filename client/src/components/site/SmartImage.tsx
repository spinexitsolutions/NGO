import { useState, type ImgHTMLAttributes } from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/cn';
import { sized, srcSet } from '@/lib/image';

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet'> {
  src: string | null | undefined;
  alt: string;
  /** e.g. "(min-width: 1024px) 33vw, 100vw" */
  sizes?: string;
  priority?: boolean;
  variants?: Record<string, string>;
  /** Width used for the fallback src (Unsplash only). */
  width?: number;
  wrapperClassName?: string;
}

/**
 * Responsive, lazy-loaded image with a graceful fallback if the URL fails, so a broken link never
 * shows a broken-image icon on the public site.
 */
export function SmartImage({ src, alt, sizes = '100vw', priority, variants, width = 1600, className, wrapperClassName, ...rest }: Props) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  if (!src || failed) {
    return (
      <div role="img" aria-label={alt} className={cn('grid h-full w-full place-items-center bg-gradient-to-br from-primary/80 via-secondary to-secondary text-white/40', wrapperClassName, className)}>
        <ImageOff className="h-8 w-8" aria-hidden />
      </div>
    );
  }
  return (
    <img
      src={sized(src, width)}
      srcSet={srcSet(src, variants)}
      sizes={sizes}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding={priority ? 'sync' : 'async'}
      // eslint-disable-next-line react/no-unknown-property
      fetchPriority={priority ? 'high' : 'auto'}
      onError={() => setFailed(true)}
      onLoad={() => setLoaded(true)}
      className={cn('h-full w-full object-cover transition-[opacity,filter] duration-700', loaded ? 'opacity-100 blur-0' : 'opacity-0 blur-sm', className)}
      {...rest}
    />
  );
}
