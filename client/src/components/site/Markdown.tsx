import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';

/**
 * Renders CMS markdown safely: raw HTML is not rendered (react-markdown default), links are
 * restricted to http(s)/mailto/tel/internal paths, and images are lazy-loaded.
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn('prose-theme', className)}>
      <ReactMarkdown
        urlTransform={(url) => (/^(https?:|mailto:|tel:|\/|#)/i.test(url) ? url : '')}
        components={{
          a: ({ href = '', children: c }) =>
            href.startsWith('/') ? (
              <Link to={href}>{c}</Link>
            ) : (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {c}
              </a>
            ),
          img: ({ src = '', alt = '' }) => <img src={src} alt={alt} loading="lazy" decoding="async" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
