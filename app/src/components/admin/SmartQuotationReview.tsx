import { useMemo } from 'react';
import { AlertTriangle, Bot, CheckCircle2, Sparkles } from 'lucide-react';
import {
  analyzeAdminOrder,
  buildQuotationAssistantNote,
  type AdminSmartIssueSeverity,
} from '@/lib/adminSmartAssistant';
import type { Order } from '@/types';

function issueClass(severity: AdminSmartIssueSeverity) {
  if (severity === 'high') return 'border-red-100 bg-red-50 text-red-700';
  if (severity === 'medium') return 'border-amber-100 bg-amber-50 text-amber-700';
  return 'border-blue-100 bg-blue-50 text-blue-700';
}

export default function SmartQuotationReview({
  order,
  onApplyNote,
}: {
  order: Order;
  onApplyNote: (note: string) => void;
}) {
  const analysis = useMemo(() => analyzeAdminOrder(order), [order]);
  const quotationIssues = analysis.issues.filter(
    (issue) =>
      issue.id.startsWith('price-') ||
      issue.id.startsWith('variant-') ||
      issue.id.startsWith('bulky-') ||
      issue.id.startsWith('restricted-') ||
      issue.id.startsWith('quantity-') ||
      issue.id.startsWith('source-') ||
      issue.id === 'missing-address' ||
      issue.id === 'missing-phone',
  );
  const suggestedNote = buildQuotationAssistantNote(order, analysis);

  return (
    <section className="overflow-hidden rounded-xl border border-violet-100 bg-white shadow-card">
      <div className="flex flex-col gap-3 border-b border-violet-100 bg-violet-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-violet-600 shadow-sm ring-1 ring-violet-100">
            <Bot size={20} />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-neutral-900">
                Copilot quotation review
              </h3>
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700 ring-1 ring-violet-100">
                Smart rules
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-neutral-600">
              Check these facts against the live seller page before sending the final price.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onApplyNote(suggestedNote)}
          className="inline-flex h-9 w-fit items-center gap-2 rounded-lg bg-violet-600 px-3 text-xs font-bold text-white hover:bg-violet-700"
        >
          <Sparkles size={14} />
          Apply Suggested Note
        </button>
      </div>

      <div className="p-5">
        {quotationIssues.length === 0 ? (
          <div className="flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3.5 py-3 text-emerald-700">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold">No obvious request-data issue detected</p>
              <p className="mt-1 text-xs leading-5">
                Still confirm live stock, selected variant, seller price, delivery availability,
                weight, and dimensions before sending.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-2 lg:grid-cols-2">
            {quotationIssues.slice(0, 6).map((issue) => (
              <div
                key={issue.id}
                className={`rounded-xl border px-3.5 py-3 ${issueClass(issue.severity)}`}
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold">{issue.title}</p>
                    <p className="mt-1 text-xs leading-5 opacity-90">
                      {issue.suggestedAction}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 rounded-xl border border-neutral-100 bg-neutral-50 px-3.5 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">
            Recommended action
          </p>
          <p className="mt-1 text-sm leading-6 text-neutral-700">
            {analysis.recommendedAction}
          </p>
        </div>
      </div>
    </section>
  );
}
