import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  ChevronDown,
  Clock,
  CreditCard,
  FileText,
  HeadphonesIcon,
  LifeBuoy,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  RotateCcw,
  Search,
  ShieldCheck,
  Truck,
  X,
} from 'lucide-react';
import { DEFAULT_APP_SETTINGS, fetchPublicAppSettings } from '@/lib/appSettings';
import { fetchPublicFaqItems, type FAQItemRecord } from '@/lib/contentPages';

function telHref(value: string) {
  const clean = value.replace(/[^+\d]/g, '');
  return clean ? `tel:${clean}` : undefined;
}

function whatsappHref(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : undefined;
}

const quickActions = [
  {
    icon: Truck,
    label: 'Track order',
    description: 'Order status & delivery',
    query: 'track order delivery',
    iconClass: 'bg-orange-50 text-orange-600',
  },
  {
    icon: CreditCard,
    label: 'Payment help',
    description: 'Proof, methods & issues',
    query: 'payment secure proof methods',
    iconClass: 'bg-blue-50 text-blue-600',
  },
  {
    icon: MapPin,
    label: 'Delivery info',
    description: 'Pickup hubs & locations',
    query: 'delivery pickup hub',
    iconClass: 'bg-emerald-50 text-emerald-600',
  },
  {
    icon: RotateCcw,
    label: 'Returns',
    description: 'Cancellation & refunds',
    query: 'return cancel refund',
    iconClass: 'bg-violet-50 text-violet-600',
  },
];

const policyLinks = [
  {
    label: 'Terms of Service',
    description: 'Rules for using Shop2Bhutan',
    path: '/terms',
    icon: FileText,
    iconClass: 'bg-blue-50 text-blue-600',
  },
  {
    label: 'Privacy Policy',
    description: 'How your information is handled',
    path: '/privacy',
    icon: ShieldCheck,
    iconClass: 'bg-emerald-50 text-emerald-600',
  },
  {
    label: 'Return Policy',
    description: 'Return, cancellation & refund terms',
    path: '/return-policy',
    icon: RotateCcw,
    iconClass: 'bg-orange-50 text-orange-600',
  },
];

