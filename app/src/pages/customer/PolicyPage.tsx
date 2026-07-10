import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  FileText,
  HeadphonesIcon,
  Loader2,
  RotateCcw,
  ScrollText,
  ShieldCheck,
} from 'lucide-react';
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

function getPolicyMeta(slug: ContentPageSlug) {
  switch (String(slug)) {
    case 'privacy':
    case 'privacy-policy':
      return {
        icon: ShieldCheck,
        eyebrow: 'Your information',
        description: 'How Shop2Bhutan collects, uses, and protects customer information.',
        iconClassName: 'bg-blue-50 text-blue-600',
        badgeClassName: 'bg-blue-50 text-blue-700',
      };

    case 'return':
    case 'returns':
    case 'return-policy':
      return {
        icon: RotateCcw,
        eyebrow: 'Returns & refunds',
        description: 'Important information about cancellations, returns, and eligible refunds.',
        iconClassName: 'bg-purple-50 text-purple-600',
        badgeClassName: 'bg-purple-50 text-purple-700',
      };

    case 'terms':
    case 'terms-of-service':
      return {
        icon: ScrollText,
        eyebrow: 'Service agreement',
        description: 'The terms that apply when using Shop2Bhutan services.',
        iconClassName: 'bg-orange-50 text-orange-600',
        badgeClassName: 'bg-orange-50 text-orange-700',
      };

    default:
      return {
        icon: FileText,
        eyebrow: 'Customer information',
        description: 'Important information about using Shop2Bhutan services.',
        iconClassName: 'bg-orange-50 text-orange-600',
        badgeClassName: 'bg-orange-50 text-orange-700',
      };
  }
}

export default function PolicyPage({ slug }: { slug: ContentPageSlug }) {
  const navigate = useNavigate();
  const [page, setPage] = useState<ContentPageRecord>(() => getDefaultContentPage(slug));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const policyMeta = useMemo(() => getPolicyMeta(slug), [slug]);
  const PolicyIcon = policyMeta.icon;

  const contentLines = useMemo(
    () => page.content.split('\n').map((line) => line.trim()),
    [page.content],
  );

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.scrollingElement?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [slug]);

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
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-20 border-b border-neutral-100 bg-white/95 backdrop-blur-xl">
        <div className="px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-orange-500">
            Shop2Bhutan
          </p>
          <h1 className="mt-0.5 truncate text-lg font-bold text-neutral-950">{page.title}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-4">
        <section className="rounded-[28px] border border-neutral-100 bg-neutral-50 p-5">
          <div className="flex items-start gap-4">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${policyMeta.iconClassName}`}
            >
              <PolicyIcon size={23} strokeWidth={2.1} />
            </div>

            <div className="min-w-0 flex-1">
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] ${policyMeta.badgeClassName}`}
              >
                {policyMeta.eyebrow}
              </span>
              <h2 className="mt-2 text-xl font-black leading-tight text-neutral-950">{page.title}</h2>
              <p className="mt-1.5 text-sm leading-5 text-neutral-500">{policyMeta.description}</p>
            </div>
          </div>

          <div className="mt-4 border-t border-neutral-200/70 pt-3">
            <p className="text-xs font-medium text-neutral-500">
              {page.updatedAt
                ? `Last updated ${formatDate(page.updatedAt)}`
                : 'Official Shop2Bhutan customer information'}
            </p>
          </div>
        </section>

        {error && (
          <div
            role="status"
            className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3.5"
          >
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-bold text-amber-900">Latest version unavailable</p>
              <p className="mt-0.5 text-xs leading-5 text-amber-700">{error}</p>
            </div>
          </div>
        )}

        {loading ? (
          <section
            aria-live="polite"
            className="mt-4 overflow-hidden rounded-[28px] border border-neutral-100 bg-white p-5"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-500">
              <Loader2 size={18} className="animate-spin text-orange-500" />
              Loading policy information...
            </div>

            <div className="mt-6 space-y-5" aria-hidden="true">
              {[0, 1, 2].map((item) => (
                <div key={item} className="space-y-2.5">
                  <div className="h-4 w-2/5 animate-pulse rounded-full bg-neutral-100" />
                  <div className="h-3 w-full animate-pulse rounded-full bg-neutral-100" />
                  <div className="h-3 w-11/12 animate-pulse rounded-full bg-neutral-100" />
                  <div className="h-3 w-4/5 animate-pulse rounded-full bg-neutral-100" />
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section className="mt-4 rounded-[28px] border border-neutral-100 bg-white px-5 py-2 shadow-[0_8px_28px_rgba(0,0,0,0.035)]">
            <div className="divide-y divide-neutral-100">
              {contentLines.map((line, index) => {
                if (!line) return null;

                const bulletMatch = line.match(/^[-•*]\s+(.+)/);
                const numberedHeading = /^\d+[.)]\s+\S+/.test(line) && line.length < 90;
                const plainHeading =
                  /^[A-Z][A-Za-z\s/&-]+$/.test(line) &&
                  line.length < 80 &&
                  line.split(/\s+/).length <= 10;

                if (bulletMatch) {
                  return (
                    <div key={`${line}-${index}`} className="flex gap-3 py-3 first:pt-4 last:pb-4">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" />
                      <p className="text-[14px] leading-6 text-neutral-600">{bulletMatch[1]}</p>
                    </div>
                  );
                }

                if (numberedHeading || plainHeading) {
                  return (
                    <h3
                      key={`${line}-${index}`}
                      className="py-4 text-[15px] font-extrabold leading-6 text-neutral-950"
                    >
                      {line}
                    </h3>
                  );
                }

                return (
                  <p
                    key={`${line}-${index}`}
                    className="py-3.5 text-[14px] leading-6 text-neutral-600 first:pt-4 last:pb-4"
                  >
                    {line}
                  </p>
                );
              })}
            </div>
          </section>
        )}

        {!loading && (
          <section className="mt-4 rounded-[28px] border border-neutral-100 bg-neutral-50 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
                <HeadphonesIcon size={21} strokeWidth={2.1} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-extrabold text-neutral-950">Have questions?</h3>
                <p className="mt-1 text-xs leading-5 text-neutral-500">
                  Visit the Help Center to search FAQs or contact our support team.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('/support')}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 text-sm font-bold text-white transition hover:bg-orange-600 active:scale-[0.98]"
            >
              Open Help Center
              <ArrowRight size={16} />
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
