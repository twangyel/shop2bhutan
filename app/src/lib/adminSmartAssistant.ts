import type { Order, OrderStatus } from '@/types';

export type AdminSmartDraftKind =
  | 'missing_information'
  | 'quotation_follow_up'
  | 'payment_reminder'
  | 'delay_update'
  | 'general_update';

export type AdminSmartIssueSeverity = 'high' | 'medium' | 'low';

export type AdminSmartIssue = {
  id: string;
  severity: AdminSmartIssueSeverity;
  title: string;
  detail: string;
  suggestedAction: string;
  itemId?: string;
};

export type AdminSmartOrderAnalysis = {
  summary: string[];
  issues: AdminSmartIssue[];
  recommendedAction: string;
  riskLabel: 'Ready to review' | 'Needs attention' | 'High-risk review';
  overdue: boolean;
  ageHours: number;
};

const BULKY_KEYWORDS = [
  'air conditioner',
  'air cooler',
  'bed frame',
  'bicycle',
  'cabinet',
  'dishwasher',
  'exercise bike',
  'freezer',
  'furniture',
  'generator',
  'mattress',
  'refrigerator',
  'sofa',
  'television',
  'treadmill',
  'tv ',
  'wardrobe',
  'washing machine',
  'water heater',
];

const RESTRICTED_REVIEW_KEYWORDS = [
  'aerosol',
  'ammunition',
  'alcohol',
  'battery acid',
  'cigarette',
  'firework',
  'flammable',
  'gun',
  'knife',
  'lighter fluid',
  'medicine',
  'nicotine',
  'paint thinner',
  'pepper spray',
  'pesticide',
  'vape',
];

const APPAREL_KEYWORDS = [
  'blazer',
  'boot',
  'dress',
  'footwear',
  'hoodie',
  'jacket',
  'jeans',
  'kurta',
  'pant',
  'sandal',
  'shirt',
  'shoe',
  'shorts',
  'skirt',
  'sneaker',
  'sweater',
  't-shirt',
  'tee',
  'top',
  'trouser',
];

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_confirmation: 'pending confirmation',
  quotation_pending: 'awaiting final-price preparation',
  quoted: 'final price sent',
  payment_pending: 'awaiting customer payment',
  payment_verified: 'payment verified',
  order_placed: 'ordered from the seller',
  in_transit: 'in transit',
  arrived_at_hub: 'arrived at the hub',
  out_for_delivery: 'out for delivery or pickup',
  delivered: 'delivered',
  cancelled: 'cancelled',
};

const OVERDUE_HOURS: Partial<Record<OrderStatus, number>> = {
  pending_confirmation: 12,
  quotation_pending: 12,
  quoted: 48,
  payment_pending: 72,
  payment_verified: 24,
  order_placed: 72,
  in_transit: 168,
  arrived_at_hub: 48,
  out_for_delivery: 24,
};

function cleanText(value: unknown) {
  return String(value ?? '').trim();
}

function itemText(order: Order) {
  return order.items
    .map((item) =>
      [
        item.productName,
        item.notes,
        Object.entries(item.attributes || {})
          .map(([key, value]) => `${key} ${value}`)
          .join(' '),
      ]
        .filter(Boolean)
        .join(' '),
    )
    .join(' ')
    .toLowerCase();
}

function firstName(order: Order) {
  const raw =
    cleanText(order.user?.name) ||
    cleanText(order.shippingAddress?.recipientName) ||
    'Customer';
  return raw.split(/\s+/)[0] || 'Customer';
}

function orderNumber(order: Order) {
  return cleanText(order.orderNumber) || order.id.slice(0, 8).toUpperCase();
}

function platformSummary(order: Order) {
  const platforms = Array.from(
    new Set(
      order.items
        .map((item) => cleanText(item.sourcePlatform).toLowerCase())
        .filter(Boolean),
    ),
  );

  return platforms.length > 0
    ? platforms.map((value) => value.replace(/\b\w/g, (letter) => letter.toUpperCase())).join(', ')
    : 'link or screenshot request';
}

