import { useEffect, useState } from 'react';
import { AlertCircle, FileText, Loader2 } from 'lucide-react';
import {
  fetchPublicContentPage,
  getDefaultContentPage,
  type ContentPageRecord,
  type ContentPageSlug,
} from '@/lib/contentPages';

function formatDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString('en-GB', {
    timeZone: 'Asia/Thimphu',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function PolicyPage({ slug }: { slug: ContentPageSlug }) {
  const [page, setPage] = useState<ContentPageRecord>(() => getDefaultContentPage(slug));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadPage() {
      setLoading(true);
      setError('');

      try {
        const loaded = await fetchPublicContentPage(slug);
        if (active) setPage(loaded);
      } catch (err) {
        console.warn('[PolicyPage] content page load skipped:', err);
        if (active) {
          setPage(getDefaultContentPage(slug));
          setError('Unable to load the latest policy content. Showing default information.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPage();

    const handleContentUpdated = () => {
      void loadPage();
    };

    window.addEventListener('shop2bhutan:content-updated', handleContentUpdated);

    return () => {
      active = false;
      window.removeEventListener('shop2bhutan:content-updated', handleContentUpdated);
    };
  }, [slug]);

  return (
    <div className="min-h-screen bg-white pb-8">
      <div className="sticky top-0 z-10 border-b border-neutral-100 bg-white">
        <div className="px-4 py-3">
          <h1 className="text-lg font-bold text-neutral-900">{page.title}</h1>
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="mx-auto max-w-2xl">
          <div className="mb-4 flex items-start gap-3 rounded-3xl border border-neutral-100 bg-white p-4 shadow-sm">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
              <FileText size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-black text-neutral-900">{page.title}</h2>
              <p className="mt-1 text-sm text-neutral-500">
                {page.updatedAt ? `Last updated ${formatDate(page.updatedAt)}` : 'Shop2Bhutan customer information'}
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              <AlertCircle size={17} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex h-48 items-center justify-center gap-2 rounded-3xl border border-neutral-100 bg-white text-sm text-neutral-500 shadow-sm">
              <Loader2 size={18} className="animate-spin text-orange-500" />
              Loading content...
            </div>
          ) : (
            <div className="rounded-3xl border border-neutral-100 bg-white p-4 shadow-sm">
              <div className="space-y-2.5 text-sm leading-6 text-neutral-600">
                {page.content.split('\n').map((line, index) => {
                  const cleanLine = line.trim();
                  if (!cleanLine) return <div key={`gap-${index}`} className="h-0" />;

                  const looksLikeHeading = /^\d+\.|^[A-Z][A-Za-z\s&]+$/.test(cleanLine) && cleanLine.length < 80;

                  return looksLikeHeading ? (
                    <h3 key={`${cleanLine}-${index}`} className="pt-3 text-[15px] font-extrabold text-neutral-900 first:pt-0">
                      {cleanLine}
                    </h3>
                  ) : (
                    <p key={`${cleanLine}-${index}`}>{cleanLine}</p>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
