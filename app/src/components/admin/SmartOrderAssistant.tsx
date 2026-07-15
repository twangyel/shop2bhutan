import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Copy,
  Loader2,
  Send,
  Sparkles,
} from 'lucide-react';
import {
  analyzeAdminOrder,
  buildAdminSmartDraft,
  smartDraftLabel,
  smartNotificationTitle,
  type AdminSmartDraftKind,
  type AdminSmartIssueSeverity,
} from '@/lib/adminSmartAssistant';
import { sendAdminCustomerUpdate } from '@/lib/customerOrders';
import type { Order } from '@/types';

const DRAFT_KINDS: AdminSmartDraftKind[] = [
  'missing_information',
  'quotation_follow_up',
  'payment_reminder',
  'delay_update',
  'general_update',
];

function severityClass(severity: AdminSmartIssueSeverity) {
  if (severity === 'high') return 'border-red-100 bg-red-50 text-red-700';
  if (severity === 'medium') return 'border-amber-100 bg-amber-50 text-amber-700';
  return 'border-blue-100 bg-blue-50 text-blue-700';
}

export default function SmartOrderAssistant({ order }: { order: Order }) {
  const analysis = useMemo(() => analyzeAdminOrder(order), [order]);
  const defaultKind: AdminSmartDraftKind = analysis.overdue
    ? 'delay_update'
    : analysis.issues.some(
          (issue) =>
            issue.id.startsWith('variant-') ||
            issue.id === 'missing-address' ||
            issue.id === 'missing-phone',
        )
      ? 'missing_information'
      : order.status === 'quoted' || order.status === 'payment_pending'
        ? 'payment_reminder'
        : 'general_update';

  const [kind, setKind] = useState<AdminSmartDraftKind>(defaultKind);
  const [draft, setDraft] = useState(() =>
    buildAdminSmartDraft(order, defaultKind, analysis),
  );
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setKind(defaultKind);
    setDraft(buildAdminSmartDraft(order, defaultKind, analysis));
    setFeedback('');
    setError('');
  }, [analysis, defaultKind, order]);

  const chooseDraft = (nextKind: AdminSmartDraftKind) => {
    setKind(nextKind);
    setDraft(buildAdminSmartDraft(order, nextKind, analysis));
    setFeedback('');
    setError('');
  };

  const copyDraft = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      setFeedback('Draft copied');
      window.setTimeout(() => setFeedback(''), 2200);
    } catch {
      setError('Unable to copy the draft on this device.');
    }
  };

  const sendDraft = async () => {
    const message = draft.trim();
    if (!message || sending) return;

    setSending(true);
    setFeedback('');
    setError('');

    try {
      await sendAdminCustomerUpdate({
        order,
        title: smartNotificationTitle(order, kind),
        message,
      });
      setFeedback('Customer update sent');
    } catch (sendError) {
      console.error('[SmartOrderAssistant] Customer update failed:', sendError);
      setError(
        sendError instanceof Error
          ? sendError.message
          : 'Unable to send the customer update.',
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-xl border border-violet-100 bg-white shadow-card">
      <div className="flex flex-col gap-3 border-b border-violet-100 bg-violet-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-violet-600 shadow-sm ring-1 ring-violet-100">
            <Bot size={20} />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-neutral-900">S2B Admin Copilot</h3>
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700 ring-1 ring-violet-100">
                Smart rules
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-neutral-600">
              Reviews order facts, highlights risk, and prepares editable customer updates.
            </p>
          </div>
        </div>

        <span
          className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${
            analysis.riskLabel === 'High-risk review'
              ? 'bg-red-100 text-red-700'
              : analysis.riskLabel === 'Needs attention'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-emerald-100 text-emerald-700'
          }`}
        >
          {analysis.riskLabel}
        </span>
      </div>

      <div className="space-y-5 p-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">
              Smart summary
            </p>
            <div className="mt-2 space-y-2">
              {analysis.summary.map((line) => (
                <div key={line} className="flex items-start gap-2 text-sm text-neutral-700">
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-violet-500" />
                  <span>{line}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">
              Recommended next action
            </p>
            <div className="mt-2 rounded-xl border border-violet-100 bg-violet-50 px-3.5 py-3">
              <div className="flex items-start gap-2">
                <Sparkles size={16} className="mt-0.5 shrink-0 text-violet-600" />
                <p className="text-sm leading-6 text-violet-900">
                  {analysis.recommendedAction}
                </p>
              </div>
            </div>
          </div>
        </div>

        {analysis.issues.length > 0 && (
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">
                Checks requiring attention
              </p>
              <span className="text-xs font-bold text-neutral-500">
                {analysis.issues.length}
              </span>
            </div>
            <div className="mt-2 grid gap-2 lg:grid-cols-2">
              {analysis.issues.slice(0, 6).map((issue) => (
                <div
                  key={issue.id}
                  className={`rounded-xl border px-3.5 py-3 ${severityClass(issue.severity)}`}
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-bold">{issue.title}</p>
                      <p className="mt-1 text-xs leading-5 opacity-90">{issue.detail}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-neutral-100 pt-5">
          <div className="flex flex-wrap gap-2">
            {DRAFT_KINDS.map((draftKind) => (
              <button
                key={draftKind}
                type="button"
                onClick={() => chooseDraft(draftKind)}
                className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                  kind === draftKind
                    ? 'bg-violet-600 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {smartDraftLabel(draftKind)}
              </button>
            ))}
          </div>

          <label className="mt-4 block">
            <span className="text-xs font-bold uppercase tracking-wide text-neutral-400">
              Editable customer message
            </span>
            <textarea
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setFeedback('');
                setError('');
              }}
              rows={6}
              className="mt-2 w-full resize-y rounded-xl border border-neutral-200 bg-white p-3 text-sm leading-6 text-neutral-800 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-500/10"
            />
          </label>

          {error && (
            <div className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          {feedback && (
            <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
              {feedback}
            </div>
          )}

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] leading-5 text-neutral-500">
              Review every message before sending. This assistant never verifies payments,
              changes status, or sends a quotation automatically.
            </p>

            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={copyDraft}
                disabled={!draft.trim()}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
              >
                <Copy size={15} />
                Copy
              </button>
              <button
                type="button"
                onClick={sendDraft}
                disabled={!draft.trim() || sending}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                Send Update
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