function orderAgeHours(order: Order) {
  const value = order.updatedAt || order.createdAt;
  const date = value ? new Date(value) : null;

  if (!date || Number.isNaN(date.getTime())) return 0;
  return Math.max(0, (Date.now() - date.getTime()) / (60 * 60 * 1000));
}

function paymentSnapshot(order: Order) {
  const payments = order.payments ?? (order.payment ? [order.payment] : []);
  const totalPayable =
    Number(order.paymentSummary?.totalPayable ?? order.quotation?.totalAmount ?? 0) || 0;
  const verifiedPaid =
    Number(order.paymentSummary?.verifiedPaid) ||
    payments
      .filter((payment) => payment.status === 'verified')
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const pendingAmount =
    Number(order.paymentSummary?.pendingAmount) ||
    payments
      .filter((payment) => payment.status === 'pending')
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const balanceDue =
    Number(order.paymentSummary?.balanceDue) ||
    Math.max(totalPayable - verifiedPaid, 0);

  return {
    totalPayable,
    verifiedPaid,
    pendingAmount,
    balanceDue,
    hasPendingProof:
      Boolean(order.paymentSummary?.hasPendingPayment) ||
      payments.some((payment) => payment.status === 'pending'),
  };
}

function hasVariantInformation(order: Order, itemId: string) {
  const item = order.items.find((candidate) => candidate.id === itemId);
  if (!item) return false;

  const text = [
    item.notes,
    ...Object.entries(item.attributes || {}).flatMap(([key, value]) => [key, value]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return /(size|colour|color|variant|dimension|waist|shoe size|uk size|eu size)/i.test(text);
}

function formatMoney(value: number) {
  return `Nu. ${Math.round(Math.max(0, value)).toLocaleString('en-US')}`;
}

export function analyzeAdminOrder(order: Order): AdminSmartOrderAnalysis {
  const issues: AdminSmartIssue[] = [];
  const allText = itemText(order);
  const ageHours = orderAgeHours(order);
  const threshold = OVERDUE_HOURS[order.status];
  const overdue = Boolean(
    threshold &&
      order.status !== 'delivered' &&
      order.status !== 'cancelled' &&
      ageHours >= threshold,
  );

  order.items.forEach((item, index) => {
    const label = cleanText(item.productName) || `Item ${index + 1}`;
    const normalized = [
      item.productName,
      item.notes,
      Object.entries(item.attributes || {})
        .map(([key, value]) => `${key} ${value}`)
        .join(' '),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (Number(item.unitPrice || 0) <= 0) {
      issues.push({
        id: `price-${item.id}`,
        itemId: item.id,
        severity: 'medium',
        title: `Price needs confirmation: ${label}`,
        detail: 'No reliable customer-side product price is stored for this item.',
        suggestedAction: 'Open the seller page and confirm the current payable price before preparing the final price.',
      });
    }

    if (
      APPAREL_KEYWORDS.some((keyword) => normalized.includes(keyword)) &&
      !hasVariantInformation(order, item.id)
    ) {
      issues.push({
        id: `variant-${item.id}`,
        itemId: item.id,
        severity: 'medium',
        title: `Variant may be missing: ${label}`,
        detail: 'This looks like an apparel or footwear item, but no clear size, colour, or variant was found.',
        suggestedAction: 'Ask the customer to confirm the required option before ordering.',
      });
    }

    if (BULKY_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
      issues.push({
        id: `bulky-${item.id}`,
        itemId: item.id,
        severity: 'high',
        title: `Possible bulky product: ${label}`,
        detail: 'The product name suggests special vehicle space, handling, storage, or transport pricing may be required.',
        suggestedAction: 'Check dimensions and weight, then approve only through a manual transport quotation.',
      });
    }

    if (RESTRICTED_REVIEW_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
      issues.push({
        id: `restricted-${item.id}`,
        itemId: item.id,
        severity: 'high',
        title: `Policy review required: ${label}`,
        detail: 'The product may be restricted, hazardous, fragile, or unsuitable for normal Shop2Bhutan transport.',
        suggestedAction: 'Review the product and applicable transport rules before accepting it.',
      });
    }

    if (
      !cleanText(item.sourceUrl) &&
      !cleanText(item.screenshotUrl) &&
      !cleanText(item.attachmentPath)
    ) {
      issues.push({
        id: `source-${item.id}`,
        itemId: item.id,
        severity: 'low',
        title: `Limited source evidence: ${label}`,
        detail: 'No product link or submitted screenshot reference is available for quick seller verification.',
        suggestedAction: 'Confirm the product identity and seller page before sending the final price.',
      });
    }

    if (Number(item.quantity || 1) >= 6) {
      issues.push({
        id: `quantity-${item.id}`,
        itemId: item.id,
        severity: 'medium',
        title: `High quantity: ${label}`,
        detail: `The customer requested ${item.quantity} units, which may affect stock, transport space, or seller limits.`,
        suggestedAction: 'Confirm seller stock and whether the quantity requires separate packages.',
      });
    }
  });

  if (!cleanText(order.shippingAddress?.phone) && !cleanText(order.user?.phone)) {
    issues.push({
      id: 'missing-phone',
      severity: 'medium',
      title: 'Customer phone is missing',
      detail: 'There is no clear phone number for delivery or clarification.',
      suggestedAction: 'Confirm a reachable Bhutan phone number before processing.',
    });
  }

  if (
    order.fulfillmentMode !== 'self_pickup' &&
    !cleanText(order.shippingAddress?.dzongkhag) &&
    !cleanText(order.shippingAddress?.village)
  ) {
    issues.push({
      id: 'missing-address',
      severity: 'medium',
      title: 'Delivery address needs confirmation',
      detail: 'The order does not contain enough destination information for a reliable delivery charge.',
      suggestedAction: 'Ask the customer to confirm the delivery location before preparing the quotation.',
    });
  }

  const payment = paymentSnapshot(order);

  if (payment.hasPendingProof) {
    issues.push({
      id: 'payment-review',
      severity: 'medium',
      title: 'Payment proof needs review',
      detail: `${formatMoney(payment.pendingAmount)} is currently pending verification.`,
      suggestedAction: 'Verify or reject the payment proof before taking the next financial action.',
    });
  }

  if (
    order.status === 'payment_verified' &&
    !order.trackingEvents?.some((event) => event.status === 'order_placed')
  ) {
    issues.push({
      id: 'verified-not-ordered',
      severity: 'medium',
      title: 'Verified payment but seller order not recorded',
      detail: 'The next expected step is to place the order with the Indian seller.',
      suggestedAction: 'Place the seller order and record the seller reference and ETA.',
    });
  }

  if (overdue) {
    issues.push({
      id: 'overdue',
      severity: 'medium',
      title: 'Order may be overdue',
      detail: `The order has remained at “${STATUS_LABELS[order.status]}” for about ${Math.floor(ageHours)} hours.`,
      suggestedAction: 'Review the current stage and send the customer a clear update.',
    });
  }

  if (
    ['order_placed', 'in_transit', 'arrived_at_hub', 'out_for_delivery'].includes(order.status)
  ) {
    const etaOrder = order as Order & {
      estimatedDeliveryFrom?: string;
      estimatedDeliveryTo?: string;
    };

    if (!etaOrder.estimatedDeliveryFrom && !etaOrder.estimatedDeliveryTo) {
      issues.push({
        id: 'missing-eta',
        severity: 'low',
        title: 'Estimated delivery is not set',
        detail: 'The order is in fulfillment, but the customer has no visible delivery window.',
        suggestedAction: 'Add a realistic ETA or delivery note when the seller or trip schedule is known.',
      });
    }
  }

  const highCount = issues.filter((issue) => issue.severity === 'high').length;
  const mediumCount = issues.filter((issue) => issue.severity === 'medium').length;
  const riskLabel =
    highCount > 0
      ? 'High-risk review'
      : mediumCount > 0
        ? 'Needs attention'
        : 'Ready to review';

  const paymentDescription =
    payment.totalPayable <= 0
      ? 'No final payable amount recorded'
      : payment.verifiedPaid >= payment.totalPayable
        ? `Fully paid (${formatMoney(payment.verifiedPaid)})`
        : payment.verifiedPaid > 0
          ? `${formatMoney(payment.verifiedPaid)} verified; ${formatMoney(payment.balanceDue)} balance`
          : payment.hasPendingProof
            ? `${formatMoney(payment.pendingAmount)} proof awaiting review`
            : `${formatMoney(payment.totalPayable)} awaiting payment`;

  const destination =
    order.fulfillmentMode === 'self_pickup'
      ? cleanText(order.pickupHubName) || cleanText(order.deliveryHub?.name) || 'Self pickup'
      : cleanText(order.shippingAddress?.dzongkhag) ||
        cleanText(order.deliveryHub?.name) ||
        'Delivery destination not confirmed';

  const summary = [
    `${order.items.length} item${order.items.length === 1 ? '' : 's'} from ${platformSummary(order)}.`,
    `Current stage: ${STATUS_LABELS[order.status]}.`,
    `Fulfillment: ${destination}.`,
    `Payment: ${paymentDescription}.`,
  ];

  if (allText && highCount > 0) {
    summary.push(`${highCount} product-risk flag${highCount === 1 ? '' : 's'} require manual review.`);
  }

  const topIssue =
    issues.find((issue) => issue.severity === 'high') ||
    issues.find((issue) => issue.severity === 'medium') ||
    issues[0];

  const recommendedAction =
    topIssue?.suggestedAction ||
    (order.status === 'quotation_pending' || order.status === 'pending_confirmation'
      ? 'Confirm seller availability, selected options, price, and transport suitability before sending the final price.'
      : order.status === 'quoted' || order.status === 'payment_pending'
        ? 'Monitor quotation acceptance and payment, and answer any customer questions.'
        : order.status === 'payment_verified'
          ? 'Place the seller order and record the seller reference and estimated delivery.'
          : 'Keep the customer informed and update the order when the next verified milestone is reached.');

  return {
    summary,
    issues,
    recommendedAction,
    riskLabel,
    overdue,
    ageHours,
  };
}

export function smartDraftLabel(kind: AdminSmartDraftKind) {
  const labels: Record<AdminSmartDraftKind, string> = {
    missing_information: 'Request missing details',
    quotation_follow_up: 'Final-price follow-up',
    payment_reminder: 'Payment reminder',
    delay_update: 'Delay update',
    general_update: 'General order update',
  };

  return labels[kind];
}

export function smartNotificationTitle(order: Order, kind: AdminSmartDraftKind) {
  const prefix = `Order #${orderNumber(order)}`;

  if (kind === 'missing_information') return `${prefix}: Details Required`;
  if (kind === 'quotation_follow_up') return `${prefix}: Final Price Update`;
  if (kind === 'payment_reminder') return `${prefix}: Payment Update`;
  if (kind === 'delay_update') return `${prefix}: Delivery Update`;
  return `${prefix}: Order Update`;
}

export function buildAdminSmartDraft(
  order: Order,
  kind: AdminSmartDraftKind,
  analysis = analyzeAdminOrder(order),
) {
  const customer = firstName(order);
  const number = orderNumber(order);
  const payment = paymentSnapshot(order);
  const etaOrder = order as Order & {
    estimatedDeliveryFrom?: string;
    estimatedDeliveryTo?: string;
    estimatedDeliveryNote?: string;
  };

  if (kind === 'missing_information') {
    const missing = analysis.issues
      .filter((issue) =>
        issue.id.startsWith('variant-') ||
        issue.id.startsWith('source-') ||
        issue.id === 'missing-phone' ||
        issue.id === 'missing-address',
      )
      .slice(0, 4)
      .map((issue) => issue.title.replace(/^[^:]+:\s*/, ''));

    const details =
      missing.length > 0
        ? missing.map((item) => `• ${item}`).join('\n')
        : '• Please confirm the exact product option, size, colour, or other required variant.';

    return `Hello ${customer}, we are reviewing your Shop2Bhutan order #${number}. Before we confirm availability and the final price, please help us confirm:\n\n${details}\n\nReply with the missing details so we can continue processing your request.`;
  }

  if (kind === 'quotation_follow_up') {
    if (order.quotation) {
      return `Hello ${customer}, the final price for your Shop2Bhutan order #${number} is ready for review. The total shown in the app is ${formatMoney(order.quotation.totalAmount)}. Please review the item details and charges before accepting. Product availability and seller price can change until the order is placed.`;
    }

    return `Hello ${customer}, we are checking seller availability and the current price for order #${number}. We will send the confirmed final price through the app after the product, selected option, and delivery requirements are verified.`;
  }

  if (kind === 'payment_reminder') {
    if (payment.hasPendingProof) {
      return `Hello ${customer}, we received your payment proof for order #${number}. It is currently awaiting verification. We will notify you after the amount and transaction details are confirmed.`;
    }

    if (payment.balanceDue > 0 && payment.verifiedPaid > 0) {
      return `Hello ${customer}, ${formatMoney(payment.verifiedPaid)} has been verified for order #${number}. The remaining balance is ${formatMoney(payment.balanceDue)}. Please complete the balance payment before final delivery or handover, as shown in the app.`;
    }

    if (payment.totalPayable > 0) {
      return `Hello ${customer}, the final price for order #${number} is ${formatMoney(payment.totalPayable)} and payment is still pending. Please upload a clear payment proof with the amount and transaction reference visible.`;
    }

    return `Hello ${customer}, payment is not required yet for order #${number}. We will first confirm availability and send the final price through the app.`;
  }

  if (kind === 'delay_update') {
    const status = STATUS_LABELS[order.status];
    const etaText =
      etaOrder.estimatedDeliveryNote ||
      (etaOrder.estimatedDeliveryFrom || etaOrder.estimatedDeliveryTo
        ? 'The estimated delivery window shown in the app remains our current reference.'
        : 'A revised delivery date will be added once it is confirmed.');

    return `Hello ${customer}, here is an update on order #${number}. The order is currently ${status}. It is taking longer than expected, and we are checking the next confirmed movement. ${etaText} We apologize for the delay and will update you again when the next milestone is verified.`;
  }

  const etaText = etaOrder.estimatedDeliveryNote
    ? ` ${etaOrder.estimatedDeliveryNote}`
    : '';

  return `Hello ${customer}, your Shop2Bhutan order #${number} is currently ${STATUS_LABELS[order.status]}.${etaText} You can open the order in the app to view the latest payment, tracking, and delivery information.`;
}

export function buildQuotationAssistantNote(
  order: Order,
  analysis = analyzeAdminOrder(order),
) {
  const customerVisibleChecks: string[] = [];

  if (analysis.issues.some((issue) => issue.id.startsWith('variant-'))) {
    customerVisibleChecks.push('Selected size, colour, and variant must match the customer request.');
  }

  if (
    analysis.issues.some(
      (issue) => issue.id.startsWith('bulky-') || issue.id.startsWith('restricted-'),
    )
  ) {
    customerVisibleChecks.push('Transport acceptance and any special handling remain subject to manual confirmation.');
  }

  if (analysis.issues.some((issue) => issue.id.startsWith('quantity-'))) {
    customerVisibleChecks.push('Seller stock for the requested quantity must be reconfirmed before purchase.');
  }

  const lines = [
    'Final price is based on the seller price and availability checked at the time of quotation.',
    ...customerVisibleChecks,
    'If the seller changes the price, stock, or selected option before purchase, Shop2Bhutan will contact the customer before proceeding.',
  ];

  if (order.fulfillmentMode === 'self_pickup') {
    lines.push('This quotation follows the selected self-pickup or handover arrangement shown in the order.');
  }

  return lines.join(' ');
}
