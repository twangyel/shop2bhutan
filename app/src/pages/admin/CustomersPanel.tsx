import { useState } from 'react';
import { Eye, Search } from 'lucide-react';

interface CustomerData {
  id: string;
  name: string;
  email: string;
  phone: string;
  dzongkhag: string;
  orders: number;
  totalSpent: number;
  joined: string;
}

const customers: CustomerData[] = [
  { id: 'u1', name: 'Karma Dorji', email: 'karma.dorji@email.com', phone: '+975 17123456', dzongkhag: 'Thimphu', orders: 12, totalSpent: 45200, joined: '2025-01-15' },
  { id: 'u2', name: 'Pema Wangmo', email: 'pema.w@email.com', phone: '+975 17234567', dzongkhag: 'Paro', orders: 8, totalSpent: 28400, joined: '2025-03-20' },
  { id: 'u3', name: 'Tenzin Dorji', email: 'tenzin.d@email.com', phone: '+975 17345678', dzongkhag: 'Punakha', orders: 15, totalSpent: 67800, joined: '2024-11-05' },
  { id: 'u4', name: 'Sonam Choden', email: 'sonam.c@email.com', phone: '+975 17456789', dzongkhag: 'Wangdue Phodrang', orders: 5, totalSpent: 15200, joined: '2025-06-10' },
  { id: 'u5', name: 'Dorji Tamang', email: 'dorji.t@email.com', phone: '+975 17567890', dzongkhag: 'Chhukha', orders: 20, totalSpent: 89300, joined: '2024-08-22' },
  { id: 'u6', name: 'Lhamo Yangzom', email: 'lhamo.y@email.com', phone: '+975 17678901', dzongkhag: 'Thimphu', orders: 3, totalSpent: 7800, joined: '2025-09-01' },
  { id: 'u7', name: 'Ugyen Tshering', email: 'ugyen.t@email.com', phone: '+975 17789012', dzongkhag: 'Mongar', orders: 7, totalSpent: 32100, joined: '2025-04-15' },
  { id: 'u8', name: 'Tshering Wangdi', email: 'tshering.w@email.com', phone: '+975 17890123', dzongkhag: 'Trashigang', orders: 10, totalSpent: 41500, joined: '2025-02-28' },
];

export default function CustomersPanel() {
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = customers.filter(c =>
    !searchQuery ||
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Customers</h2>
          <p className="text-sm text-neutral-500">{customers.length} registered customers</p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-card">
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customers..."
            className="w-full h-9 pl-9 pr-4 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Dzongkhag</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Orders</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Total Spent</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Joined</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(customer => (
                <tr key={customer.id} className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-700 font-bold text-xs">
                        {customer.name.charAt(0)}
                      </div>
                      <span className="text-sm font-medium">{customer.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-600">
                    <p>{customer.email}</p>
                    <p>{customer.phone}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{customer.dzongkhag}</td>
                  <td className="px-4 py-3 text-sm font-medium">{customer.orders}</td>
                  <td className="px-4 py-3 text-sm font-medium">Nu. {customer.totalSpent.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-neutral-500">{new Date(customer.joined).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <button className="p-1.5 text-neutral-400 hover:text-amber-600 transition-colors">
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
