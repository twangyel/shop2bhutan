import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, ShoppingBag, CreditCard, Tag, Info } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { formatDistanceToNow } from 'date-fns';
import EmptyState from '@/components/shared/EmptyState';

const typeConfig: Record<string, { icon: React.ElementType; bg: string; iconColor: string }> = {
  order_update: { icon: ShoppingBag, bg: 'bg-amber-50', iconColor: 'text-amber-600' },
  quotation: { icon: ShoppingBag, bg: 'bg-violet-50', iconColor: 'text-violet-600' },
  payment: { icon: CreditCard, bg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
  promotion: { icon: Tag, bg: 'bg-pink-50', iconColor: 'text-pink-600' },
  system: { icon: Info, bg: 'bg-neutral-100', iconColor: 'text-neutral-500' },
};

export default function Notifications() {
  const navigate = useNavigate();
  const { notifications, unreadCount, markNotificationRead, markAllRead } = useApp();

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="bg-white border-b border-neutral-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-1">
              <ArrowLeft size={22} className="text-neutral-700" />
            </button>
            <h1 className="text-lg font-semibold text-gray-900">Notifications</h1>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-amber-600 font-medium"
            >
              Mark All Read
            </button>
          )}
        </div>
      </div>

      <div className="divide-y divide-neutral-100">
        {notifications.length > 0 ? (
          notifications.map(notification => {
            const config = typeConfig[notification.type] || typeConfig.system;
            const Icon = config.icon;
            return (
              <button
                key={notification.id}
                onClick={() => {
                  markNotificationRead(notification.id);
                  if (notification.link) navigate(notification.link);
                }}
                className={`w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-neutral-50 transition-colors ${
                  !notification.isRead ? 'bg-amber-50/30 border-l-[3px] border-l-amber-500' : ''
                }`}
              >
                <div className={`w-10 h-10 rounded-full ${config.bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon size={18} className={config.iconColor} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{notification.title}</p>
                  <p className="text-xs text-neutral-500 line-clamp-2 mt-0.5">{notification.message}</p>
                  <p className="text-xs text-neutral-400 mt-1">
                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                  </p>
                </div>
                {!notification.isRead && (
                  <div className="w-2 h-2 bg-amber-500 rounded-full flex-shrink-0 mt-2" />
                )}
              </button>
            );
          })
        ) : (
          <EmptyState
            icon={<Bell size={40} className="text-neutral-300" />}
            title="No notifications"
            description="You are all caught up!"
          />
        )}
      </div>
    </div>
  );
}
