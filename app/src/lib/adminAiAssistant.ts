import { supabase } from '@/lib/supabase';
import type { Order } from '@/types';
import type {
  AdminSmartDraftKind,
  AdminSmartOrderAnalysis,
} from '@/lib/adminSmartAssistant';

export type AdminAiTone =
  | 'professional_friendly'
  | 'concise'
  | 'warm'
  | 'formal';

export type AdminAiTask =
  | 'customer_message'
  | 'order_summary'
  | 'risk_explanation'
  | 'quotation_note';

export type AdminAiSettings = {
  enabled: boolean;
  dailyLimit: number;
  maxOutputChars: number;
  tone: AdminAiTone;
  includeCustomerName: boolean;
};

export type AdminAiUsage = {
  todayCount: number;
  dailyLimit: number;
  monthCount: number;
  inputTokens: number;
  outputTokens: number;
  model: string;
};

export type AdminAiResult = {
  summary: string;
  customerMessage: string;
  quotationNote: string;
  riskExplanation: string;
  usage?: AdminAiUsage;
};

type AppSettingRow = {
  key: string;
  value: unknown;
};

export const DEFAULT_ADMIN_AI_SETTINGS: AdminAiSettings = {
  enabled: false,
  dailyLimit: 20,
  maxOutputChars: 800,
  tone: 'professional_friendly',
  includeCustomerName: true,
};

export const ADMIN_AI_SETTING_KEYS = {
  enabled: 'admin_ai_enabled',
  dailyLimit: 'admin_ai_daily_limit',
  maxOutputChars: 'admin_ai_max_output_chars',
  tone: 'admin_ai_tone',
  includeCustomerName: 'admin_ai_include_customer_name',
} as const;

function cleanText(value: unknown, maximum = 500) {
  return String(value ?? '').trim().slice(0, maximum);
}

function booleanValue(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;

  const normalized = String(value ?? '').trim().toLowerCase();
  if (['true', '1', 'yes', 'on', 'enabled'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off', 'disabled'].includes(normalized)) return false;
  return fallback;
}

function boundedNumber(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(numeric)));
}

function toneValue(value: unknown): AdminAiTone {
  const tone = String(value ?? '').trim() as AdminAiTone;
  return ['professional_friendly', 'concise', 'warm', 'formal'].includes(tone)
    ? tone
    : DEFAULT_ADMIN_AI_SETTINGS.tone;
}

export async function fetchAdminAiSettings(): Promise<AdminAiSettings> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('key,value')
    .in('key', Object.values(ADMIN_AI_SETTING_KEYS));

  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') {
      return DEFAULT_ADMIN_AI_SETTINGS;
    }
    throw error;
  }

  const rows = (data ?? []) as AppSettingRow[];
  const valueFor = (key: string) =>
    rows.find((row) => row.key === key)?.value;

  return {
    enabled: booleanValue(
      valueFor(ADMIN_AI_SETTING_KEYS.enabled),
      DEFAULT_ADMIN_AI_SETTINGS.enabled,
    ),
    dailyLimit: boundedNumber(
      valueFor(ADMIN_AI_SETTING_KEYS.dailyLimit),
      DEFAULT_ADMIN_AI_SETTINGS.dailyLimit,
      1,
      100,
    ),
    maxOutputChars: boundedNumber(
      valueFor(ADMIN_AI_SETTING_KEYS.maxOutputChars),
      DEFAULT_ADMIN_AI_SETTINGS.maxOutputChars,
      200,
      2000,
    ),
    tone: toneValue(valueFor(ADMIN_AI_SETTING_KEYS.tone)),
    includeCustomerName: booleanValue(
      valueFor(ADMIN_AI_SETTING_KEYS.includeCustomerName),
      DEFAULT_ADMIN_AI_SETTINGS.includeCustomerName,
    ),
  };
}

