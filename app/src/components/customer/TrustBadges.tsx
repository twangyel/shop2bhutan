import { ShieldCheck, Truck, HeadphonesIcon } from 'lucide-react';

const badges = [
  { icon: ShieldCheck, label: 'Secure Payment' },
  { icon: Truck, label: 'Orders from All 20 Dzongkhags' },
  { icon: HeadphonesIcon, label: 'Customer Support' },
];

export default function TrustBadges() {
  return (
    <div className="flex items-center justify-center gap-4 py-3">
      {badges.map((badge) => {
        const Icon = badge.icon;
        return (
          <div key={badge.label} className="flex items-center gap-1">
            <Icon size={13} className="text-emerald-500" />
            <span className="text-[10px] font-semibold text-neutral-500">{badge.label}</span>
          </div>
        );
      })}
    </div>
  );
}
