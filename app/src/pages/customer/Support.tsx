import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  Share2,
  ShieldCheck,
  Smartphone,
  Truck,
  X,
} from 'lucide-react';
import {
  DEFAULT_APP_SETTINGS,
  fetchPublicAppSettings,
  getBusinessHoursStatus,
} from '@/lib/appSettings';
import { fetchPublicFaqItems, type FAQItemRecord } from '@/lib/contentPages';
import { buildSupportDiagnostics } from '@/lib/deviceDiagnostics';
import { shareTextContent } from '@/lib/nativeShare';

function telHref(value: string) {
  const clean = value.replace(/[^+\d]/g, '');
  return clean ? `tel:${clean}` : undefined;
}

function whatsappHref(value: string, message?: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return undefined;

  const cleanMessage = String(message ?? '').trim();
  return cleanMessage
    ? `https://wa.me/${digits}?text=${encodeURIComponent(cleanMessage)}`
    : `https://wa.me/${digits}`;
}

const ORDER_ISSUE_LABELS: Record<string, string> = {
  payment_rejected: 'Payment proof rejected',
  order_cancelled: 'Order cancellation',
  delivery_not_received: 'Marked delivered but not received',
  delivery_problem: 'Delivery problem',
  order_delayed: 'Order delayed beyond estimate',
};

function readableOrderStatus(value?: string | null) {
  const clean = String(value ?? '').trim();
  if (!clean) return 'Order status unavailable';

  return clean
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}


const SEARCH_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'can',
  'do',
  'for',
  'how',
  'i',
  'in',
  'is',
  'me',
  'my',
  'of',
  'on',
  'or',
  'the',
  'to',
  'what',
  'where',
  'with',
  'your',
]);

const SEARCH_SYNONYMS: Record<string, string[]> = {
  track: ['tracking', 'status', 'progress'],
  tracking: ['track', 'status', 'progress'],
  pay: ['payment', 'paid'],
  payment: ['pay', 'paid', 'transaction'],
  delivery: ['deliver', 'shipping', 'shipment'],
  pickup: ['collect', 'collection', 'hub'],
  return: ['returns', 'refund', 'cancel', 'cancellation'],
  refund: ['return', 'returns', 'cancel', 'cancellation'],
  cancel: ['cancellation', 'cancelled', 'return', 'refund'],
  secure: ['safe', 'security', 'verified', 'verification'],
  proof: ['screenshot', 'receipt', 'transaction'],
  order: ['request', 'quotation', 'purchase'],
};