export default function Support() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [appSettings, setAppSettings] = useState(DEFAULT_APP_SETTINGS);
  const [faqItems, setFaqItems] = useState<FAQItemRecord[]>([]);
  const [loadingFaqs, setLoadingFaqs] = useState(true);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.scrollingElement?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      try {
        const loaded = await fetchPublicAppSettings();
        if (active) setAppSettings(loaded);
      } catch (error) {
        console.warn('[Support] App settings skipped:', error);
      }
    }

    async function loadFaqs() {
      setLoadingFaqs(true);
      try {
        const loaded = await fetchPublicFaqItems();
        if (active) setFaqItems(loaded);
      } catch (error) {
        console.warn('[Support] FAQ load skipped:', error);
        if (active) setFaqItems([]);
      } finally {
        if (active) setLoadingFaqs(false);
      }
    }

    void loadSettings();
    void loadFaqs();

    const handleSettingsUpdated = () => {
      void loadSettings();
    };

    const handleContentUpdated = () => {
      void loadFaqs();
    };

    window.addEventListener('shop2bhutan:app-settings-updated', handleSettingsUpdated);
    window.addEventListener('shop2bhutan:content-updated', handleContentUpdated);

    return () => {
      active = false;
      window.removeEventListener('shop2bhutan:app-settings-updated', handleSettingsUpdated);
      window.removeEventListener('shop2bhutan:content-updated', handleContentUpdated);
    };
  }, []);

  const filteredFaqs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return faqItems.filter((faq) => {
      const searchable = [faq.category, faq.question, faq.answer].join(' ').toLowerCase();
      return !query || searchable.includes(query);
    });
  }, [faqItems, searchQuery]);

  const supportPhoneHref = telHref(appSettings.supportPhone);
  const supportWhatsappHref = whatsappHref(appSettings.whatsappNumber);
  const hasSearchQuery = searchQuery.trim().length > 0;

  const applyQuickSearch = (query: string) => {
    setSearchQuery(query);
    setExpandedFaq(null);

    requestAnimationFrame(() => {
      document.getElementById('support-faqs')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  const clearSearch = () => {
    setSearchQuery('');
    setExpandedFaq(null);
  };

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <header className="sticky top-0 z-20 border-b border-neutral-100 bg-white/95 backdrop-blur-xl">
        <div className="px-4 pb-3 pt-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[19px] font-extrabold tracking-[-0.02em] text-neutral-950">
                Help &amp; Support
              </h1>
              <p className="mt-0.5 text-xs font-medium text-neutral-500">
                Find quick answers or contact our team
              </p>
            </div>

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
              <LifeBuoy size={20} strokeWidth={2.2} />
            </div>
          </div>
        </div>
      </header>

      <main className="space-y-7 px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-4">
        <section aria-labelledby="support-search-title">
          <div className="rounded-[26px] border border-orange-100 bg-orange-50/70 p-4">
            <div className="mb-3">
              <h2 id="support-search-title" className="text-base font-extrabold tracking-[-0.01em] text-neutral-950">
                How can we help?
              </h2>
              <p className="mt-1 text-xs leading-5 text-neutral-600">
                Search FAQs by order, payment, delivery, return, or any other topic.
              </p>
            </div>

            <div className="relative">
              <Search
                size={18}
                strokeWidth={2.2}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setExpandedFaq(null);
                }}
                placeholder="Search help articles"
                aria-label="Search help articles"
                className="h-12 w-full rounded-2xl border border-white bg-white pl-11 pr-11 text-sm font-medium text-neutral-900 shadow-sm outline-none transition placeholder:text-neutral-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-500/10"
              />

              {hasSearchQuery && (
                <button
                  type="button"
                  onClick={clearSearch}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 transition active:scale-95"
                >
                  <X size={15} strokeWidth={2.3} />
                </button>
              )}
            </div>
          </div>
        </section>

        <section aria-labelledby="quick-help-title">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 id="quick-help-title" className="text-base font-extrabold tracking-[-0.01em] text-neutral-950">
                Quick help
              </h2>
              <p className="mt-0.5 text-xs text-neutral-500">Jump directly to a common topic</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon;

              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => applyQuickSearch(action.query)}
                  className="group min-h-[118px] rounded-[22px] border border-neutral-100 bg-white p-3.5 text-left shadow-[0_8px_24px_rgba(0,0,0,0.035)] transition active:scale-[0.98]"
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${action.iconClass}`}>
                    <Icon size={19} strokeWidth={2.1} />
                  </div>
                  <p className="mt-3 text-sm font-extrabold text-neutral-900">{action.label}</p>
                  <p className="mt-1 text-[11px] leading-4 text-neutral-500">{action.description}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="policies-title">
          <div className="mb-3">
            <h2 id="policies-title" className="text-base font-extrabold tracking-[-0.01em] text-neutral-950">
              Policies &amp; terms
            </h2>
            <p className="mt-0.5 text-xs text-neutral-500">Important service and privacy information</p>
          </div>

          <div className="overflow-hidden rounded-[24px] border border-neutral-100 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.035)]">
            {policyLinks.map((item, index) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className={`flex w-full items-center gap-3.5 px-4 py-4 text-left transition active:bg-neutral-50 ${
                    index < policyLinks.length - 1 ? 'border-b border-neutral-100' : ''
                  }`}
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${item.iconClass}`}>
                    <Icon size={18} strokeWidth={2.1} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold text-neutral-900">{item.label}</p>
                    <p className="mt-0.5 truncate text-[11px] text-neutral-500">{item.description}</p>
                  </div>

                  <ArrowUpRight size={17} className="shrink-0 text-neutral-300" strokeWidth={2.1} />
                </button>
              );
            })}
          </div>
        </section>

        <section id="support-faqs" aria-labelledby="faq-title" className="scroll-mt-24">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 id="faq-title" className="text-base font-extrabold tracking-[-0.01em] text-neutral-950">
                Frequently asked questions
              </h2>
              <p className="mt-0.5 text-xs text-neutral-500">
                {hasSearchQuery ? `Results for “${searchQuery.trim()}”` : 'Answers to common customer questions'}
              </p>
            </div>

            {!loadingFaqs && filteredFaqs.length > 0 && (
              <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-extrabold text-neutral-500">
                {filteredFaqs.length}
              </span>
            )}
          </div>

          {loadingFaqs ? (
            <div className="flex min-h-36 flex-col items-center justify-center rounded-[24px] border border-neutral-100 bg-neutral-50/70 px-5 text-center">
              <Loader2 size={21} className="animate-spin text-orange-500" />
              <p className="mt-3 text-sm font-bold text-neutral-700">Loading help articles</p>
              <p className="mt-1 text-xs text-neutral-400">Getting the latest support information...</p>
            </div>
          ) : filteredFaqs.length > 0 ? (
            <div className="overflow-hidden rounded-[24px] border border-neutral-100 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.035)]">
              {filteredFaqs.map((faq, index) => {
                const isExpanded = expandedFaq === faq.id;

                return (
                  <article
                    key={faq.id}
                    className={index < filteredFaqs.length - 1 ? 'border-b border-neutral-100' : ''}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedFaq(isExpanded ? null : faq.id)}
                      aria-expanded={isExpanded}
                      className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left transition active:bg-neutral-50"
                    >
                      <span className="pt-0.5 text-sm font-bold leading-5 text-neutral-900">{faq.question}</span>
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition ${
                          isExpanded ? 'bg-orange-50 text-orange-600' : 'bg-neutral-50 text-neutral-400'
                        }`}
                      >
                        <ChevronDown
                          size={16}
                          strokeWidth={2.2}
                          className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 pr-14">
                        <p className="whitespace-pre-line text-[13px] leading-6 text-neutral-600">{faq.answer}</p>
                        {faq.category && (
                          <span className="mt-3 inline-flex rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-neutral-500">
                            {faq.category}
                          </span>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-48 flex-col items-center justify-center rounded-[24px] border border-dashed border-neutral-200 bg-neutral-50/60 px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-neutral-400 shadow-sm">
                <Search size={21} strokeWidth={2.1} />
              </div>
              <p className="mt-3 text-sm font-extrabold text-neutral-900">No matching answers</p>
              <p className="mt-1 max-w-[240px] text-xs leading-5 text-neutral-500">
                Try a simpler keyword or contact our support team directly.
              </p>
              {hasSearchQuery && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="mt-4 rounded-xl bg-neutral-900 px-4 py-2.5 text-xs font-extrabold text-white transition active:scale-[0.98]"
                >
                  Clear search
                </button>
              )}
            </div>
          )}
        </section>

        <section aria-labelledby="contact-support-title">
          <div className="rounded-[26px] border border-neutral-100 bg-neutral-950 p-5 text-white shadow-[0_16px_36px_rgba(0,0,0,0.12)]">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-orange-300">
                <HeadphonesIcon size={21} strokeWidth={2.1} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="contact-support-title" className="text-base font-extrabold tracking-[-0.01em]">
                  Still need help?
                </h2>
                <p className="mt-1 text-xs leading-5 text-neutral-300">
                  Speak directly with the Shop2Bhutan support team.
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              {supportPhoneHref ? (
                <a
                  href={supportPhoneHref}
                  className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-orange-500 px-3 text-sm font-extrabold text-white transition active:scale-[0.98]"
                >
                  <Phone size={16} strokeWidth={2.2} />
                  Call us
                </a>
              ) : (
                <span
                  aria-disabled="true"
                  className="flex h-12 cursor-not-allowed items-center justify-center gap-2 rounded-2xl bg-white/10 px-3 text-sm font-extrabold text-white/40"
                >
                  <Phone size={16} strokeWidth={2.2} />
                  Call us
                </span>
              )}

              {supportWhatsappHref ? (
                <a
                  href={supportWhatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-3 text-sm font-extrabold text-white transition active:scale-[0.98]"
                >
                  <MessageCircle size={16} strokeWidth={2.2} />
                  WhatsApp
                </a>
              ) : (
                <span
                  aria-disabled="true"
                  className="flex h-12 cursor-not-allowed items-center justify-center gap-2 rounded-2xl bg-white/10 px-3 text-sm font-extrabold text-white/40"
                >
                  <MessageCircle size={16} strokeWidth={2.2} />
                  WhatsApp
                </span>
              )}
            </div>

            {appSettings.businessHours && (
              <div className="mt-4 flex items-center justify-center gap-1.5 border-t border-white/10 pt-4">
                <Clock size={13} className="text-neutral-400" strokeWidth={2.1} />
                <p className="text-[11px] font-medium text-neutral-400">{appSettings.businessHours}</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
