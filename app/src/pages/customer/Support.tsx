import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Truck, CreditCard, MapPin, RotateCcw, ChevronDown, Phone, MessageCircle, Clock } from 'lucide-react';
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
 { icon: Truck, label: 'Track Order', color: 'bg-blue-50 text-blue-600' },
 { icon: CreditCard, label: 'Payment Issues', color: 'bg-violet-50 text-violet-600' },
 { icon: MapPin, label: 'Delivery Info', color: 'bg-emerald-50 text-emerald-600' },
 { icon: RotateCcw, label: 'Returns', color: 'bg-orange-50 text-orange-600' },
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
 <div className="min-h-screen bg-white">
 <div className="bg-white border-b border-gray-200 px-4 py-3">
 <div className="flex items-center gap-3">
 <button onClick={() => navigate(-1)} className="p-1">
 <ArrowLeft size={22} className="text-gray-700" />
 </button>
 <h1 className="text-lg font-semibold text-gray-900">Help Center</h1>
 </div>
 </div>

 <div className="px-4 py-4 space-y-5">
 {/* Search */}
 <div className="relative">
 <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
 <input
 type="text"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 placeholder="Search help articles..."
 className="w-full h-11 pl-10 pr-4 bg-white border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/10 "
 />
 </div>

 {/* Quick Actions */}
 <div className="grid grid-cols-2 gap-3">
 {quickActions.map(action => {
 const Icon = action.icon;
 return (
 <button key={action.label} className="bg-white rounded-2xl p-4 flex flex-col items-center gap-2 transition-shadow">
 <div className={`w-10 h-10 rounded-full ${action.color} flex items-center justify-center`}>
 <Icon size={20} />
 </div>
 <span className="text-sm font-semibold text-gray-900">{action.label}</span>
 </button>
 );
 })}
 </div>

 {/* FAQ Accordion */}
 <div>
 <h3 className="text-base font-semibold text-gray-900 mb-3">Frequently Asked Questions</h3>
 <div className="space-y-2">
 {filteredFaqs.map(faq => (
 <div key={faq.id} className="bg-white rounded-2xl overflow-hidden ">
 <button
 onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
 className="w-full flex items-center justify-between px-4 py-3.5 text-left"
>
 <span className="text-sm font-semibold text-gray-900 pr-4">{faq.question}</span>
 <ChevronDown
 size={18}
 className={`text-gray-400 flex-shrink-0 transition-transform ${
 expandedFaq === faq.id ? 'rotate-180' : ''
 }`}
 />
 </button>
 {expandedFaq === faq.id && (
 <div className="px-4 pb-4">
 <p className="text-sm text-gray-600 leading-relaxed">{faq.answer}</p>
 </div>
 )}
 </div>
 ))}
 </div>
 {filteredFaqs.length === 0 && (
 <p className="text-sm text-gray-500 text-center py-4">No results found</p>
 )}
 </div>

 {/* Contact Section */}
 <div className="bg-white rounded-2xl p-5 ">
 <h3 className="text-base font-semibold text-gray-900 mb-1">Still need help?</h3>
 <p className="text-sm text-gray-500 mb-4">Our team is ready to assist you</p>
 <div className="flex gap-3">
 <a
 href={telHref(appSettings.supportPhone)}
 className="flex-1 h-11 bg-orange-500 text-white font-medium rounded-2xl flex items-center justify-center gap-2 hover:bg-orange-600 transition-colors"
>
 <Phone size={16} />
 Call Us
 </a>
 <a
 href={whatsappHref(appSettings.whatsappNumber)}
 target="_blank"
 rel="noreferrer"
 className="flex-1 h-11 bg-emerald-500 text-white font-medium rounded-2xl flex items-center justify-center gap-2 hover:bg-emerald-600 transition-colors"
>
 <MessageCircle size={16} />
 WhatsApp
 </a>
 </div>
 <div className="flex items-center justify-center gap-1 mt-3">
 <Clock size={14} className="text-gray-400" />
 <p className="text-xs text-gray-500">{appSettings.businessHours}</p>
 </div>
 </div>
 </div>
 </div>
 );
}
