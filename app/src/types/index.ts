// ============ Enums & Base Types ============

export type OrderStatus =
  | 'pending_confirmation'
  | 'quotation_pending'
  | 'quoted'
  | 'payment_pending'
  | 'payment_verified'
  | 'order_placed'
  | 'in_transit'
  | 'arrived_at_hub'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type ProductSource = 'internal' | 'amazon' | 'flipkart' | 'myntra' | 'meesho';

export type UserRole = 'customer' | 'admin';

export type NotificationType = 'order_update' | 'quotation' | 'payment' | 'promotion' | 'system';

export type PaymentMethodType = 'bank_transfer' | 'mobile_wallet';

export type QuotationStatus = 'pending' | 'sent' | 'approved' | 'rejected' | 'expired';

export type PaymentStatus = 'pending' | 'verified' | 'rejected';

export type OrderType = 'catalog' | 'paste_link';

export type BannerPosition = 'home_top' | 'home_mid' | 'catalog_top';

export type BannerLinkType = 'product' | 'category' | 'url' | 'none';

// ============ Product & Catalog ============

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  images: string[];
  categoryId: string;
  subcategoryId?: string;
  source: ProductSource;
  sourceUrl?: string;
  rating: number;
  reviewCount: number;
  inStock: boolean;
  stockQuantity: number;
  attributes: Record<string, string>;
  badge?: 'BESTSELLER' | 'NEW' | 'SALE' | 'HOT';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  image: string;
  parentId?: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  linkType: BannerLinkType;
  linkTarget: string;
  position: BannerPosition;
  startDate: string;
  endDate: string;
  isActive: boolean;
  sortOrder: number;
}

// ============ Cart ============

export interface CartItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  selectedAttributes: Record<string, string>;
  addedAt: string;
}

export interface Cart {
  items: CartItem[];
  deliveryHubId: string;
  couponCode?: string;
}

// ============ User & Address ============

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  role: UserRole;
  dzongkhag: string;
  isActive: boolean;
  createdAt: string;
}

export interface Address {
  id: string;
  userId: string;
  label: string;
  recipientName: string;
  phone: string;
  dzongkhag: string;
  gewog: string;
  village: string;
  landmark?: string;
  isDefault: boolean;
  deliveryHubId: string;
}

export interface DeliveryHub {
  id: string;
  name: string;
  dzongkhag: string;
  address: string;
  phone: string;
  isActive: boolean;
}

// ============ Order ============

export interface OrderItem {
  id: string;
  productId?: string;
  product?: Product;
  sourceUrl?: string;
  sourcePlatform?: string;
  productName: string;
  productImage: string;
  quantity: number;
  unitPrice: number;
  attributes: Record<string, string>;
  notes?: string;
  screenshotUrl?: string;
  attachmentPath?: string;
}

export interface QuotationItem {
  id: string;
  orderItemId: string;
  productName: string;
  productImage: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
}

export interface Quotation {
  id: string;
  orderId: string;
  status: QuotationStatus;
  items: QuotationItem[];
  productTotal: number;
  serviceCharge: number;
  deliveryFee: number;
  taxAmount: number;
  totalAmount: number;
  validUntil: string;
  notes?: string;
  createdAt: string;
  respondedAt?: string;
}

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  method: string;
  transactionId: string;
  screenshotUrl?: string;
  status: PaymentStatus;
  verifiedBy?: string;
  verifiedAt?: string;
  notes?: string;
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  user: User;
  items: OrderItem[];
  status: OrderStatus;
  type: OrderType;
  deliveryHubId: string;
  deliveryHub: DeliveryHub;
  shippingAddress: Address;
  quotation?: Quotation;
  payment?: Payment;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ============ Request Bag / Quote Cart ============

export type RequestBagStatus = 'active' | 'submitted' | 'abandoned';

export interface RequestBagItem {
  id: string;
  bagId: string;
  userId: string;
  sourceUrl?: string;
  sourcePlatform?: string;
  productName: string;
  productImage: string;
  priceShown: number;
  quantity: number;
  notes?: string;
  screenshotPath?: string;
  screenshotUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RequestBag {
  id: string;
  userId: string;
  status: RequestBagStatus;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  customerNotes?: string;
  submittedOrderId?: string;
  items: RequestBagItem[];
  createdAt: string;
  updatedAt: string;
}

// ============ Notification ============

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

// ============ Settings & Configuration ============

export interface DeliveryFeeRule {
  id: string;
  dzongkhag: string;
  hubId: string;
  baseFee: number;
  perKgFee: number;
  estimatedDays: number;
  isActive: boolean;
}

export interface ServiceChargeRule {
  id: string;
  name: string;
  minAmount: number;
  maxAmount: number | null;
  percentage: number;
  flatFee?: number;
  isActive: boolean;
}

export interface PaymentMethod {
  id: string;
  name: string;
  type: PaymentMethodType;
  accountNumber: string;
  accountName: string;
  bankName?: string;
  branch?: string;
  qrImage?: string;
  instructions: string;
  isActive: boolean;
  sortOrder: number;
}

// ============ Paste Link Order ============

export interface PasteLinkItem {
  id: string;
  sourceUrl: string;
  sourcePlatform: ProductSource;
  productName: string;
  productImage?: string;
  price: number;
  quantity: number;
  notes?: string;
}

// ============ FAQ ============

export interface FAQItem {
  id: string;
  category: string;
  question: string;
  answer: string;
  sortOrder: number;
}

// ============ Review ============

export interface Review {
  id: string;
  productId: string;
  userName: string;
  avatar?: string;
  rating: number;
  comment: string;
  date: string;
}

// ============ Admin Dashboard ============

export interface DashboardStats {
  totalOrders: number;
  totalOrdersChange: number;
  pendingQuotations: number;
  revenue: number;
  revenueChange: number;
  activeCustomers: number;
  newCustomers: number;
}

export interface RevenueDataPoint {
  date: string;
  amount: number;
}

export interface OrderStatusCount {
  status: OrderStatus;
  count: number;
  color: string;
}

export interface TopProduct {
  id: string;
  name: string;
  unitsSold: number;
  revenue: number;
}

export interface CustomerStats {
  totalOrders: number;
  totalSpent: number;
  avgOrderValue: number;
}

export * from './parcel';