function normalizeSearchText(value: string) {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function searchTokenVariants(token: string) {
  const variants = new Set<string>([token, ...(SEARCH_SYNONYMS[token] || [])]);

  if (token.length > 4 && token.endsWith('s')) variants.add(token.slice(0, -1));
  if (token.length > 5 && token.endsWith('ing')) variants.add(token.slice(0, -3));
  if (token.length > 4 && token.endsWith('ed')) variants.add(token.slice(0, -2));

  return Array.from(variants).filter(Boolean);
}

function faqSearchScore(faq: FAQItemRecord, rawQuery: string) {
  const query = normalizeSearchText(rawQuery);
  if (!query) return 1;

  const category = normalizeSearchText(faq.category || '');
  const question = normalizeSearchText(faq.question || '');
  const answer = normalizeSearchText(faq.answer || '');
  const combined = `${category} ${question} ${answer}`.trim();

  const tokens = query
    .split(' ')
    .filter(Boolean)
    .filter((token) => !SEARCH_STOP_WORDS.has(token));

  const meaningfulTokens = tokens.length > 0 ? tokens : query.split(' ').filter(Boolean);
  let score = combined.includes(query) ? 60 : 0;
  let matchedTokens = 0;

  meaningfulTokens.forEach((token) => {
    const variants = searchTokenVariants(token);
    const questionMatch = variants.some((variant) => question.includes(variant));
    const categoryMatch = variants.some((variant) => category.includes(variant));
    const answerMatch = variants.some((variant) => answer.includes(variant));

    if (!questionMatch && !categoryMatch && !answerMatch) return;

    matchedTokens += 1;
    if (questionMatch) score += 12;
    if (categoryMatch) score += 8;
    if (answerMatch) score += 4;
  });

  const requiredMatches =
    meaningfulTokens.length <= 2
      ? meaningfulTokens.length
      : Math.max(2, Math.ceil(meaningfulTokens.length * 0.6));

  return matchedTokens >= requiredMatches ? score + matchedTokens * 2 : 0;
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
  const [searchParams] = useSearchParams();
  const orderId = String(searchParams.get('orderId') ?? '').trim();
  const orderNumber = String(searchParams.get('order') ?? '').trim();
  const orderStatus = String(searchParams.get('status') ?? '').trim();
  const issueKey = String(searchParams.get('issue') ?? '').trim();
  const issueLabel = ORDER_ISSUE_LABELS[issueKey] || '';
  const hasOrderContext = Boolean(orderNumber || orderId || issueLabel);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [appSettings, setAppSettings] = useState(DEFAULT_APP_SETTINGS);
  const [faqItems, setFaqItems] = useState<FAQItemRecord[]>([]);
  const [loadingFaqs, setLoadingFaqs] = useState(true);
  const [sharingDiagnostics, setSharingDiagnostics] = useState(false);
  const [diagnosticsFeedback, setDiagnosticsFeedback] = useState('');
  const [businessClock, setBusinessClock] = useState(() => Date.now());

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.scrollingElement?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setBusinessClock(Date.now());
    }, 60_000);

    return () => window.clearInterval(interval);
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
    const query = searchQuery.trim();
    if (!query) return faqItems;

    return faqItems
      .map((faq, index) => ({
        faq,
        index,
        score: faqSearchScore(faq, query),
      }))
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((result) => result.faq);
  }, [faqItems, searchQuery]);

  const filteredPolicies = useMemo(() => {
    const query = normalizeSearchText(searchQuery);
    if (!query) return [];

    const tokens = query
      .split(' ')
      .filter(Boolean)
      .filter((token) => !SEARCH_STOP_WORDS.has(token));
    const meaningfulTokens = tokens.length > 0 ? tokens : query.split(' ').filter(Boolean);

    return policyLinks.filter((policy) => {
      const searchable = normalizeSearchText(`${policy.label} ${policy.description}`);
      if (searchable.includes(query)) return true;

      return meaningfulTokens.every((token) =>
        searchTokenVariants(token).some((variant) => searchable.includes(variant)),
      );
    });
  }, [searchQuery]);

  const supportPhoneHref = telHref(appSettings.supportPhone);
  const contextualSupportMessage = useMemo(() => {
    if (!hasOrderContext) return '';

    return [
      'Hello Shop2Bhutan Support,',
      '',
      orderNumber ? `Order: #${orderNumber}` : orderId ? `Order ID: ${orderId}` : '',
      orderStatus ? `Current status: ${readableOrderStatus(orderStatus)}` : '',
      issueLabel ? `Issue: ${issueLabel}` : '',
      '',
      'Please describe what happened:',
    ]
      .filter(Boolean)
      .join('\n');
  }, [hasOrderContext, issueLabel, orderId, orderNumber, orderStatus]);
  const supportWhatsappHref = whatsappHref(
    appSettings.whatsappNumber,
    contextualSupportMessage,
  );
  const businessHoursStatus = useMemo(
    () =>
      getBusinessHoursStatus(
        appSettings.businessSchedule,
        new Date(businessClock),
      ),
    [appSettings.businessSchedule, businessClock],
  );
  const hasSearchQuery = searchQuery.trim().length > 0;

  const applyQuickSearch = (query: string) => {
    setSearchQuery(query);
    setExpandedFaq(null);

    requestAnimationFrame(() => {
      document.getElementById('support-search-title')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  const clearSearch = () => {
    setSearchQuery('');
    setExpandedFaq(null);
  };

  const shareDiagnostics = async () => {
    if (sharingDiagnostics) return;

    setSharingDiagnostics(true);
    setDiagnosticsFeedback('');

    try {
      const diagnostics = await buildSupportDiagnostics();
      const result = await shareTextContent({
        title: 'Shop2Bhutan Support Diagnostics',
        dialogTitle: 'Share support diagnostics',
        text: diagnostics,
      });

      if (result === 'copied') {
        setDiagnosticsFeedback('Diagnostics copied');
      } else if (result === 'shared') {
        setDiagnosticsFeedback('Diagnostics ready to share');
      }

      window.setTimeout(() => setDiagnosticsFeedback(''), 2400);
    } catch (diagnosticsError) {
      console.warn(
        'Unable to prepare support diagnostics:',
        diagnosticsError,
      );
      setDiagnosticsFeedback('Unable to prepare diagnostics');
      window.setTimeout(() => setDiagnosticsFeedback(''), 2800);
    } finally {
      setSharingDiagnostics(false);
    }
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
        {hasOrderContext && (
          <section
            aria-labelledby="order-support-context-title"
            className="rounded-[26px] border border-orange-100 bg-orange-50/70 p-4"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-orange-600 shadow-sm">
                <LifeBuoy size={19} strokeWidth={2.2} />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-orange-600">
                  Order support
                </p>
                <h2
                  id="order-support-context-title"
                  className="mt-1 text-[15px] font-extrabold tracking-[-0.01em] text-neutral-950"
                >
                  {issueLabel || 'Help with this order'}
                </h2>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {orderNumber && (
                    <span className="rounded-full bg-white px-2.5 py-1 text-[10.5px] font-bold text-neutral-700 ring-1 ring-orange-100">
                      #{orderNumber}
                    </span>
                  )}
                  {orderStatus && (
                    <span className="rounded-full bg-white px-2.5 py-1 text-[10.5px] font-bold text-neutral-500 ring-1 ring-orange-100">
                      {readableOrderStatus(orderStatus)}
                    </span>
                  )}
                </div>

                <p className="mt-2 text-xs leading-5 text-neutral-600">
                  Your order reference, current status, and issue category will be
                  included automatically when you contact us on WhatsApp.
                </p>

                {orderId && (
                  <button
                    type="button"
                    onClick={() => navigate(`/order/${orderId}`)}
                    className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-extrabold text-orange-700 transition active:text-orange-800"
                  >
                    View this order
                    <ArrowUpRight size={13} strokeWidth={2.4} />
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

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

            {hasSearchQuery && (
              <div
                id="support-live-results"
                className="mt-3 overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm"
                aria-live="polite"
              >
                <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-3.5 py-3">
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-orange-600">
                      Live results
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-neutral-500">
                      Matching “{searchQuery.trim()}”
                    </p>
                  </div>

                  {!loadingFaqs && (
                    <span className="shrink-0 rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-extrabold text-orange-700">
                      {filteredFaqs.length + filteredPolicies.length}
                    </span>
                  )}
                </div>

                {loadingFaqs ? (
                  <div className="flex items-center justify-center gap-2 px-4 py-7 text-sm font-semibold text-neutral-500">
                    <Loader2 size={17} className="animate-spin text-orange-500" />
                    Searching help content...
                  </div>
                ) : filteredFaqs.length > 0 || filteredPolicies.length > 0 ? (
                  <div className="max-h-[420px] overflow-y-auto">
                    {filteredPolicies.map((policy) => {
                      const Icon = policy.icon;

                      return (
                        <button
                          key={policy.path}
                          type="button"
                          onClick={() => navigate(policy.path)}
                          className="flex w-full items-center gap-3 border-b border-neutral-100 px-3.5 py-3.5 text-left transition active:bg-neutral-50"
                        >
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${policy.iconClass}`}>
                            <Icon size={17} strokeWidth={2.1} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-extrabold text-neutral-900">{policy.label}</span>
                            <span className="mt-0.5 block truncate text-[11px] text-neutral-500">{policy.description}</span>
                          </span>
                          <ArrowUpRight size={16} className="shrink-0 text-neutral-300" />
                        </button>
                      );
                    })}

                    {filteredFaqs.map((faq, index) => {
                      const isExpanded = expandedFaq === faq.id;
                      const hasDivider = index < filteredFaqs.length - 1;

                      return (
                        <article
                          key={faq.id}
                          className={hasDivider ? 'border-b border-neutral-100' : ''}
                        >
                          <button
                            type="button"
                            onClick={() => setExpandedFaq(isExpanded ? null : faq.id)}
                            aria-expanded={isExpanded}
                            className="flex w-full items-start justify-between gap-3 px-3.5 py-3.5 text-left transition active:bg-neutral-50"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-bold leading-5 text-neutral-900">{faq.question}</span>
                              {faq.category && (
                                <span className="mt-1 block text-[10px] font-extrabold uppercase tracking-[0.08em] text-neutral-400">
                                  {faq.category}
                                </span>
                              )}
                            </span>
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
                            <div className="px-3.5 pb-4 pr-12">
                              <p className="whitespace-pre-line text-[13px] leading-6 text-neutral-600">{faq.answer}</p>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-5 py-7 text-center">
                    <Search size={21} className="mx-auto text-neutral-300" />
                    <p className="mt-2 text-sm font-extrabold text-neutral-900">No matching content</p>
                    <p className="mt-1 text-xs leading-5 text-neutral-500">
                      Try a simpler keyword such as order, payment, delivery, refund, or privacy.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {!hasSearchQuery && (
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
        )}

        {!hasSearchQuery && (
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
        )}

        {!hasSearchQuery && (
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
        )}

        <section aria-labelledby="support-diagnostics-title">
          <div className="rounded-[26px] border border-blue-100 bg-blue-50/60 p-4">
            <div className="flex items-start gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-600 ring-1 ring-blue-100">
                <Smartphone size={20} strokeWidth={2.2} />
              </span>

              <div className="min-w-0 flex-1">
                <h2
                  id="support-diagnostics-title"
                  className="text-base font-extrabold tracking-[-0.01em] text-neutral-950"
                >
                  App diagnostics
                </h2>
                <p className="mt-1 text-xs leading-5 text-neutral-600">
                  Share your app version, phone model, operating system,
                  WebView, and connection status when reporting a technical
                  issue.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void shareDiagnostics()}
              disabled={sharingDiagnostics}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 text-sm font-extrabold text-white transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
            >
              {sharingDiagnostics ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Share2 size={16} strokeWidth={2.3} />
              )}
              {sharingDiagnostics
                ? 'Preparing diagnostics...'
                : 'Share diagnostics'}
            </button>

            {diagnosticsFeedback && (
              <p
                className="mt-2 text-center text-[11px] font-semibold text-blue-700"
                role="status"
              >
                {diagnosticsFeedback}
              </p>
            )}

            <p className="mt-3 text-center text-[10px] leading-4 text-neutral-500">
              Device ID, account details, passwords, addresses, and payment
              information are never included.
            </p>
          </div>
        </section>

        <section aria-labelledby="contact-support-title">
          <div className="rounded-[26px] border border-neutral-100 bg-neutral-950 p-5 text-white shadow-[0_16px_36px_rgba(0,0,0,0.12)]">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-orange-300">
                <HeadphonesIcon size={21} strokeWidth={2.1} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="contact-support-title" className="text-base font-extrabold tracking-[-0.01em]">
                  {hasOrderContext ? 'Contact us about this order' : 'Still need help?'}
                </h2>
                <p className="mt-1 text-xs leading-5 text-neutral-300">
                  {hasOrderContext
                    ? 'Your order details are ready to send with your message.'
                    : 'Speak directly with the Shop2Bhutan support team.'}
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
                  {hasOrderContext ? 'Message us' : 'WhatsApp'}
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
              <div className="mt-4 border-t border-white/10 pt-4 text-center">
                <div className="flex items-center justify-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      businessHoursStatus.isOpen
                        ? 'bg-emerald-400'
                        : 'bg-amber-400'
                    }`}
                  />
                  <Clock
                    size={13}
                    className="text-neutral-400"
                    strokeWidth={2.1}
                  />
                  <p
                    className={`text-[11px] font-bold ${
                      businessHoursStatus.isOpen
                        ? 'text-emerald-300'
                        : 'text-amber-300'
                    }`}
                  >
                    {businessHoursStatus.headline} ·{' '}
                    {businessHoursStatus.detail}
                  </p>
                </div>

                <p className="mt-1.5 text-[10px] leading-4 text-neutral-500">
                  {businessHoursStatus.summary}
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