export async function saveAdminAiSettings(
  settings: AdminAiSettings,
  userId?: string | null,
) {
  const updatedAt = new Date().toISOString();
  const rows = [
    {
      key: ADMIN_AI_SETTING_KEYS.enabled,
      value: Boolean(settings.enabled),
      updated_at: updatedAt,
      updated_by: userId || null,
    },
    {
      key: ADMIN_AI_SETTING_KEYS.dailyLimit,
      value: boundedNumber(settings.dailyLimit, 20, 1, 100),
      updated_at: updatedAt,
      updated_by: userId || null,
    },
    {
      key: ADMIN_AI_SETTING_KEYS.maxOutputChars,
      value: boundedNumber(settings.maxOutputChars, 800, 200, 2000),
      updated_at: updatedAt,
      updated_by: userId || null,
    },
    {
      key: ADMIN_AI_SETTING_KEYS.tone,
      value: toneValue(settings.tone),
      updated_at: updatedAt,
      updated_by: userId || null,
    },
    {
      key: ADMIN_AI_SETTING_KEYS.includeCustomerName,
      value: Boolean(settings.includeCustomerName),
      updated_at: updatedAt,
      updated_by: userId || null,
    },
  ];

  const { error } = await supabase
    .from('app_settings')
    .upsert(rows, { onConflict: 'key' });

  if (error) throw error;

  window.dispatchEvent(new CustomEvent('shop2bhutan:admin-ai-settings-updated'));
}

function firstName(order: Order) {
  const name = cleanText(
    order.user?.name || order.shippingAddress?.recipientName || '',
    80,
  );
  return name.split(/\s+/)[0] || '';
}

function paymentFacts(order: Order) {
  const payments = order.payments ?? (order.payment ? [order.payment] : []);

  return {
    coverage: order.paymentSummary?.coverage || 'unknown',
    hasPendingProof:
      order.paymentSummary?.hasPendingPayment ||
      payments.some((payment) => payment.status === 'pending'),
    verifiedPaymentExists:
      Number(order.paymentSummary?.verifiedPaid || 0) > 0 ||
      payments.some((payment) => payment.status === 'verified'),
  };
}

function safeAttributes(value: Record<string, string> | undefined) {
  return Object.entries(value || {})
    .slice(0, 12)
    .reduce<Record<string, string>>((result, [key, itemValue]) => {
      const cleanKey = cleanText(key, 60);
      const cleanValue = cleanText(itemValue, 120);
      if (cleanKey && cleanValue) result[cleanKey] = cleanValue;
      return result;
    }, {});
}

function buildSafeOrderFacts(order: Order) {
  return {
    orderId: cleanText(order.id, 80),
    orderNumber: cleanText(order.orderNumber, 80),
    status: order.status,
    customerFirstName: firstName(order),
    fulfillmentMode: order.fulfillmentMode || 'delivery',
    destination: cleanText(
      order.shippingAddress?.dzongkhag || order.pickupHubName || '',
      120,
    ),
    itemCount: order.items.length,
    items: order.items.slice(0, 12).map((item) => ({
      id: cleanText(item.id, 80),
      name: cleanText(item.productName, 240),
      platform: cleanText(item.sourcePlatform, 60),
      quantity: Math.max(1, Number(item.quantity) || 1),
      attributes: safeAttributes(item.attributes),
      notes: cleanText(item.notes, 300),
      hasSourceLink: Boolean(cleanText(item.sourceUrl, 500)),
      hasImageOrScreenshot: Boolean(
        cleanText(item.productImage, 500) ||
          cleanText(item.screenshotUrl, 500) ||
          cleanText(item.attachmentPath, 500),
      ),
    })),
    quotationStatus: order.quotation?.status || 'not_created',
    payment: paymentFacts(order),
    hasEstimatedDelivery: Boolean(
      cleanText(
        (order as Order & {
          estimatedDeliveryFrom?: string;
          estimatedDeliveryTo?: string;
          estimatedDeliveryNote?: string;
        }).estimatedDeliveryFrom ||
          (order as Order & { estimatedDeliveryTo?: string })
            .estimatedDeliveryTo ||
          (order as Order & { estimatedDeliveryNote?: string })
            .estimatedDeliveryNote,
      ),
    ),
  };
}

