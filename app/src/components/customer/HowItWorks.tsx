import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link2, FileText, CreditCard, Package, ArrowRight, ChevronDown } from 'lucide-react';

const steps = [
  {
    icon: Link2,
    title: 'Paste any product link',
    desc: 'Copy and paste a URL from Amazon.in, Flipkart, Myntra, or Meesho into the paste link field.',
    color: 'bg-amber-50 text-amber-600',
  },
  {
    icon: FileText,
    title: 'Receive your quotation',
    desc: 'Our team checks the product price, availability, and calculates delivery fees to Bhutan.',
    color: 'bg-violet-50 text-violet-600',
  },
  {
    icon: CreditCard,
    title: 'Pay via local methods',
    desc: 'Pay securely using Bank of Bhutan, MBob, or BPay. Upload your payment screenshot.',
    color: 'bg-emerald-50 text-emerald-600',
  },
  {
    icon: Package,
    title: 'Collect at your nearest hub',
    desc: 'We order from India and deliver to Thimphu, Phuntsholing, or Paro hub for pickup.',
    color: 'bg-blue-50 text-blue-600',
  },
];

export default function HowItWorks() {
  const navigate = useNavigate();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="bg-white rounded-2xl p-4 border border-neutral-100">
      <h3 className="text-[15px] font-bold text-gray-900 mb-1">How It Works</h3>
      <p className="text-xs text-neutral-500 mb-3.5">Shopping from India made simple</p>

      <div className="space-y-2">
        {steps.map((step, i) => {
          const Icon = step.icon;
          const isOpen = openIndex === i;

          return (
            <div
              key={step.title}
              className={`rounded-xl border transition-colors ${
                isOpen ? 'border-amber-200 bg-amber-50/30' : 'border-neutral-100 bg-white'
              }`}
            >
              <button
                onClick={() => setOpenIndex(isOpen ? null : i)}
                className="w-full flex items-center gap-3 p-3 text-left"
              >
                <div className={`w-8 h-8 ${step.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                  <Icon size={15} />
                </div>
                <span className="flex-1 text-[13px] font-bold text-gray-900">{step.title}</span>
                <ChevronDown
                  size={16}
                  className={`text-neutral-400 transition-transform flex-shrink-0 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isOpen && (
                <div className="px-3 pb-3 pl-14">
                  <p className="text-xs text-neutral-600 leading-relaxed">{step.desc}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={() => navigate('/paste-link')}
        className="w-full h-11 mt-3.5 bg-amber-500 text-white text-sm font-bold rounded-xl hover:bg-amber-600 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
      >
        Start Shopping Now
        <ArrowRight size={15} />
      </button>
    </div>
  );
}
