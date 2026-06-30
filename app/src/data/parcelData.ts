import type { ParcelTrip, ParcelRequest } from '@/types/parcel';

export const parcelTrips: ParcelTrip[] = [
  {
    id: 'trip1',
    name: 'Phuntsholing Run - July 2026',
    goingDate: '2026-07-15',
    returnDate: '2026-07-18',
    fromLocation: 'Customer pickup address',
    toLocation: 'Phuntsholing, Bhutan',
    description: 'Regular Phuntsholing parcel run. Pickup from customer address before the trip.',
    isActive: true,
    createdAt: '2026-06-01T00:00:00Z',
  },
  {
    id: 'trip2',
    name: 'Phuntsholing Run - Late July 2026',
    goingDate: '2026-07-25',
    returnDate: '2026-07-28',
    fromLocation: 'Customer pickup address',
    toLocation: 'Phuntsholing, Bhutan',
    description: 'Late July parcel run. Limited slots available for pickup and delivery.',
    isActive: true,
    createdAt: '2026-06-10T00:00:00Z',
  },
  {
    id: 'trip3',
    name: 'Phuntsholing Run - August 2026',
    goingDate: '2026-08-10',
    returnDate: '2026-08-13',
    fromLocation: 'Customer pickup address',
    toLocation: 'Phuntsholing, Bhutan',
    description: 'August parcel run. Book early so pickup can be arranged before travel.',
    isActive: true,
    createdAt: '2026-06-15T00:00:00Z',
  },
  {
    id: 'trip4',
    name: 'Phuntsholing Express - August 2026',
    goingDate: '2026-08-22',
    returnDate: '2026-08-24',
    fromLocation: 'Customer pickup address',
    toLocation: 'Phuntsholing, Bhutan',
    description: 'Express Phuntsholing parcel run with priority handling.',
    isActive: true,
    createdAt: '2026-06-20T00:00:00Z',
  },
];

export const parcelRequests: ParcelRequest[] = [
  {
    id: 'pr1',
    userId: 'u1',
    tripId: 'trip1',
    trip: parcelTrips[0],
    status: 'delivered',
    pickupAddress: 'Changzamtog, Thimphu',
    contactNumber: '+975 17123456',
    parcelType: 'electronics',
    parcelSize: 'small',
    weightKg: 1.5,
    description: 'Phone case and charger from Amazon',
    instructions: 'Handle with care, fragile items inside',
    createdAt: '2026-07-10T08:00:00Z',
    updatedAt: '2026-07-19T10:00:00Z',
  },
  {
    id: 'pr2',
    userId: 'u1',
    tripId: 'trip2',
    trip: parcelTrips[1],
    status: 'in_transit',
    pickupAddress: 'Motithang, Thimphu',
    contactNumber: '+975 17123456',
    parcelType: 'clothing',
    parcelSize: 'medium',
    weightKg: 3.0,
    description: '2 kurtas and 1 jacket from Myntra',
    createdAt: '2026-07-20T09:00:00Z',
    updatedAt: '2026-07-26T14:00:00Z',
  },
  {
    id: 'pr3',
    userId: 'u1',
    tripId: 'trip3',
    trip: parcelTrips[2],
    status: 'pending',
    pickupAddress: 'Bondey, Paro',
    contactNumber: '+975 17876543',
    parcelType: 'document',
    parcelSize: 'small',
    weightKg: 0.5,
    description: 'University documents and certificates',
    createdAt: '2026-07-28T11:00:00Z',
    updatedAt: '2026-07-28T11:00:00Z',
  },
];

export const parcelTypeLabels: Record<string, string> = {
  document: 'Documents',
  electronics: 'Electronics',
  clothing: 'Clothing',
  food: 'Food Items',
  medicine: 'Medicine',
  other: 'Other',
};

export const parcelTypeIcons: Record<string, string> = {
  document: '📄',
  electronics: '💻',
  clothing: '👕',
  food: '🍱',
  medicine: '💊',
  other: '📦',
};

export const parcelSizeLabels: Record<string, string> = {
  small: 'Small (up to 2kg)',
  medium: 'Medium (2-5kg)',
  large: 'Large (5kg+)',
};

export const parcelStatusLabels: Record<string, string> = {
  pending: 'Pending',
  collected: 'Collected',
  in_transit: 'In Transit',
  delivered: 'Delivered',
};

export const parcelStatusColors: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-orange-50', text: 'text-orange-600' },
  collected: { bg: 'bg-blue-50', text: 'text-blue-600' },
  in_transit: { bg: 'bg-violet-50', text: 'text-violet-600' },
  delivered: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
};