function buildSafeAnalysis(analysis: AdminSmartOrderAnalysis) {
  return {
    riskLabel: analysis.riskLabel,
    overdue: analysis.overdue,
    summary: analysis.summary.slice(0, 8).map((line) => cleanText(line, 300)),
    recommendedAction: cleanText(analysis.recommendedAction, 600),
    issues: analysis.issues.slice(0, 10).map((issue) => ({
      severity: issue.severity,
      title: cleanText(issue.title, 180),
      detail: cleanText(issue.detail, 400),
      suggestedAction: cleanText(issue.suggestedAction, 400),
    })),
  };
}

async function invokeErrorMessage(error: unknown) {
  const candidate = error as {
    message?: string;
    context?: Response | { json?: () => Promise<unknown> };
  };

  try {
    const context = candidate?.context;
    if (context && typeof context === 'object' && 'json' in context) {
      const payload = await context.json?.();
      const apiMessage = cleanText(
        (payload as { error?: string; message?: string } | null)?.error ||
          (payload as { error?: string; message?: string } | null)?.message,
        500,
      );
      if (apiMessage) return apiMessage;
    }
  } catch {
    // Keep the normal Supabase error message when the response body is absent.
  }

  return cleanText(candidate?.message, 500) || 'Unable to generate the AI draft.';
}

export async function generateAdminAiDraft(input: {
  order: Order;
  analysis: AdminSmartOrderAnalysis;
  task: AdminAiTask;
  currentText?: string;
  draftKind?: AdminSmartDraftKind;
}): Promise<AdminAiResult> {
  const { data, error } = await supabase.functions.invoke(
    'admin-ai-assistant',
    {
      body: {
        mode: 'generate',
        task: input.task,
        currentText: cleanText(input.currentText, 3000),
        draftKind: input.draftKind || null,
        order: buildSafeOrderFacts(input.order),
        analysis: buildSafeAnalysis(input.analysis),
      },
    },
  );

  if (error) throw new Error(await invokeErrorMessage(error));

  const result = data as Partial<AdminAiResult> & { error?: string };
  if (result?.error) throw new Error(cleanText(result.error, 500));

  return {
    summary: cleanText(result?.summary, 2000),
    customerMessage: cleanText(result?.customerMessage, 3000),
    quotationNote: cleanText(result?.quotationNote, 3000),
    riskExplanation: cleanText(result?.riskExplanation, 3000),
    usage: result?.usage,
  };
}

export async function fetchAdminAiUsage(): Promise<AdminAiUsage> {
  const { data, error } = await supabase.functions.invoke(
    'admin-ai-assistant',
    { body: { mode: 'usage' } },
  );

  if (error) throw new Error(await invokeErrorMessage(error));

  const usage = (data as { usage?: AdminAiUsage; error?: string } | null)?.usage;
  if (!usage) {
    const apiError = cleanText(
      (data as { error?: string } | null)?.error,
      500,
    );
    throw new Error(apiError || 'AI usage information is unavailable.');
  }

  return usage;
}

export async function testAdminAiAssistant(): Promise<AdminAiResult> {
  const { data, error } = await supabase.functions.invoke(
    'admin-ai-assistant',
    { body: { mode: 'test' } },
  );

  if (error) throw new Error(await invokeErrorMessage(error));

  const result = data as Partial<AdminAiResult> & { error?: string };
  if (result?.error) throw new Error(cleanText(result.error, 500));

  return {
    summary: cleanText(result?.summary, 2000),
    customerMessage: cleanText(result?.customerMessage, 3000),
    quotationNote: cleanText(result?.quotationNote, 3000),
    riskExplanation: cleanText(result?.riskExplanation, 3000),
    usage: result?.usage,
  };
}
