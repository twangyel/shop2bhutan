import { useState } from 'react';
import { Plus, Pencil, Trash2, ChevronDown, Save } from 'lucide-react';
import { faqs } from '@/data/mockData';

const contentTabs = [
  { key: 'faq', label: 'FAQ' },
  { key: 'terms', label: 'Terms of Service' },
  { key: 'privacy', label: 'Privacy Policy' },
  { key: 'returns', label: 'Return Policy' },
];

export default function FAQCMS() {
  const [activeTab, setActiveTab] = useState('faq');
  const [faqList, setFaqList] = useState(faqs);
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [newCategory, setNewCategory] = useState('Ordering');

  const categories = ['Ordering', 'Payment', 'Delivery', 'Returns'];

  const removeFaq = (id: string) => {
    setFaqList(prev => prev.filter(f => f.id !== id));
  };

  const addFaq = () => {
    if (!newQuestion.trim() || !newAnswer.trim()) return;
    setFaqList(prev => [...prev, {
      id: `faq-${Date.now()}`,
      category: newCategory,
      question: newQuestion,
      answer: newAnswer,
      sortOrder: prev.length + 1,
    }]);
    setNewQuestion('');
    setNewAnswer('');
    setShowAddForm(false);
  };

  if (activeTab !== 'faq') {
    return (
      <div className="space-y-4 max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Content Management</h2>
            <p className="text-sm text-neutral-500">Manage FAQ, Terms, Privacy, and Return policies</p>
          </div>
        </div>

        <div className="flex gap-1 bg-white rounded-xl p-1 shadow-card w-fit">
          {contentTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab.key ? 'bg-amber-500 text-white' : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">{contentTabs.find(t => t.key === activeTab)?.label}</h3>
            <p className="text-xs text-neutral-400">Last updated: Jan 15, 2026</p>
          </div>
          <textarea
            className="w-full h-96 p-4 border border-neutral-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/20 leading-relaxed"
            defaultValue={`${contentTabs.find(t => t.key === activeTab)?.label} content goes here...\n\n1. Introduction\n\nWelcome to Shop2Bhutan. By using our services, you agree to these terms.\n\n2. Ordering Process\n\nCustomers can browse our catalog or paste links from supported platforms.\n\n3. Payment\n\nAll payments must be made via supported methods and verified before processing.\n\n4. Delivery\n\nOrders are delivered to designated pickup hubs across Bhutan.`}
          />
          <div className="flex justify-end gap-3 mt-4">
            <button className="px-4 py-2 bg-neutral-100 text-neutral-700 text-sm font-medium rounded-lg hover:bg-neutral-200 transition-colors">
              Preview
            </button>
            <button className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-2">
              <Save size={14} />
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Content Management</h2>
          <p className="text-sm text-neutral-500">Manage FAQ, Terms, Privacy, and Return policies</p>
        </div>
      </div>

      <div className="flex gap-1 bg-white rounded-xl p-1 shadow-card w-fit">
        {contentTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === tab.key ? 'bg-amber-500 text-white' : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Add FAQ */}
      <button
        onClick={() => setShowAddForm(!showAddForm)}
        className="w-full py-3 border-2 border-dashed border-neutral-300 rounded-xl text-sm font-medium text-neutral-600 hover:border-amber-500 hover:text-amber-600 transition-colors flex items-center justify-center gap-2"
      >
        <Plus size={16} />
        Add FAQ
      </button>

      {showAddForm && (
        <div className="bg-white rounded-xl p-5 shadow-card space-y-3">
          <div>
            <label className="text-xs font-medium text-neutral-500 uppercase">Category</label>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="w-full h-10 mt-1 px-3 border border-neutral-200 rounded-lg text-sm bg-white"
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-500 uppercase">Question</label>
            <input
              type="text"
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="Enter question"
              className="w-full h-10 mt-1 px-3 border border-neutral-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-500 uppercase">Answer</label>
            <textarea
              value={newAnswer}
              onChange={(e) => setNewAnswer(e.target.value)}
              placeholder="Enter answer"
              className="w-full h-20 mt-1 p-3 border border-neutral-200 rounded-lg text-sm resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowAddForm(false)} className="px-4 py-2 bg-neutral-100 text-neutral-700 text-sm font-medium rounded-lg">Cancel</button>
            <button onClick={addFaq} className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors">Add FAQ</button>
          </div>
        </div>
      )}

      {/* FAQ List */}
      <div className="space-y-2">
        {categories.map(category => {
          const catFaqs = faqList.filter(f => f.category === category);
          if (catFaqs.length === 0) return null;
          return (
            <div key={category} className="bg-white rounded-xl shadow-card overflow-hidden">
              <div className="px-5 py-3 bg-neutral-50 border-b border-neutral-100">
                <h4 className="text-sm font-semibold text-gray-900">{category}</h4>
              </div>
              <div className="divide-y divide-neutral-100">
                {catFaqs.map(faq => (
                  <div key={faq.id}>
                    <div className="flex items-center justify-between px-5 py-3">
                      <button
                        onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                        className="flex-1 text-left flex items-center gap-2"
                      >
                        <span className="text-sm font-medium text-gray-900">{faq.question}</span>
                        <ChevronDown size={16} className={`text-neutral-400 transition-transform ${expandedFaq === faq.id ? 'rotate-180' : ''}`} />
                      </button>
                      <div className="flex gap-1 ml-2">
                        <button className="p-1.5 text-neutral-400 hover:text-amber-600 transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => removeFaq(faq.id)}
                          className="p-1.5 text-neutral-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {expandedFaq === faq.id && (
                      <div className="px-5 pb-3">
                        <p className="text-sm text-neutral-600">{faq.answer}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
