import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  ChevronDown,
  Home,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Save,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const DELIVERY_DZONGKHAGS = ['Thimphu', 'Paro', 'Chhukha'] as const;
const ADDRESS_LABELS = ['Home', 'Office', 'Family', 'Other'] as const;

type CustomerAddress = {
  id: string;
  user_id: string;
  label: string;
  recipient_name: string;
  phone: string;
  dzongkhag: string;
  town: string | null;
  gewog: string | null;
  village: string | null;
  landmark: string | null;
  address_line: string | null;
  is_default: boolean;
  created_at?: string | null;
};

type AddressForm = {
  label: string;
  recipientName: string;
  phone: string;
  dzongkhag: string;
  town: string;
  gewog: string;
  village: string;
  landmark: string;
  addressLine: string;
  isDefault: boolean;
};

const emptyForm: AddressForm = {
  label: 'Home',
  recipientName: '',
  phone: '',
  dzongkhag: '',
  town: '',
  gewog: '',
  village: '',
  landmark: '',
  addressLine: '',
  isDefault: false,
};

function normalizeBhutanPhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  const phone8 = digits.startsWith('975') ? digits.slice(3) : digits;
  if (!/^(17|77)\d{6}$/.test(phone8)) return null;
  return phone8;
}

function formatPhone(phone: string) {
  return phone ? `+975 ${phone}` : '';
}

function formFromAddress(address: CustomerAddress): AddressForm {
  return {
    label: address.label || 'Home',
    recipientName: address.recipient_name || '',
    phone: address.phone || '',
    dzongkhag: address.dzongkhag || '',
    town: address.town || '',
    gewog: address.gewog || '',
    village: address.village || '',
    landmark: address.landmark || '',
    addressLine: address.address_line || '',
    isDefault: Boolean(address.is_default),
  };
}


type ModernSelectProps = {
  label: string;
  value: string;
  placeholder?: string;
  options: readonly string[];
  onChange: (value: string) => void;
};

