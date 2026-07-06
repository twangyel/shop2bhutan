import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Truck,
  CreditCard,
  MapPin,
  RotateCcw,
  ChevronDown,
  Phone,
  MessageCircle,
  Clock,
  HeadphonesIcon,
  FileText,
  Loader2,
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
  { icon: Truck, label: 'Track Order', query: 'track order delivery' },
  { icon: CreditCard, label: 'Payment Issues', query: 'payment secure proof methods' },
  { icon: MapPin, label: 'Delivery Info', query: 'delivery pickup hub' },
  { icon: RotateCcw, label: 'Returns', query: 'return cancel refund' },
];

const policyLinks = [
  { label: 'Terms of Service', path: '/terms' },
  { label: 'Privacy Policy', path: '/privacy' },
  { label: 'Return Policy', path: '/return-policy' },
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

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-10 border-b border-neutral-100 bg-white">
        <div className="px-4 py-3">
          <h1 className="text-lg font-bold text-neutral-900">Help Center</h1>
          <p className="text-xs text-neutral-500">Search FAQs, policies, and contact support</p>
        </div>
      </div>

      <div className="space-y-6 px-4 pb-24 pt-4">
        <div className="relative">
          <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
            <Search size={18} />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search help articles..."
            className="h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 pl-11 pr-4 text-sm outline-none transition focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-500/10"
          />
        </div>

        <div className="grid grid-cols-4 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                onClick={() => setSearchQuery(action.query)}
                className="flex flex-col items-center gap-2 rounded-2xl p-3 transition hover:bg-neutral-50 active:scale-[0.98]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
                  <Icon size={22} strokeWidth={2} />
                </div>
                <span className="text-center text-xs font-bold text-neutral-700">{action.label}</span>
              </button>
            );
          })}
        </div>

        <div className="rounded-3xl border border-neutral-100 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-500">
              <FileText size={22} strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-neutral-900">Policies &amp; terms</h3>
              <p className="mt-0.5 text-xs text-neutral-500">Read Shop2Bhutan service, privacy, and return information</p>
            </div>
          </div>

          <div className="mt-4 grid gap-2">
            {policyLinks.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className="flex h-11 items-center justify-between rounded-2xl border border-neutral-100 bg-neutral-50 px-4 text-left text-sm font-bold text-neutral-700 transition hover:bg-neutral-100 active:scale-[0.98]"
              >
                {item.label}
                <ChevronDown size={16} className="-rotate-90 text-neutral-400" />
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-neutral-100" />

        <div>
          <h3 className="mb-4 text-base font-bold text-neutral-900">Frequently Asked Questions</h3>

          {loadingFaqs ? (
            <div className="flex items-center justify-center gap-2 rounded-3xl border border-neutral-100 bg-white py-10 text-sm text-neutral-500 shadow-sm">
              <Loader2 size={18} className="animate-spin text-orange-500" />
              Loading help articles...
            </div>
          ) : (
            <div className="space-y-0">
              {filteredFaqs.map((faq) => (
                <div
                  key={faq.id}
                  className="border-b border-neutral-100 last:border-b-0"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                    className="flex w-full items-center justify-between gap-4 py-4 text-left"
                  >
                    <span className="text-sm font-semibold text-neutral-900">{faq.question}</span>
                    <ChevronDown
                      size={18}
                      className={`shrink-0 text-neutral-400 transition-transform ${
                        expandedFaq === faq.id ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {expandedFaq === faq.id && (
                    <div className="pb-4">
                      <p className="text-sm leading-relaxed text-neutral-500">{faq.answer}</p>
                      <p className="mt-2 text-[11px] font-bold uppercase tracking-wider text-neutral-300">{faq.category}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {!loadingFaqs && filteredFaqs.length === 0 && (
            <div className="flex flex-col items-center py-8">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
                <Search size={24} />
              </div>
              <p className="mt-3 text-sm font-bold text-neutral-900">No results found</p>
              <p className="mt-1 text-xs text-neutral-500">Try a different search term</p>
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-neutral-100 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
              <HeadphonesIcon size={22} strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-neutral-900">Still need help?</h3>
              <p className="mt-0.5 text-xs text-neutral-500">Our team is ready to assist you</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <a
              href={telHref(appSettings.supportPhone)}
              className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-orange-500 text-sm font-bold text-white transition hover:bg-orange-600 active:scale-[0.98]"
            >
              <Phone size={16} />
              Call Us
            </a>
            <a
              href={whatsappHref(appSettings.whatsappNumber)}
              target="_blank"
              rel="noreferrer"
              className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-sm font-bold text-white transition hover:bg-emerald-600 active:scale-[0.98]"
            >
              <MessageCircle size={16} />
              WhatsApp
            </a>
          </div>

          <div className="mt-3 flex items-center justify-center gap-1.5">
            <Clock size={13} className="text-neutral-400" />
            <p className="text-xs text-neutral-400">{appSettings.businessHours}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
