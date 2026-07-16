import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Loader2,
  Sparkles,
} from 'lucide-react';
import {
  analyzeAdminOrder,
  buildQuotationAssistantNote,
  type AdminSmartIssueSeverity,
} from '@/lib/adminSmartAssistant';
import { generateAdminAiDraft } from '@/lib/adminAiAssistant';
import type { Order } from '@/types';

function issueClass(severity: AdminSmartIssueSeverity) {
  if (severity === 'high') return 'border-red-100 bg-red-50 text-red-700';
  if (severity === 'medium') return 'border-amber-100 bg-amber-50 text-amber-700';
  return 'border-blue-100 bg-blue-50 text-blue-700';
}

export default function SmartQuotationReview({
  order,
  currentNote,
  onApplyNote,
}: {
  order: Order;
  currentNote?: string;
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
  const [aiBusy, setAiBusy] = useState<'note' | 'risk' | ''>('');
  const [aiRiskExplanation, setAiRiskExplanation] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const polishNote = async () => {
    if (aiBusy) return;

    setAiBusy('note');
    setError('');
    setFeedback('');

    try {
      const result = await generateAdminAiDraft({
        order,
        analysis,
        task: 'quotation_note',
        currentText: currentNote?.trim() || suggestedNote,
      });

      if (!result.quotationNote) {
        throw new Error('The AI assistant returned an empty quotation note.');
      }

      onApplyNote(result.quotationNote);
      setFeedback('AI-polished quotation note applied. Review it before sending.');
    } catch (aiError) {
      console.error('[SmartQuotationReview] AI note failed:', aiError);
      setError(
        aiError instanceof Error
          ? aiError.message
          : 'Unable to polish the quotation note with AI.',
      );
    } finally {
      setAiBusy('');
    }
  };

  const explainRisks = async () => {
    if (aiBusy) return;

    setAiBusy('risk');
    setError('');
    setFeedback('');

    try {
      const result = await generateAdminAiDraft({
        order,
        analysis,
        task: 'risk_explanation',
        currentText: currentNote?.trim() || suggestedNote,
      });

      if (!result.riskExplanation) {
        throw new Error('The AI assistant returned no risk explanation.');
      }

      setAiRiskExplanation(result.riskExplanation);
    } catch (aiError) {
      console.error('[SmartQuotationReview] AI risk explanation failed:', aiError);
      setError(
        aiError instanceof Error
          ? aiError.message
          : 'Unable to explain the quotation risks with AI.',
      );
    } finally {
      setAiBusy('');
    }
  };

  return (
    <section className="overflow-hidden rounded-xl border border-violet-100 bg-white shadow-card">
      <div className="flex flex-col gap-3 border-b border-violet-100 bg-violet-50/70 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
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
                Smart rules + optional AI
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-neutral-600">
              Confirm live stock, variant, seller price, deliverability, weight, and dimensions before sending.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              onApplyNote(suggestedNote);
              setFeedback('Rule-based suggested note applied.');
              setError('');
            }}
            disabled={Boolean(aiBusy)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-violet-200 bg-white px-3 text-xs font-bold text-violet-700 hover:bg-violet-50 disabled:opacity-50"
          >
            <Sparkles size={14} />
            Apply Suggested Note
          </button>
          <button
            type="button"
            onClick={() => void polishNote()}
            disabled={Boolean(aiBusy)}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-violet-600 px-3 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {aiBusy === 'note' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            Polish Note with AI
          </button>
          <button
            type="button"
            onClick={() => void explainRisks()}
            disabled={Boolean(aiBusy)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
          >
            {aiBusy === 'risk' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <AlertTriangle size={14} />
            )}
            Explain Risks
          </button>
        </div>
      </div>

      <div className="p-5">
        {quotationIssues.length === 0 ? (
          <div className="flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3.5 py-3 text-emerald-700">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold">No obvious request-data issue detected</p>
              <p className="mt-1 text-xs leading-5">
                This does not confirm current stock, seller delivery, product weight, dimensions, or transport acceptance.
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

        {aiRiskExplanation && (
          <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3.5 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
              AI risk explanation
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-amber-950">
              {aiRiskExplanation}
            </p>
          </div>
        )}

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

        <p className="mt-3 text-[11px] leading-5 text-neutral-500">
          AI only drafts wording. It does not verify stock, calculate prices, change charges, or send the final price.
        </p>
      </div>
    </section>
  );
}
