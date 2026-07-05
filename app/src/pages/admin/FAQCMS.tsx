import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Eye,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import {
  createFaqItem,
  deleteFaqItem,
  fetchAdminContentPage,
  fetchAdminFaqItems,
  getDefaultContentPage,
  saveContentPage,
  updateFaqItem,
  type ContentPageRecord,
  type ContentPageSlug,
  type FAQItemRecord,
} from '@/lib/contentPages';

type ContentTabKey = 'faq' | ContentPageSlug;

type FaqFormState = {
  id?: string;
  category: string;
  question: string;
  answer: string;
  sortOrder: number;
  isActive: boolean;
};

const contentTabs: { key: ContentTabKey; label: string }[] = [
  { key: 'faq', label: 'FAQ' },
  { key: 'terms', label: 'Terms of Service' },
  { key: 'privacy', label: 'Privacy Policy' },
  { key: 'returns', label: 'Return Policy' },
];

const defaultCategories = ['Ordering', 'Payment', 'Delivery', 'Returns', 'Account', 'Parcel'];

const emptyFaqForm: FaqFormState = {
  category: 'Ordering',
  question: '',
  answer: '',
  sortOrder: 0,
  isActive: true,
};

function formatDateTime(value?: string) {
  if (!value) return 'Not saved yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not saved yet';

  return `${date.toLocaleString('en-GB', {
    timeZone: 'Asia/Thimphu',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })} BTT`;
}

function tabLabel(key: ContentTabKey) {
  return contentTabs.find((tab) => tab.key === key)?.label ?? 'Content';
}

