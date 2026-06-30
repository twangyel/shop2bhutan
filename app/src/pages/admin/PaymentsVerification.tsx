import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Eye, Copy } from 'lucide-react';
import { orders } from '@/data/mockData';

const tabs = ['Pending Review', 'Verified', 'Rejected', 'All'];

export default function PaymentsVerification() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Pending Review');
  const [payments, setPayments] = useState(
    orders.filter(o => o.payment).map(o => ({
      ...o.payment!,
      orderNumber: o.orderNumber,
      orderId: o.id,
    }))
  );

  const filtered = payments.filter(p => {
    if (activeTab === 'All') return true;
    if (activeTab === 'Pending Review') return p.status === 'pending';
    if (activeTab === 'Verified') return p.status === 'verified';
    if (activeTab === 'Rejected') return p.status === 'rejected';
    return true;
  });

  const stats = {
    pending: payments.filter(p => p.status === 'pending').length,
    verified: payments.filter(p => p.status === 'verified').length,
    rejected: payments.filter(p => p.status === 'rejected').length,
  };

  const handleVerify = (id: string) => {
    setPayments(prev => prev.map(p => p.id === id ? { ...p, status: 'verified' as const } : p));
  };

  const handleReject = (id: string) => {
    setPayments(prev => prev.map(p => p.id === id ? { ...p, status: 'rejected' as const } : p));
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pending', value: stats.pending, color: 'bg-orange-50 text-orange-600' },
          { label: 'Verified Today', value: stats.verified, color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Rejected', value: stats.rejected, color: 'bg-red-50 text-red-600' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl p-4 shadow-card">
            <p className="text-xs text-neutral-500">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.color.split(' ')[1]}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl p-1 shadow-card w-fit">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === tab ? 'bg-amber-500 text-white' : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Payments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(payment => (
          <div key={payment.id} className="bg-white rounded-xl p-5 shadow-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-neutral-500">#{payment.orderNumber}</span>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                payment.status === 'verified' ? 'bg-emerald-50 text-emerald-600' :
                payment.status === 'rejected' ? 'bg-red-50 text-red-600' :
                'bg-orange-50 text-orange-600'
              }`}>
                {payment.status === 'pending' ? 'Pending' : payment.status === 'verified' ? 'Verified' : 'Rejected'}
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900">Nu. {payment.amount.toLocaleString()}</p>
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-500">Method</span>
                <span className="font-medium">{payment.method}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-500">Transaction ID</span>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-xs">{payment.transactionId}</span>
                  <button className="p-0.5 text-neutral-400 hover:text-amber-600">
                    <Copy size={12} />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-500">Date</span>
                <span>{new Date(payment.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            {payment.status === 'pending' && (
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handleVerify(payment.id)}
                  className="flex-1 h-9 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 transition-colors flex items-center justify-center gap-1"
                >
                  <CheckCircle size={14} />
                  Verify
                </button>
                <button
                  onClick={() => handleReject(payment.id)}
                  className="flex-1 h-9 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center gap-1"
                >
                  <XCircle size={14} />
                  Reject
                </button>
              </div>
            )}
            <button
              onClick={() => navigate(`/admin/orders/${payment.orderId}`)}
              className="w-full mt-2 h-9 border border-neutral-200 text-neutral-700 text-sm font-medium rounded-lg hover:bg-neutral-50 transition-colors flex items-center justify-center gap-1"
            >
              <Eye size={14} />
              View Order
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
