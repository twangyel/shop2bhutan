import { FileText, CreditCard, ShoppingBag, Truck } from 'lucide-react';
import { appSettings } from '@/data/mockData';

const steps = [
  {
    icon: FileText,
    title: 'Get Quotation',
    desc: 'We check price & availability in India',
    color: 'from-amber-400 to-amber-500',
  },
  {
    icon: CreditCard,
    title: 'Pay Locally',
    desc: 'Pay via MBob, BPay, or Bank Transfer',
    color: 'from-emerald-400 to-emerald-500',
  },
  {
    icon: ShoppingBag,
    title: 'We Order from India',
    desc: 'We purchase and ship to Bhutan',
    color: 'from-violet-400 to-violet-500',
  },
  {
    icon: Truck,
    title: 'Collect at Hub',
    desc: `Pickup in ${appSettings.deliveryHubs.hubNamesJoined}`,
    color: 'from-blue-400 to-blue-500',
  },
];

export default function TrustProcess() {
  return (
    <div className="bg-white rounded-2xl p-4 border border-neutral-100">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-[14px] font-bold text-gray-900">Your Order Journey</h3>
      </div>
      <p className="text-[11px] text-neutral-500 mb-3.5">
        {appSettings.orderCoverage.shortLabel} &middot; Hubs: {appSettings.deliveryHubs.hubNamesJoined}
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <div
              key={step.title}
              className="relative p-3 rounded-xl bg-neutral-50 border border-neutral-100"
            >
              <span className="absolute top-2 right-2 text-[10px] font-bold text-neutral-300">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${step.color} flex items-center justify-center mb-2`}>
                <Icon size={15} className="text-white" />
              </div>
              <p className="text-[12px] font-bold text-gray-900 leading-tight">{step.title}</p>
              <p className="text-[11px] text-neutral-500 mt-0.5 leading-snug">{step.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
