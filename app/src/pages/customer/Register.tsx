import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Phone, MapPin, Lock, Eye, EyeOff } from 'lucide-react';
import { DZONGKHAGS } from '@/data/mockData';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', email: '', phone: '', dzongkhag: '', password: '', confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!form.name) newErrors.name = 'Name is required';
    if (!form.email) newErrors.email = 'Email is required';
    else if (!form.email.includes('@')) newErrors.email = 'Invalid email';
    if (!form.phone) newErrors.phone = 'Phone is required';
    if (!form.dzongkhag) newErrors.dzongkhag = 'Select your dzongkhag';
    if (!form.password) newErrors.password = 'Password is required';
    else if (form.password.length < 6) newErrors.password = 'Min 6 characters';
    if (form.password !== form.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    if (!agreed) newErrors.agreed = 'You must agree to the terms';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-white py-8 px-6">
      <div className="max-w-sm mx-auto">
        <button onClick={() => navigate('/login')} className="text-sm text-neutral-500 mb-4">← Back to Login</button>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Create Account</h1>
        <p className="text-sm text-neutral-500 mb-6">Join Shop2Bhutan to start shopping</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-700 uppercase tracking-wider mb-1.5">Full Name</label>
            <div className="relative">
              <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input type="text" value={form.name} onChange={e => update('name', e.target.value)}
                placeholder="Your full name" className="w-full h-12 pl-10 pr-4 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20" />
            </div>
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 uppercase tracking-wider mb-1.5">Email Address</label>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input type="email" value={form.email} onChange={e => update('email', e.target.value)}
                placeholder="your@email.com" className="w-full h-12 pl-10 pr-4 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20" />
            </div>
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 uppercase tracking-wider mb-1.5">Phone Number</label>
            <div className="relative">
              <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)}
                placeholder="+975 XXXXXXXX" className="w-full h-12 pl-10 pr-4 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20" />
            </div>
            {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 uppercase tracking-wider mb-1.5">Dzongkhag</label>
            <div className="relative">
              <MapPin size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <select value={form.dzongkhag} onChange={e => update('dzongkhag', e.target.value)}
                className="w-full h-12 pl-10 pr-4 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 appearance-none bg-white">
                <option value="">Select dzongkhag</option>
                {DZONGKHAGS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            {errors.dzongkhag && <p className="text-xs text-red-500 mt-1">{errors.dzongkhag}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 uppercase tracking-wider mb-1.5">Password</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => update('password', e.target.value)}
                placeholder="Min 6 characters" className="w-full h-12 pl-10 pr-10 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 uppercase tracking-wider mb-1.5">Confirm Password</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input type={showPassword ? 'text' : 'password'} value={form.confirmPassword} onChange={e => update('confirmPassword', e.target.value)}
                placeholder="Confirm password" className="w-full h-12 pl-10 pr-4 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20" />
            </div>
            {errors.confirmPassword && <p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>}
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded border-neutral-300 text-amber-500 focus:ring-amber-500" />
            <span className="text-sm text-neutral-600">
              I agree to the <button type="button" className="text-amber-600 font-medium">Terms of Service</button> and{' '}
              <button type="button" className="text-amber-600 font-medium">Privacy Policy</button>
            </span>
          </label>
          {errors.agreed && <p className="text-xs text-red-500">{errors.agreed}</p>}

          <button type="submit" className="w-full h-12 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition-colors">
            Create Account
          </button>
        </form>

        <p className="text-center text-sm text-neutral-500 mt-6">
          Already have an account?{' '}
          <button onClick={() => navigate('/login')} className="text-amber-600 font-semibold">Sign In</button>
        </p>
      </div>
    </div>
  );
}
