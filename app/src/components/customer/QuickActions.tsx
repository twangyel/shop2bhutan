import { useNavigate } from 'react-router-dom';
import { Link2, ClipboardList, Truck, HeadphonesIcon } from 'lucide-react';

const actions = [
  { icon: Link2, label: 'Paste Link', color: 'bg-amber-50', iconColor: 'text-amber-600', path: '/paste-link' },
  { icon: ClipboardList, label: 'My Orders', color: 'bg-violet-50', iconColor: 'text-violet-600', path: '/orders' },
  { icon: Truck, label: 'Track Order', color: 'bg-emerald-50', iconColor: 'text-emerald-600', path: '/orders' },
  { icon: HeadphonesIcon, label: 'Support', color: 'bg-blue-50', iconColor: 'text-blue-600', path: '/support' },
];

export default function QuickActions() {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-4 gap-2.5">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.label}
            onClick={() => navigate(action.path)}
            className="flex flex-col items-center gap-1.5 py-3 bg-white rounded-xl border border-neutral-100 hover:border-neutral-200 hover:shadow-sm active:scale-95 transition-all"
          >
            <div className={`w-11 h-11 ${action.color} rounded-full flex items-center justify-center`}>
              <Icon size={20} className={action.iconColor} />
            </div>
            <span className="text-[11px] font-semibold text-gray-900">{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}
