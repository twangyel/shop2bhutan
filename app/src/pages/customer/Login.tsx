import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, Mail, Lock, Eye, EyeOff, User } from 'lucide-react';
import { useApp } from '@/context/AppContext';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!email) newErrors.email = 'Email is required';
    else if (!email.includes('@')) newErrors.email = 'Invalid email format';
    if (!password) newErrors.password = 'Password is required';
    else if (password.length < 6) newErrors.password = 'Min 6 characters';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (login(email, password)) {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-amber-500 rounded-2xl flex items-center justify-center mb-4">
            <ShoppingBag size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome Back</h1>
          <p className="text-sm text-neutral-500 mt-1">Sign in to your Shop2Bhutan account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-700 uppercase tracking-wider mb-1.5">Email Address</label>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors(prev => ({ ...prev, email: '' })); }}
                placeholder="your@email.com"
                className={`w-full h-12 pl-10 pr-4 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all ${
                  errors.email ? 'border-red-400' : 'border-neutral-300'
                }`}
              />
            </div>
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 uppercase tracking-wider mb-1.5">Password</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErrors(prev => ({ ...prev, password: '' })); }}
                placeholder="Enter your password"
                className={`w-full h-12 pl-10 pr-10 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all ${
                  errors.password ? 'border-red-400' : 'border-neutral-300'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-neutral-300 text-amber-500 focus:ring-amber-500"
              />
              <span className="text-sm text-neutral-600">Remember me</span>
            </label>
            <button
              type="button"
              onClick={() => navigate('/forgot-password')}
              className="text-sm text-amber-600 font-medium"
            >
              Forgot Password?
            </button>
          </div>

          <button
            type="submit"
            className="w-full h-12 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition-colors"
          >
            Sign In
          </button>
        </form>

        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-neutral-200" />
          <span className="text-xs text-neutral-400">or</span>
          <div className="flex-1 h-px bg-neutral-200" />
        </div>

        <button
          onClick={() => navigate('/')}
          className="w-full h-11 flex items-center justify-center gap-2 bg-neutral-100 text-neutral-700 font-medium rounded-lg hover:bg-neutral-200 transition-colors"
        >
          <User size={18} />
          <span className="text-sm">Continue as Guest</span>
        </button>

        <p className="text-center text-sm text-neutral-500 mt-6">
          Don't have an account?{' '}
          <button onClick={() => navigate('/register')} className="text-amber-600 font-semibold">
            Register
          </button>
        </p>

        <p className="text-center text-xs text-neutral-400 mt-4">
          <button onClick={() => navigate('/admin')} className="underline">
            Admin Login
          </button>
        </p>
      </div>
    </div>
  );
}
