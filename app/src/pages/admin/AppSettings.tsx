import { Save, Image, Settings, Clock, Wrench } from 'lucide-react';
import Logo from '@/components/shared/Logo';

const sections = [
  {
    title: 'General',
    icon: Settings,
    fields: [
      { label: 'App Name', type: 'text', value: 'Shop2Bhutan' },
      { label: 'Contact Email', type: 'email', value: 'support@shop2bhutan.com' },
      { label: 'Contact Phone', type: 'tel', value: '+975 17123456' },
      { label: 'WhatsApp Number', type: 'tel', value: '+975 17123456' },
    ]
  },
  {
    title: 'Order Settings',
    icon: Clock,
    fields: [
      { label: 'Default Quotation Validity (hours)', type: 'number', value: '48' },
      { label: 'Auto-cancel Unquoted Orders (days)', type: 'number', value: '7' },
      { label: 'Max Items Per Order', type: 'number', value: '50' },
    ]
  },
  {
    title: 'Currency',
    icon: Settings,
    fields: [
      { label: 'Currency Symbol', type: 'text', value: 'Nu.' },
      { label: 'Decimal Places', type: 'number', value: '0' },
    ]
  },
  {
    title: 'Maintenance Mode',
    icon: Wrench,
    fields: [
      { label: 'Enable Maintenance', type: 'toggle', value: 'false' },
      { label: 'Maintenance Message', type: 'textarea', value: 'We are undergoing maintenance. Please check back soon.' },
    ]
  },
];

export default function AppSettings() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">App Settings</h2>
        <p className="text-sm text-neutral-500">Configure your application settings</p>
      </div>

      {/* Logo Upload */}
      <div className="bg-white rounded-xl p-5 shadow-card">
        <div className="flex items-center gap-3 mb-4">
          <Image size={20} className="text-neutral-500" />
          <h3 className="text-sm font-semibold text-gray-900">App Logo</h3>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-neutral-50 border border-neutral-100 flex items-center justify-center overflow-hidden">
            <Logo size="lg" showText={false} />
          </div>
          <div>
            <button className="px-4 py-2 bg-neutral-100 text-neutral-700 text-sm font-medium rounded-lg hover:bg-neutral-200 transition-colors">
              Change Logo
            </button>
            <p className="text-xs text-neutral-400 mt-1">Recommended: 512x512px, PNG</p>
          </div>
        </div>
      </div>

      {/* Settings Sections */}
      {sections.map(section => {
        const Icon = section.icon;
        return (
          <div key={section.title} className="bg-white rounded-xl shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-100 flex items-center gap-2">
              <Icon size={18} className="text-neutral-500" />
              <h3 className="text-sm font-semibold text-gray-900">{section.title}</h3>
            </div>
            <div className="p-5 space-y-4">
              {section.fields.map(field => (
                <div key={field.label}>
                  <label className="text-sm font-medium text-gray-700">{field.label}</label>
                  {field.type === 'toggle' ? (
                    <div className="mt-2">
                      <div className="w-11 h-6 bg-neutral-300 rounded-full relative cursor-pointer">
                        <div className="w-5 h-5 bg-white rounded-full shadow absolute top-0.5 left-0.5" />
                      </div>
                    </div>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      defaultValue={field.value}
                      className="w-full h-20 mt-1.5 p-3 border border-neutral-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  ) : (
                    <input
                      type={field.type}
                      defaultValue={field.value}
                      className="w-full h-10 mt-1.5 px-3 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className="flex justify-end">
        <button className="px-6 py-2.5 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-2">
          <Save size={16} />
          Save All Settings
        </button>
      </div>
    </div>
  );
}
