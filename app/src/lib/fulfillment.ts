import type { DeliveryHub, FulfillmentMode, Order } from '@/types';

export type PickupHubOption = DeliveryHub & {
  pickupInstructions: string;
};

export const SELF_PICKUP_HUBS: PickupHubOption[] = [
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

export function normalizeFulfillmentMode(value: unknown): FulfillmentMode {
  return String(value ?? '').trim().toLowerCase() === 'self_pickup' ? 'self_pickup' : 'delivery';
}

export function getPickupHubById(value?: string | null) {
  const id = String(value ?? '').trim().toLowerCase();
  return SELF_PICKUP_HUBS.find((hub) => hub.id === id) ?? SELF_PICKUP_HUBS[0];
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

export function getFulfillmentDisplay(order: Order) {
  if (isSelfPickupOrder(order)) {
    const hubName = getOrderPickupHubName(order);
    return {
      mode: 'self_pickup' as FulfillmentMode,
      label: 'Self Pickup',
      badgeClass: 'bg-blue-50 text-blue-700 border border-blue-100',
      title: hubName,
      subtitle: 'Customer will collect from pickup hub',
      addressLabel: 'Pickup hub',
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