function ModernSelect({ label, value, placeholder = 'Select', options, onChange }: ModernSelectProps) {
  const [open, setOpen] = useState(false);
  const selectedLabel = value || '';

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <label className="mb-1.5 block text-sm font-semibold text-gray-700">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`flex h-11 w-full items-center justify-between gap-2 rounded-2xl border bg-white px-3 text-left text-sm shadow-sm outline-none transition ${
          open
            ? 'border-orange-400 ring-4 ring-orange-500/10'
            : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <span className={selectedLabel ? 'font-semibold text-gray-900' : 'text-gray-400'}>
          {selectedLabel || placeholder}
        </span>
        <ChevronDown
          size={17}
          className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180 text-orange-500' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-gray-100 bg-white p-1 shadow-2xl shadow-gray-200/80">
          {options.map((option) => {
            const selected = value === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
                className={`flex h-10 w-full items-center justify-between rounded-xl px-3 text-left text-sm font-semibold transition ${
                  selected ? 'bg-orange-50 text-orange-700' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>{option}</span>
                {selected && <Check size={16} strokeWidth={2.5} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Addresses() {
  const navigate = useNavigate();
  const { user, context } = useAuth();

  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [form, setForm] = useState<AddressForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const profile = context?.profile as { full_name?: string | null; name?: string | null; phone?: string | null } | null;
  const hasAddresses = addresses.length > 0;
  const defaultAddressId = useMemo(() => addresses.find((a) => a.is_default)?.id || null, [addresses]);

  const update = (field: keyof AddressForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError('');
    setSuccess('');
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      recipientName: profile?.full_name || profile?.name || '',
      phone: profile?.phone || '',
      isDefault: addresses.length === 0,
    });
    setShowForm(false);
    setError('');
    setSuccess('');
  };

  const loadAddresses = async () => {
    if (!user) { setAddresses([]); setLoading(false); return; }
    setLoading(true);
    const { data, error: loadError } = await supabase
      .from('customer_addresses')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    setLoading(false);
    if (loadError) { setError(loadError.message || 'Unable to load saved addresses.'); return; }
    setAddresses((data || []) as CustomerAddress[]);
  };

  useEffect(() => { void loadAddresses(); }, [user]);

  useEffect(() => {
    if (!showForm || editingId) return;
    setForm((prev) => ({
      ...prev,
      recipientName: prev.recipientName || profile?.full_name || profile?.name || '',
      phone: prev.phone || profile?.phone || '',
      isDefault: addresses.length === 0,
    }));
  }, [showForm, editingId, profile, addresses.length]);

  const openAddForm = () => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      recipientName: profile?.full_name || profile?.name || '',
      phone: profile?.phone || '',
      isDefault: addresses.length === 0,
    });
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  const openEditForm = (address: CustomerAddress) => {
    setEditingId(address.id);
    setForm(formFromAddress(address));
    setShowForm(true);
    setError('');
    setSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const validateForm = () => {
    const normalizedPhone = normalizeBhutanPhone(form.phone);
    if (!form.label.trim()) return 'Address label is required.';
    if (!form.recipientName.trim()) return 'Recipient name is required.';
    if (!form.phone.trim()) return 'Phone number is required.';
    if (!normalizedPhone) return 'Enter a valid Bhutan mobile number starting with 17 or 77.';
    if (!form.dzongkhag) return 'Please select the delivery dzongkhag.';
    if (!DELIVERY_DZONGKHAGS.includes(form.dzongkhag as (typeof DELIVERY_DZONGKHAGS)[number])) {
      return 'Delivery is currently available only in Thimphu, Paro, and Chhukha.';
    }
    if (!form.town.trim() && !form.village.trim()) {
      return 'Please add at least town/area or village/building.';
    }
    return '';
  };

  const saveAddress = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) { setError('Please sign in to save addresses.'); return; }
    const validationError = validateForm();
    const normalizedPhone = normalizeBhutanPhone(form.phone);
    if (validationError || !normalizedPhone) { setError(validationError || 'Please check your address details.'); return; }

    setSaving(true);
    setError('');
    setSuccess('');
    const shouldBeDefault = form.isDefault || addresses.length === 0;

    if (shouldBeDefault) {
      const { error: clearDefaultError } = await supabase
        .from('customer_addresses')
        .update({ is_default: false })
        .eq('user_id', user.id);
      if (clearDefaultError) { setSaving(false); setError(clearDefaultError.message || 'Unable to update default address.'); return; }
    }

    const payload = {
      user_id: user.id,
      label: form.label.trim(),
      recipient_name: form.recipientName.trim(),
      phone: normalizedPhone,
      dzongkhag: form.dzongkhag,
      town: form.town.trim() || null,
      gewog: form.gewog.trim() || null,
      village: form.village.trim() || null,
      landmark: form.landmark.trim() || null,
      address_line: form.addressLine.trim() || null,
      is_default: shouldBeDefault,
    };

    const result = editingId
      ? await supabase.from('customer_addresses').update(payload).eq('id', editingId).eq('user_id', user.id)
      : await supabase.from('customer_addresses').insert(payload);

    setSaving(false);
    if (result.error) { setError(result.error.message || 'Unable to save address.'); return; }

    setSuccess(editingId ? 'Address updated successfully.' : 'Address added successfully.');
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    await loadAddresses();
  };

  const setDefaultAddress = async (id: string) => {
    if (!user || defaultAddressId === id) return;
    setError('');
    setSuccess('');
    const { error: clearError } = await supabase
      .from('customer_addresses')
      .update({ is_default: false })
      .eq('user_id', user.id);
    if (clearError) { setError(clearError.message || 'Unable to update default address.'); return; }
    const { error: setErrorResult } = await supabase
      .from('customer_addresses')
      .update({ is_default: true })
      .eq('id', id)
      .eq('user_id', user.id);
    if (setErrorResult) { setError(setErrorResult.message || 'Unable to update default address.'); return; }
    setSuccess('Default address updated.');
    await loadAddresses();
  };

  const deleteAddress = async (address: CustomerAddress) => {
    if (!user) return;
    const confirmed = window.confirm('Delete this saved address?');
    if (!confirmed) return;
    const { error: deleteError } = await supabase
      .from('customer_addresses')
      .delete()
      .eq('id', address.id)
      .eq('user_id', user.id);
    if (deleteError) { setError(deleteError.message || 'Unable to delete address.'); return; }
    setSuccess('Address deleted.');
    await loadAddresses();
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-white px-4 py-8">
        <div className="mx-auto max-w-md rounded-2xl border border-gray-100 bg-white p-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50">
            <MapPin size={26} className="text-orange-500" />
          </div>
          <h1 className="mb-2 text-xl font-bold text-gray-900">Sign in required</h1>
          <p className="mb-5 text-sm text-gray-500">Please sign in to manage your delivery addresses.</p>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="h-12 w-full rounded-2xl bg-orange-500 font-bold text-white hover:bg-orange-600"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="sticky top-0 z-20 border-b border-gray-100 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Saved Addresses</h1>
            <p className="text-xs text-gray-500">Manage your delivery locations</p>
          </div>
          <button
            type="button"
            onClick={showForm ? resetForm : openAddForm}
            className="flex h-10 items-center gap-1.5 rounded-2xl bg-orange-500 px-3 text-sm font-bold text-white hover:bg-orange-600"
          >
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? 'Close' : 'Add'}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 py-4">
        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <Check size={16} strokeWidth={2.5} />
            {success}
          </div>
        )}

        {showForm && (
          <form onSubmit={saveAddress} className="mb-4 space-y-4 rounded-2xl border border-gray-100 bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900">{editingId ? 'Edit Address' : 'Add Address'}</h2>
                <p className="text-xs text-gray-500">Save a delivery location for faster checkout.</p>
              </div>
              <Home size={22} className="text-orange-500" strokeWidth={2} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <ModernSelect
                label="Label"
                value={form.label}
                options={ADDRESS_LABELS}
                onChange={(value) => update('label', value)}
              />
              <ModernSelect
                label="Dzongkhag"
                value={form.dzongkhag}
                placeholder="Select"
                options={DELIVERY_DZONGKHAGS}
                onChange={(value) => update('dzongkhag', value)}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">Recipient name</label>
              <input
                type="text"
                value={form.recipientName}
                onChange={(event) => update('recipientName', event.target.value)}
                placeholder="Full name"
                className="h-11 w-full rounded-2xl border border-gray-200 px-3 text-sm outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(event) => update('phone', event.target.value)}
                placeholder="17123456"
                className="h-11 w-full rounded-2xl border border-gray-200 px-3 text-sm outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">Town / Area</label>
              <input
                type="text"
                value={form.town}
                onChange={(event) => update('town', event.target.value)}
                placeholder="Town / Area"
                className="h-11 w-full rounded-2xl border border-gray-200 px-3 text-sm outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">Village / Building</label>
              <input
                type="text"
                value={form.village}
                onChange={(event) => update('village', event.target.value)}
                placeholder="Village, building, or apartment"
                className="h-11 w-full rounded-2xl border border-gray-200 px-3 text-sm outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">Landmark (optional)</label>
              <input
                type="text"
                value={form.landmark}
                onChange={(event) => update('landmark', event.target.value)}
                placeholder="Nearby landmark"
                className="h-11 w-full rounded-2xl border border-gray-200 px-3 text-sm outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">Address details (optional)</label>
              <textarea
                value={form.addressLine}
                onChange={(event) => update('addressLine', event.target.value)}
                placeholder="Flat number, road, shop name, or delivery note"
                rows={3}
                className="w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
              />
            </div>

            <label className="flex items-center gap-2 rounded-2xl bg-gray-50 p-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(event) => update('isDefault', event.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
              />
              Make this my default address
            </label>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={resetForm}
                className="h-12 rounded-2xl bg-gray-100 font-bold text-gray-700 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-orange-500 font-bold text-white hover:bg-orange-600 disabled:opacity-60"
              >
                {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} strokeWidth={2.5} />}
                Save
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            <Loader2 size={22} className="mr-2 animate-spin" /> Loading addresses...
          </div>
        ) : !hasAddresses ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50">
              <MapPin size={25} className="text-orange-500" strokeWidth={2} />
            </div>
            <h2 className="text-lg font-bold text-gray-900">No saved addresses yet</h2>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-gray-500">
              Add a delivery address in Thimphu, Paro, or Chhukha to make checkout faster.
            </p>
            <button
              type="button"
              onClick={openAddForm}
              className="mt-5 h-12 rounded-2xl bg-orange-500 px-6 font-bold text-white hover:bg-orange-600"
            >
              Add Address
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {addresses.map((address) => (
              <div key={address.id} className="rounded-2xl border border-gray-100 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-orange-700">
                        {address.label}
                      </span>
                      {address.is_default && (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                          Default
                        </span>
                      )}
                    </div>

                    <p className="mt-3 text-sm font-bold text-gray-900">{address.recipient_name}</p>
                    <p className="text-xs font-medium text-gray-500">{formatPhone(address.phone)}</p>
                    <p className="mt-2 text-sm leading-5 text-gray-700">
                      {[address.village, address.town, address.dzongkhag].filter(Boolean).join(', ')}
                    </p>
                    {address.address_line && <p className="mt-1 text-xs leading-5 text-gray-500">{address.address_line}</p>}
                    {address.landmark && <p className="mt-1 text-xs text-gray-400">Landmark: {address.landmark}</p>}
                  </div>

                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => openEditForm(address)}
                      className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gray-50 text-gray-500 hover:bg-gray-100"
                      aria-label="Edit address"
                    >
                      <Pencil size={16} strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteAddress(address)}
                      className="flex h-9 w-9 items-center justify-center rounded-2xl bg-red-50 text-red-500 hover:bg-red-100"
                      aria-label="Delete address"
                    >
                      <Trash2 size={16} strokeWidth={2} />
                    </button>
                  </div>
                </div>

                {!address.is_default && (
                  <button
                    type="button"
                    onClick={() => void setDefaultAddress(address.id)}
                    className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white text-sm font-bold text-gray-700 hover:bg-gray-50"
                  >
                    <Star size={15} strokeWidth={2} />
                    Set as Default
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
