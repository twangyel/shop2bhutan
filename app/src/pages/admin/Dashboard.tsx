import { useNavigate } from 'react-router-dom';
import {
  ClipboardList, FileText, TrendingUp, Users,
  ArrowUpRight, ArrowDownRight, Eye
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { dashboardStats, revenueData, orderStatusCounts, topProducts, orders } from '@/data/mockData';
import StatusBadge from '@/components/shared/StatusBadge';

const statCards = [
  {
    title: 'Total Orders', value: dashboardStats.totalOrders.toLocaleString(),
    change: `+${dashboardStats.totalOrdersChange}%`, positive: true,
    icon: ClipboardList, accent: 'bg-amber-50 text-amber-600'
  },
  {
    title: 'Pending Quotations', value: dashboardStats.pendingQuotations.toString(),
    change: 'Needs attention', positive: null,
    icon: FileText, accent: 'bg-orange-50 text-orange-600'
  },
  {
    title: 'Revenue (Nu.)', value: `Nu. ${(dashboardStats.revenue / 100000).toFixed(1)}L`,
    change: `+${dashboardStats.revenueChange}%`, positive: true,
    icon: TrendingUp, accent: 'bg-emerald-50 text-emerald-600'
  },
  {
    title: 'Active Customers', value: dashboardStats.activeCustomers.toLocaleString(),
    change: `+${dashboardStats.newCustomers} new`, positive: true,
    icon: Users, accent: 'bg-blue-50 text-blue-600'
  },
];

const PERIODS = ['7 Days', '30 Days', 'This Month'];

export default function Dashboard() {
  const navigate = useNavigate();
  const recentOrders = orders.slice(0, 8);
  const pieData = orderStatusCounts.filter(s => s.count > 0).slice(0, 6);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
        {statCards.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="bg-white rounded-xl p-4 md:p-5 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-neutral-500">{card.title}</p>
                  <p className="text-xl md:text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
                  {card.positive !== null && (
                    <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${
                      card.positive ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {card.positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      {card.change}
                    </div>
                  )}
                  {card.positive === null && (
                    <p className="text-xs text-orange-600 font-medium mt-1">{card.change}</p>
                  )}
                </div>
                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl ${card.accent} flex items-center justify-center shrink-0`}>
                  <Icon size={20} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl p-4 md:p-5 shadow-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h3 className="text-base font-semibold text-gray-900">Revenue (Nu.) Overview</h3>
            <div className="flex gap-1 flex-wrap">
              {PERIODS.map(period => (
                <button
                  key={period}
                  className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
                    period === '7 Days' ? 'bg-amber-500 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>
          <div className="h-56 md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false}
                  tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number) => [`Nu. ${value.toLocaleString()}`, 'Revenue (Nu.)']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="amount" stroke="#F59E0B" strokeWidth={2} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Order Status Distribution */}
        <div className="bg-white rounded-xl p-4 md:p-5 shadow-card">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Orders by Status</h3>
          <div className="h-44 md:h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={2}
                  dataKey="count"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [value, 'Orders']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-1.5">
            {pieData.slice(0, 4).map(item => (
              <div key={item.status} className="flex items-center gap-2 text-xs">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-neutral-600 flex-1 capitalize">{item.status.replace(/_/g, ' ')}</span>
                <span className="font-medium">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Orders + Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
        {/* Recent Orders */}
        <div className="bg-white rounded-xl p-4 md:p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900">Recent Orders</h3>
            <button onClick={() => navigate('/admin/orders')} className="text-xs text-amber-600 font-medium whitespace-nowrap">
              View All →
            </button>
          </div>
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full min-w-[480px]">
              <thead>
                <tr className="text-left border-b border-neutral-100">
                  <th className="pb-2 text-xs font-medium text-neutral-500 uppercase tracking-wider">Order</th>
                  <th className="pb-2 text-xs font-medium text-neutral-500 uppercase tracking-wider">Customer</th>
                  <th className="pb-2 text-xs font-medium text-neutral-500 uppercase tracking-wider">Status</th>
                  <th className="pb-2 text-xs font-medium text-neutral-500 uppercase tracking-wider">Total</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map(order => (
                  <tr key={order.id} className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50 transition-colors">
                    <td className="py-3 text-sm font-medium text-gray-900">#{order.orderNumber}</td>
                    <td className="py-3 text-sm text-neutral-600">{order.user.name}</td>
                    <td className="py-3"><StatusBadge status={order.status} size="sm" /></td>
                    <td className="py-3 text-sm font-medium">Nu. {order.quotation?.totalAmount?.toLocaleString() || '-'}</td>
                    <td className="py-3">
                      <button
                        onClick={() => navigate(`/admin/orders/${order.id}`)}
                        className="p-1.5 text-neutral-400 hover:text-amber-600 transition-colors"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white rounded-xl p-4 md:p-5 shadow-card">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Top Selling Products</h3>
          <div className="space-y-3">
            {topProducts.map((product, i) => {
              const maxRevenue = topProducts[0].revenue;
              return (
                <div key={product.id} className="flex items-center gap-3">
                  <span className="w-5 text-xs font-bold text-neutral-400 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full"
                          style={{ width: `${(product.revenue / maxRevenue) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-medium">{product.unitsSold} sold</p>
                    <p className="text-xs text-neutral-500">Nu. {(product.revenue / 1000).toFixed(1)}k</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