export default function FAQCMS() {
  const [activeTab, setActiveTab] = useState<ContentTabKey>('faq');
  const [faqList, setFaqList] = useState<FAQItemRecord[]>([]);
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [faqForm, setFaqForm] = useState<FaqFormState>(emptyFaqForm);
  const [pageDraft, setPageDraft] = useState<ContentPageRecord>(getDefaultContentPage('terms'));
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const categories = useMemo(() => {
    const values = new Set(defaultCategories);
    faqList.forEach((faq) => {
      if (faq.category) values.add(faq.category);
    });
    return Array.from(values);
  }, [faqList]);

  const groupedFaqs = useMemo(() => {
    return categories
      .map((category) => ({
        category,
        items: faqList
          .filter((faq) => faq.category === category)
          .sort((a, b) => a.sortOrder - b.sortOrder || a.question.localeCompare(b.question)),
      }))
      .filter((group) => group.items.length > 0);
  }, [categories, faqList]);

  const loadFaqs = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const items = await fetchAdminFaqItems();
      setFaqList(items);
    } catch (err) {
      console.error('[FAQCMS] FAQ load failed:', err);
      setError(err instanceof Error ? err.message : 'Unable to load FAQs.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadContentPage = useCallback(async (slug: ContentPageSlug) => {
    setLoading(true);
    setError('');
    setPreviewOpen(false);

    try {
      const page = await fetchAdminContentPage(slug);
      setPageDraft(page);
    } catch (err) {
      console.error('[FAQCMS] content page load failed:', err);
      setPageDraft(getDefaultContentPage(slug));
      setError(err instanceof Error ? err.message : 'Unable to load content page.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'faq') {
      void loadFaqs();
      return;
    }

    void loadContentPage(activeTab);
  }, [activeTab, loadContentPage, loadFaqs]);

  function resetFaqForm() {
    setFaqForm({
      ...emptyFaqForm,
      sortOrder: faqList.length + 1,
    });
    setShowAddForm(false);
  }

  function startAddFaq() {
    setError('');
    setSuccess('');
    setFaqForm({
      ...emptyFaqForm,
      sortOrder: faqList.length + 1,
    });
    setShowAddForm(true);
  }

  function startEditFaq(faq: FAQItemRecord) {
    setError('');
    setSuccess('');
    setExpandedFaq(faq.id);
    setFaqForm({
      id: faq.id,
      category: faq.category,
      question: faq.question,
      answer: faq.answer,
      sortOrder: faq.sortOrder,
      isActive: faq.isActive,
    });
    setShowAddForm(true);
  }

  async function saveFaq() {
    if (!faqForm.question.trim() || !faqForm.answer.trim()) {
      setError('Question and answer are required.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (faqForm.id) {
        await updateFaqItem(faqForm.id, faqForm);
        setSuccess('FAQ updated successfully.');
      } else {
        await createFaqItem(faqForm);
        setSuccess('FAQ added successfully.');
      }

      resetFaqForm();
      await loadFaqs();
      window.dispatchEvent(new CustomEvent('shop2bhutan:content-updated'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save FAQ.');
    } finally {
      setSaving(false);
    }
  }

  async function removeFaq(faq: FAQItemRecord) {
    const confirmed = window.confirm(`Delete this FAQ?\n\n${faq.question}`);
    if (!confirmed) return;

    setDeletingId(faq.id);
    setError('');
    setSuccess('');

    try {
      await deleteFaqItem(faq.id);
      setSuccess('FAQ deleted successfully.');
      await loadFaqs();
      window.dispatchEvent(new CustomEvent('shop2bhutan:content-updated'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete FAQ.');
    } finally {
      setDeletingId('');
    }
  }

  async function savePage() {
    if (activeTab === 'faq') return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await saveContentPage(pageDraft);
      setSuccess(`${pageDraft.title || tabLabel(activeTab)} saved successfully.`);
      await loadContentPage(activeTab);
      window.dispatchEvent(new CustomEvent('shop2bhutan:content-updated'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save content page.');
    } finally {
      setSaving(false);
    }
  }

  const header = (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Content Management</h2>
          <p className="text-sm text-neutral-500">
            Manage customer FAQ, Terms, Privacy, and Return policies.
          </p>
        </div>

        <button
          type="button"
          onClick={() => activeTab === 'faq' ? void loadFaqs() : void loadContentPage(activeTab)}
          disabled={loading}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-bold text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          Refresh
        </button>
      </div>

      <div className="flex w-fit flex-wrap gap-1 rounded-xl bg-white p-1 shadow-card">
        {contentTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setActiveTab(tab.key);
              setError('');
              setSuccess('');
              setShowAddForm(false);
            }}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-amber-500 text-white'
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={17} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}
    </>
  );

  if (activeTab !== 'faq') {
    return (
      <div className="max-w-3xl space-y-4">
        {header}

        <div className="rounded-xl bg-white p-5 shadow-card">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{tabLabel(activeTab)}</h3>
              <p className="text-xs text-neutral-400">Last updated: {formatDateTime(pageDraft.updatedAt)}</p>
            </div>

            <label className="inline-flex items-center gap-2 text-xs font-bold text-neutral-600">
              <input
                type="checkbox"
                checked={pageDraft.isPublished}
                onChange={(event) => setPageDraft((current) => ({ ...current, isPublished: event.target.checked }))}
                className="h-4 w-4 rounded border-neutral-300 text-amber-500 focus:ring-amber-500"
              />
              Published
            </label>
          </div>

          {loading ? (
            <div className="flex h-64 items-center justify-center gap-2 text-sm text-neutral-500">
              <Loader2 size={18} className="animate-spin text-amber-500" />
              Loading content...
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Page Title
                </label>
                <input
                  type="text"
                  value={pageDraft.title}
                  onChange={(event) => setPageDraft((current) => ({ ...current, title: event.target.value }))}
                  className="h-11 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-sm outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-500/10"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Content
                </label>
                <textarea
                  value={pageDraft.content}
                  onChange={(event) => setPageDraft((current) => ({ ...current, content: event.target.value }))}
                  className="h-96 w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm leading-relaxed outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-500/10"
                />
              </div>

              {previewOpen && (
                <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-neutral-400">Preview</p>
                  <h3 className="text-lg font-bold text-neutral-900">{pageDraft.title}</h3>
                  <div className="mt-3 space-y-3 text-sm leading-relaxed text-neutral-600">
                    {pageDraft.content.split('\n').map((line, index) => (
                      line.trim() ? <p key={`${line}-${index}`}>{line}</p> : <div key={`gap-${index}`} className="h-1" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setPreviewOpen((current) => !current)}
              className="inline-flex items-center gap-2 rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-200"
            >
              <Eye size={14} />
              {previewOpen ? 'Hide Preview' : 'Preview'}
            </button>
            <button
              type="button"
              onClick={() => void savePage()}
              disabled={saving || loading}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-4">
      {header}

      <button
        type="button"
        onClick={showAddForm ? resetFaqForm : startAddFaq}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 py-3 text-sm font-medium text-neutral-600 transition-colors hover:border-amber-500 hover:text-amber-600"
      >
        {showAddForm ? <X size={16} /> : <Plus size={16} />}
        {showAddForm ? 'Close FAQ Form' : 'Add FAQ'}
      </button>

      {showAddForm && (
        <div className="space-y-3 rounded-xl bg-white p-5 shadow-card">
          <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
            <div>
              <label className="text-xs font-medium uppercase text-neutral-500">Category</label>
              <input
                list="faq-categories"
                value={faqForm.category}
                onChange={(event) => setFaqForm((current) => ({ ...current, category: event.target.value }))}
                className="mt-1 h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm"
              />
              <datalist id="faq-categories">
                {categories.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="text-xs font-medium uppercase text-neutral-500">Sort Order</label>
              <input
                type="number"
                min={0}
                value={faqForm.sortOrder}
                onChange={(event) => setFaqForm((current) => ({ ...current, sortOrder: Number(event.target.value) || 0 }))}
                className="mt-1 h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium uppercase text-neutral-500">Question</label>
            <input
              type="text"
              value={faqForm.question}
              onChange={(event) => setFaqForm((current) => ({ ...current, question: event.target.value }))}
              placeholder="Enter question"
              className="mt-1 h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-medium uppercase text-neutral-500">Answer</label>
            <textarea
              value={faqForm.answer}
              onChange={(event) => setFaqForm((current) => ({ ...current, answer: event.target.value }))}
              placeholder="Enter answer"
              className="mt-1 h-24 w-full resize-none rounded-lg border border-neutral-200 p-3 text-sm"
            />
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-bold text-neutral-600">
            <input
              type="checkbox"
              checked={faqForm.isActive}
              onChange={(event) => setFaqForm((current) => ({ ...current, isActive: event.target.checked }))}
              className="h-4 w-4 rounded border-neutral-300 text-amber-500 focus:ring-amber-500"
            />
            Visible to customers
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={resetFaqForm}
              className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void saveFaq()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {faqForm.id ? 'Update FAQ' : 'Add FAQ'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex h-48 items-center justify-center gap-2 rounded-xl bg-white text-sm text-neutral-500 shadow-card">
          <Loader2 size={18} className="animate-spin text-amber-500" />
          Loading FAQs...
        </div>
      ) : groupedFaqs.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-center shadow-card">
          <p className="text-sm font-bold text-neutral-900">No FAQs yet</p>
          <p className="mt-1 text-xs text-neutral-500">Add your first FAQ to show it in the customer Help Center.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {groupedFaqs.map((group) => (
            <div key={group.category} className="overflow-hidden rounded-xl bg-white shadow-card">
              <div className="border-b border-neutral-100 bg-neutral-50 px-5 py-3">
                <h4 className="text-sm font-semibold text-gray-900">{group.category}</h4>
              </div>
              <div className="divide-y divide-neutral-100">
                {group.items.map((faq) => (
                  <div key={faq.id} className={!faq.isActive ? 'bg-neutral-50/60' : ''}>
                    <div className="flex items-center justify-between px-5 py-3">
                      <button
                        type="button"
                        onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                        className="flex flex-1 items-center gap-2 text-left"
                      >
                        <span className="text-sm font-medium text-gray-900">{faq.question}</span>
                        {!faq.isActive && (
                          <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-bold uppercase text-neutral-500">
                            Hidden
                          </span>
                        )}
                        <ChevronDown
                          size={16}
                          className={`text-neutral-400 transition-transform ${expandedFaq === faq.id ? 'rotate-180' : ''}`}
                        />
                      </button>
                      <div className="ml-2 flex gap-1">
                        <button
                          type="button"
                          onClick={() => startEditFaq(faq)}
                          className="p-1.5 text-neutral-400 transition-colors hover:text-amber-600"
                          aria-label="Edit FAQ"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeFaq(faq)}
                          disabled={deletingId === faq.id}
                          className="p-1.5 text-neutral-400 transition-colors hover:text-red-600 disabled:opacity-60"
                          aria-label="Delete FAQ"
                        >
                          {deletingId === faq.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    </div>
                    {expandedFaq === faq.id && (
                      <div className="px-5 pb-3">
                        <p className="text-sm leading-relaxed text-neutral-600">{faq.answer}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
