import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
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
} from 'lucide-react';
import { faqs } from '@/data/mockData';
import { DEFAULT_APP_SETTINGS, fetchPublicAppSettings } from '@/lib/appSettings';


function telHref(value: string) {
 const clean = value.replace(/[^+\d]/g, '');
 return clean ? `tel:${clean}` : undefined;
}

function whatsappHref(value: string) {
 const digits = value.replace(/\D/g, '');
 return digits ? `https://wa.me/${digits}` : undefined;
}

const quickActions = [
 { icon: Truck, label: 'Track Order' },
 { icon: CreditCard, label: 'Payment Issues' },
 { icon: MapPin, label: 'Delivery Info' },
 { icon: RotateCcw, label: 'Returns' },
];

export default function Support() {
 const navigate = useNavigate();
 const [searchQuery, setSearchQuery] = useState('');
 const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
 const [appSettings, setAppSettings] = useState(DEFAULT_APP_SETTINGS);

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

 void loadSettings();

 const handleSettingsUpdated = () => {
 void loadSettings();
 };

 window.addEventListener('shop2bhutan:app-settings-updated', handleSettingsUpdated);

 return () => {
 active = false;
 window.removeEventListener('shop2bhutan:app-settings-updated', handleSettingsUpdated);
 };
 }, []);

 const filteredFaqs = faqs.filter(f =>
 !searchQuery ||
 f.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
 f.answer.toLowerCase().includes(searchQuery.toLowerCase())
 );

 return (
    <div className="min-h-screen bg-white pb-8">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-neutral-100 bg-white">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full hover:bg-neutral-100"
          >
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-lg font-bold text-neutral-900">Help Center</h1>
        </div>
      </div>

      <div className="space-y-6 px-4 py-4">
        {/* Search */}
        <div className="relative">
          <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
            <Search size={18} />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search help articles..."
            className="h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 pl-11 pr-4 text-sm outline-none transition focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-500/10"
          />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                className="flex flex-col items-center gap-2 rounded-2xl p-3 transition hover:bg-neutral-50 active:scale-[0.98]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
                  <Icon size={22} strokeWidth={2} />
                </div>
                <span className="text-xs font-bold text-neutral-700">{action.label}</span>
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="h-px bg-neutral-100" />

        {/* FAQ Accordion */}
        <div>
          <h3 className="mb-4 text-base font-bold text-neutral-900">Frequently Asked Questions</h3>
          <div className="space-y-0">
            {filteredFaqs.map((faq) => (
              <div
                key={faq.id}
                className="border-b border-neutral-100 last:border-b-0"
              >
                <button
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
                  </div>
                )}
              </div>
            ))}
          </div>
          {filteredFaqs.length === 0 && (
            <div className="flex flex-col items-center py-8">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
                <Search size={24} />
              </div>
              <p className="mt-3 text-sm font-bold text-neutral-900">No results found</p>
              <p className="mt-1 text-xs text-neutral-500">Try a different search term</p>
            </div>
          )}
        </div>

        {/* Contact Section */}
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
