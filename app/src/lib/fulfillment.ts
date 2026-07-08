import type { DeliveryHub, FulfillmentMode, Order } from '@/types';

export type PickupHubOption = DeliveryHub & {
  pickupInstructions: string;
};

export const SELF_PICKUP_HUBS: PickupHubOption[] = [
  {
    id: 'jaigaon_pickup_point',
    name: 'Collect from Jaigaon',
    dzongkhag: 'Jaigaon',
    address: 'Jaigaon pickup point',
    phone: '',
    isActive: true,
    pickupInstructions:
      'Customer will collect directly from the Jaigaon pickup point. Bhutan delivery fee is not charged for this option.',
  },
  {
    id: 'shop2bhutan_handover',
    name: 'Collect from Shop2Bhutan',
    dzongkhag: 'Thimphu',
    address: 'Shop2Bhutan handover point',
    phone: '',
    isActive: true,
    pickupInstructions:
      'Shop2Bhutan will bring the item to the Shop2Bhutan handover/pickup point. Delivery or pickup handling fee still applies.',
  },
  // Legacy hub ids kept so old orders continue to display correctly.
  {
    id: 'phuntsholing',
    name: 'Phuntsholing Hub',
    dzongkhag: 'Chhukha',
    address: 'Phuntsholing pickup hub',
    phone: '',
    isActive: true,
    pickupInstructions: 'Collect from Shop2Bhutan Phuntsholing pickup point after admin marks the order ready.',
  },
  {
    id: 'thimphu',
    name: 'Thimphu Hub',
    dzongkhag: 'Thimphu',
    address: 'Thimphu pickup hub',
    phone: '',
    isActive: true,
    pickupInstructions: 'Collect from Shop2Bhutan Thimphu pickup point after admin marks the order ready.',
  },
  {
    id: 'paro',
    name: 'Paro Hub',
    dzongkhag: 'Paro',
    address: 'Paro pickup hub',
    phone: '',
    isActive: true,
    pickupInstructions: 'Collect from Shop2Bhutan Paro pickup point after admin marks the order ready.',
  },
];

function normalizePickupKey(value?: string | null) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
}

export function normalizeFulfillmentMode(value: unknown): FulfillmentMode {
  return String(value ?? '').trim().toLowerCase() === 'self_pickup' ? 'self_pickup' : 'delivery';
}

export function getPickupHubById(value?: string | null) {
  const key = normalizePickupKey(value);
  return (
    SELF_PICKUP_HUBS.find((hub) => normalizePickupKey(hub.id) === key) ??
    SELF_PICKUP_HUBS.find((hub) => normalizePickupKey(hub.name) === key) ??
    SELF_PICKUP_HUBS[0]
  );
}

export function isSelfPickupOrder(order: Pick<Order, 'fulfillmentMode'>) {
  return normalizeFulfillmentMode(order.fulfillmentMode) === 'self_pickup';
}

export function fulfillmentModeLabel(value: unknown) {
  return normalizeFulfillmentMode(value) === 'self_pickup' ? 'Self Pickup' : 'Delivery';
}

export function getOrderPickupHubName(order: Pick<Order, 'pickupHubId' | 'pickupHubName' | 'deliveryHub'>) {
  return order.pickupHubName?.trim() || getPickupHubById(order.pickupHubId || order.deliveryHub?.id).name;
}

export function getOrderPickupInstructions(order: Pick<Order, 'pickupInstructions' | 'pickupHubId' | 'pickupHubName' | 'deliveryHub'>) {
  return order.pickupInstructions?.trim() || getPickupHubById(order.pickupHubId || order.deliveryHub?.id).pickupInstructions;
}

export function isJaigaonPickupOrder(order: Pick<Order, 'fulfillmentMode' | 'pickupHubId' | 'pickupHubName' | 'deliveryHub'>) {
  if (normalizeFulfillmentMode(order.fulfillmentMode) !== 'self_pickup') return false;
  const text = [
    order.pickupHubId,
    order.pickupHubName,
    order.deliveryHub?.id,
    order.deliveryHub?.name,
    order.deliveryHub?.address,
  ].map(normalizePickupKey).join(' ');
  return text.includes('jaigaon');
}

export function getFulfillmentDisplay(order: Order) {
  if (isSelfPickupOrder(order)) {
    const hubName = getOrderPickupHubName(order);
    const isJaigaon = isJaigaonPickupOrder(order);

    return {
      mode: 'self_pickup' as FulfillmentMode,
      label: isJaigaon ? 'Jaigaon Pickup' : 'Self Pickup',
      badgeClass: isJaigaon
        ? 'bg-slate-50 text-slate-700 border border-slate-100'
        : 'bg-blue-50 text-blue-700 border border-blue-100',
      title: hubName,
      subtitle: isJaigaon
        ? 'Customer collects directly from Jaigaon'
        : 'Customer will collect from Shop2Bhutan pickup point',
      addressLabel: 'Pickup point',
      details: getOrderPickupInstructions(order),
    };
  }

  return {
    mode: 'delivery' as FulfillmentMode,
    label: 'Delivery',
    badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
    title: order.deliveryHub?.name || 'Delivery',
    subtitle: 'Shop2Bhutan will arrange delivery',
    addressLabel: 'Delivery address',
    details: order.deliveryHub?.address || '',
  };
}
