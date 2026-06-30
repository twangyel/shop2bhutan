import type {
  Product, Category, Banner, Cart, Address, DeliveryHub, Order,
  User, Notification, DeliveryFeeRule,
  ServiceChargeRule, PaymentMethod, FAQItem, Review, PasteLinkItem,
  DashboardStats, RevenueDataPoint, OrderStatusCount, TopProduct
} from '@/types';

// ============ Constants ============

export const DZONGKHAGS = [
  'Bumthang', 'Chhukha', 'Dagana', 'Gasa', 'Haa', 'Lhuntse', 'Mongar',
  'Paro', 'Pema Gatshel', 'Punakha', 'Samdrup Jongkhar', 'Samtse',
  'Sarpang', 'Thimphu', 'Trashigang', 'Trashiyangtse', 'Trongsa',
  'Tsirang', 'Wangdue Phodrang', 'Zhemgang'
];

// ============ Users ============

export const currentUser: User = {
  id: 'u1',
  name: 'Karma Dorji',
  email: 'karma.dorji@email.com',
  phone: '+975 17123456',
  avatar: '',
  role: 'customer',
  dzongkhag: 'Thimphu',
  isActive: true,
  createdAt: '2025-01-15T10:00:00Z'
};

export const adminUser: User = {
  id: 'admin1',
  name: 'Admin User',
  email: 'admin@shop2bhutan.com',
  phone: '+975 17888888',
  role: 'admin',
  dzongkhag: 'Thimphu',
  isActive: true,
  createdAt: '2024-01-01T00:00:00Z'
};

// ============ Categories ============

export const categories: Category[] = [
  { id: 'cat1', name: 'Electronics', icon: 'Smartphone', image: '/images/cat-electronics.jpg', sortOrder: 1, isActive: true },
  { id: 'cat2', name: 'Fashion', icon: 'Shirt', image: '/images/cat-fashion.jpg', sortOrder: 2, isActive: true },
  { id: 'cat3', name: 'Beauty', icon: 'Sparkles', image: '/images/cat-beauty.jpg', sortOrder: 3, isActive: true },
  { id: 'cat4', name: 'Home', icon: 'Home', image: '/images/cat-home.jpg', sortOrder: 4, isActive: true },
  { id: 'cat5', name: 'Sports', icon: 'Dumbbell', image: '/images/cat-sports.jpg', sortOrder: 5, isActive: true },
  { id: 'cat6', name: 'Books', icon: 'BookOpen', image: '/images/cat-books.jpg', sortOrder: 6, isActive: true },
  { id: 'cat7', name: 'Toys', icon: 'ToyBrick', image: '/images/cat-toys.jpg', sortOrder: 7, isActive: true },
  { id: 'cat8', name: 'Groceries', icon: 'Apple', image: '/images/cat-groceries.jpg', sortOrder: 8, isActive: true },
];

// ============ Products ============

export const products: Product[] = [
  {
    id: 'p1', name: 'Wireless Bluetooth Earbuds Pro', description: 'Premium wireless earbuds with active noise cancellation, 30-hour battery life, and crystal-clear sound quality. Perfect for music lovers and professionals.',
    price: 1299, originalPrice: 2499, images: ['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400'], categoryId: 'cat1', rating: 4.5, reviewCount: 328, inStock: true, stockQuantity: 45, attributes: { color: 'Black' }, badge: 'SALE', source: 'internal', isActive: true, createdAt: '2025-12-01T00:00:00Z', updatedAt: '2025-12-01T00:00:00Z'
  },
  {
    id: 'p2', name: 'Smart Fitness Watch Series 5', description: 'Track your health with heart rate monitoring, SpO2, sleep tracking, and 100+ sports modes. Water-resistant up to 50m.',
    price: 3499, originalPrice: 4999, images: ['https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=400'], categoryId: 'cat1', rating: 4.3, reviewCount: 156, inStock: true, stockQuantity: 30, attributes: { color: 'Midnight Black' }, badge: 'BESTSELLER', source: 'internal', isActive: true, createdAt: '2025-11-15T00:00:00Z', updatedAt: '2025-11-15T00:00:00Z'
  },
  {
    id: 'p3', name: 'Portable Bluetooth Speaker 20W', description: 'Powerful 20W speaker with deep bass, IPX7 waterproof, and 12-hour playtime. Perfect for outdoor adventures.',
    price: 1899, images: ['https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400'], categoryId: 'cat1', rating: 4.6, reviewCount: 89, inStock: true, stockQuantity: 60, attributes: { color: 'Blue' }, badge: 'NEW', source: 'internal', isActive: true, createdAt: '2026-01-05T00:00:00Z', updatedAt: '2026-01-05T00:00:00Z'
  },
  {
    id: 'p4', name: 'USB-C Fast Charger 65W', description: 'GaN technology charger with 3 ports. Charges laptop, phone, and tablet simultaneously. Compact and travel-friendly.',
    price: 999, originalPrice: 1499, images: ['https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=400'], categoryId: 'cat1', rating: 4.4, reviewCount: 212, inStock: true, stockQuantity: 80, attributes: { color: 'White' }, source: 'internal', isActive: true, createdAt: '2025-10-20T00:00:00Z', updatedAt: '2025-10-20T00:00:00Z'
  },
  {
    id: 'p5', name: 'LED Desk Lamp with Wireless Charger', description: '3 color modes, 5 brightness levels, built-in 10W wireless charging pad, and USB port. Eye-care technology.',
    price: 1599, images: ['https://images.unsplash.com/photo-1534073828943-f801091a7d58?w=400'], categoryId: 'cat4', rating: 4.7, reviewCount: 67, inStock: true, stockQuantity: 25, attributes: { color: 'White' }, badge: 'NEW', source: 'internal', isActive: true, createdAt: '2026-01-10T00:00:00Z', updatedAt: '2026-01-10T00:00:00Z'
  },
  {
    id: 'p6', name: 'Cotton Kurta Set for Women', description: 'Elegant hand-block printed cotton kurta with matching dupatta and pants. Comfortable for daily wear and special occasions.',
    price: 1899, originalPrice: 2999, images: ['https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400'], categoryId: 'cat2', rating: 4.2, reviewCount: 145, inStock: true, stockQuantity: 35, attributes: { color: 'Maroon', size: 'M' }, badge: 'SALE', source: 'internal', isActive: true, createdAt: '2025-09-10T00:00:00Z', updatedAt: '2025-09-10T00:00:00Z'
  },
  {
    id: 'p7', name: 'Men\'s Casual Sneakers', description: 'Breathable mesh upper, cushioned insole, anti-skid rubber outsole. Perfect for casual outings and light workouts.',
    price: 2199, images: ['https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400'], categoryId: 'cat2', rating: 4.3, reviewCount: 198, inStock: true, stockQuantity: 50, attributes: { color: 'Gray', size: '42' }, badge: 'BESTSELLER', source: 'internal', isActive: true, createdAt: '2025-08-15T00:00:00Z', updatedAt: '2025-08-15T00:00:00Z'
  },
  {
    id: 'p8', name: 'Silk Scarf - Traditional Bhutanese Pattern', description: 'Handcrafted silk scarf featuring traditional Bhutanese motifs. A beautiful accessory that celebrates Bhutanese heritage.',
    price: 1299, images: ['https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=400'], categoryId: 'cat2', rating: 4.8, reviewCount: 42, inStock: true, stockQuantity: 15, attributes: { color: 'Multi' }, badge: 'NEW', source: 'internal', isActive: true, createdAt: '2026-01-08T00:00:00Z', updatedAt: '2026-01-08T00:00:00Z'
  },
  {
    id: 'p9', name: 'Vitamin C Serum 30ml', description: '20% Vitamin C with Hyaluronic Acid and Vitamin E. Brightens skin, reduces dark spots, and fights aging.',
    price: 699, originalPrice: 999, images: ['https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400'], categoryId: 'cat3', rating: 4.5, reviewCount: 534, inStock: true, stockQuantity: 100, attributes: { size: '30ml' }, badge: 'SALE', source: 'internal', isActive: true, createdAt: '2025-07-20T00:00:00Z', updatedAt: '2025-07-20T00:00:00Z'
  },
  {
    id: 'p10', name: 'Organic Face Wash with Neem', description: 'Gentle, SLS-free face wash with neem and tea tree. Controls acne and keeps skin fresh. Suitable for all skin types.',
    price: 349, images: ['https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400'], categoryId: 'cat3', rating: 4.3, reviewCount: 287, inStock: true, stockQuantity: 75, attributes: { size: '150ml' }, source: 'internal', isActive: true, createdAt: '2025-06-15T00:00:00Z', updatedAt: '2025-06-15T00:00:00Z'
  },
  {
    id: 'p11', name: 'Perfume Gift Set - 4pc', description: 'Set of 4 premium fragrances: Floral, Woody, Oriental, and Fresh. 15ml each. Perfect gift for loved ones.',
    price: 1499, originalPrice: 2499, images: ['https://images.unsplash.com/photo-1541643600914-78b084683601?w=400'], categoryId: 'cat3', rating: 4.1, reviewCount: 78, inStock: true, stockQuantity: 40, attributes: {}, badge: 'SALE', source: 'internal', isActive: true, createdAt: '2025-11-01T00:00:00Z', updatedAt: '2025-11-01T00:00:00Z'
  },
  {
    id: 'p12', name: 'Aromatherapy Diffuser', description: 'Ultrasonic essential oil diffuser with 7 LED colors, timer, and auto-shutoff. 300ml capacity, runs up to 10 hours.',
    price: 1299, images: ['https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=400'], categoryId: 'cat4', rating: 4.6, reviewCount: 134, inStock: true, stockQuantity: 30, attributes: { color: 'Wood Grain' }, badge: 'NEW', source: 'internal', isActive: true, createdAt: '2026-01-03T00:00:00Z', updatedAt: '2026-01-03T00:00:00Z'
  },
  {
    id: 'p13', name: 'Non-Stick Cookware Set - 5pc', description: '5-piece cookware set with granite coating. Includes kadai, fry pan, tawa, sauce pan, and spatula. Induction friendly.',
    price: 2499, originalPrice: 3999, images: ['https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=400'], categoryId: 'cat4', rating: 4.4, reviewCount: 201, inStock: true, stockQuantity: 20, attributes: { color: 'Black' }, badge: 'SALE', source: 'internal', isActive: true, createdAt: '2025-05-10T00:00:00Z', updatedAt: '2025-05-10T00:00:00Z'
  },
  {
    id: 'p14', name: 'Bamboo Storage Organizers - Set of 6', description: 'Eco-friendly bamboo organizers for kitchen, office, or bathroom. Stackable design, various sizes.',
    price: 899, images: ['https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400'], categoryId: 'cat4', rating: 4.5, reviewCount: 156, inStock: true, stockQuantity: 45, attributes: {}, badge: 'BESTSELLER', source: 'internal', isActive: true, createdAt: '2025-09-25T00:00:00Z', updatedAt: '2025-09-25T00:00:00Z'
  },
  {
    id: 'p15', name: 'Yoga Mat - 6mm Thick', description: 'Eco-friendly TPE yoga mat with alignment lines. Non-slip, lightweight, with carrying strap. 183×61cm.',
    price: 799, originalPrice: 1299, images: ['https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=400'], categoryId: 'cat5', rating: 4.4, reviewCount: 312, inStock: true, stockQuantity: 55, attributes: { color: 'Purple' }, badge: 'SALE', source: 'internal', isActive: true, createdAt: '2025-04-20T00:00:00Z', updatedAt: '2025-04-20T00:00:00Z'
  },
  {
    id: 'p16', name: 'Resistance Bands Set', description: '5 resistance levels, loop bands with door anchor and handles. Full-body workout at home.',
    price: 599, images: ['https://images.unsplash.com/photo-1598289431512-b97b0917affc?w=400'], categoryId: 'cat5', rating: 4.2, reviewCount: 178, inStock: true, stockQuantity: 65, attributes: {}, badge: 'HOT', source: 'internal', isActive: true, createdAt: '2025-10-05T00:00:00Z', updatedAt: '2025-10-05T00:00:00Z'
  },
  {
    id: 'p17', name: '"The Bhutanese Guide to Happiness"', description: 'A profound exploration of Gross National Happiness and how to apply its principles in daily life.',
    price: 499, images: ['https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400'], categoryId: 'cat6', rating: 4.9, reviewCount: 89, inStock: true, stockQuantity: 25, attributes: {}, source: 'internal', isActive: true, createdAt: '2025-03-15T00:00:00Z', updatedAt: '2025-03-15T00:00:00Z'
  },
  {
    id: 'p18', name: 'Children\'s Illustrated Storybook Collection', description: 'Set of 10 beautifully illustrated moral stories for children aged 4-8. Hardcover, premium paper.',
    price: 1299, originalPrice: 1999, images: ['https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400'], categoryId: 'cat6', rating: 4.7, reviewCount: 56, inStock: true, stockQuantity: 30, attributes: {}, badge: 'SALE', source: 'internal', isActive: true, createdAt: '2025-08-01T00:00:00Z', updatedAt: '2025-08-01T00:00:00Z'
  },
  {
    id: 'p19', name: 'Educational Building Blocks - 100pc', description: 'Colorful wooden building blocks in various shapes. Develops motor skills and creativity. Non-toxic paint.',
    price: 899, images: ['https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=400'], categoryId: 'cat7', rating: 4.6, reviewCount: 123, inStock: true, stockQuantity: 40, attributes: {}, badge: 'BESTSELLER', source: 'internal', isActive: true, createdAt: '2025-07-01T00:00:00Z', updatedAt: '2025-07-01T00:00:00Z'
  },
  {
    id: 'p20', name: 'Remote Control Car - Off Road', description: '1:16 scale RC car with 4WD, 2.4GHz remote, 30km/h speed. Rechargeable battery, 30min playtime.',
    price: 2199, originalPrice: 3499, images: ['https://images.unsplash.com/photo-1594787318286-3d835c1d207f?w=400'], categoryId: 'cat7', rating: 4.3, reviewCount: 89, inStock: true, stockQuantity: 22, attributes: { color: 'Red' }, badge: 'SALE', source: 'internal', isActive: true, createdAt: '2025-11-20T00:00:00Z', updatedAt: '2025-11-20T00:00:00Z'
  },
  {
    id: 'p21', name: 'Organic Green Tea - 250g', description: 'Premium organic green tea from Darjeeling. Rich in antioxidants, soothing flavor. Loose leaf.',
    price: 449, images: ['https://images.unsplash.com/photo-1627435601361-ec25f5b1d0e5?w=400'], categoryId: 'cat8', rating: 4.5, reviewCount: 234, inStock: true, stockQuantity: 80, attributes: {}, source: 'internal', isActive: true, createdAt: '2025-06-01T00:00:00Z', updatedAt: '2025-06-01T00:00:00Z'
  },
  {
    id: 'p22', name: 'Mixed Dry Fruits Pack - 1kg', description: 'Premium mix of almonds, cashews, raisins, pistachios, and walnuts. Vacuum packed for freshness.',
    price: 1299, originalPrice: 1599, images: ['https://images.unsplash.com/photo-1600189020840-e9918c25268d?w=400'], categoryId: 'cat8', rating: 4.4, reviewCount: 167, inStock: true, stockQuantity: 50, attributes: {}, badge: 'SALE', source: 'internal', isActive: true, createdAt: '2025-10-15T00:00:00Z', updatedAt: '2025-10-15T00:00:00Z'
  },
  {
    id: 'p23', name: 'Basmati Rice - 5kg Premium', description: 'Long-grain aged basmati rice. Aromatic, fluffy, perfect for biryani and daily meals.',
    price: 699, images: ['https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400'], categoryId: 'cat8', rating: 4.3, reviewCount: 445, inStock: true, stockQuantity: 100, attributes: {}, badge: 'BESTSELLER', source: 'internal', isActive: true, createdAt: '2025-05-01T00:00:00Z', updatedAt: '2025-05-01T00:00:00Z'
  },
  {
    id: 'p24', name: 'Wireless Mouse - Ergonomic', description: '2.4GHz wireless mouse with ergonomic design. 1600 DPI, 12-month battery life. Silent clicks.',
    price: 499, originalPrice: 799, images: ['https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400'], categoryId: 'cat1', rating: 4.2, reviewCount: 567, inStock: true, stockQuantity: 90, attributes: { color: 'Black' }, badge: 'SALE', source: 'internal', isActive: true, createdAt: '2025-09-01T00:00:00Z', updatedAt: '2025-09-01T00:00:00Z'
  },
];

// ============ Banners ============

export const banners: Banner[] = [
  { id: 'b1', title: 'New Year Sale', subtitle: 'Up to 50% off on electronics', image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800', linkType: 'category', linkTarget: 'cat1', position: 'home_top', startDate: '2026-01-01', endDate: '2026-01-31', isActive: true, sortOrder: 1 },
  { id: 'b2', title: 'Free Delivery', subtitle: 'On your first order above Nu. 2000', image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800', linkType: 'url', linkTarget: '/catalog', position: 'home_top', startDate: '2026-01-01', endDate: '2026-03-31', isActive: true, sortOrder: 2 },
  { id: 'b3', title: 'Fashion Week', subtitle: 'Latest trends from India', image: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=800', linkType: 'category', linkTarget: 'cat2', position: 'home_top', startDate: '2026-01-10', endDate: '2026-01-20', isActive: true, sortOrder: 3 },
  { id: 'b4', title: 'Home Essentials', subtitle: 'Transform your living space', image: 'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=800', linkType: 'category', linkTarget: 'cat4', position: 'home_mid', startDate: '2026-01-01', endDate: '2026-02-28', isActive: true, sortOrder: 1 },
  { id: 'b5', title: 'Organic Groceries', subtitle: 'Fresh from farm to your home', image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800', linkType: 'category', linkTarget: 'cat8', position: 'catalog_top', startDate: '2026-01-01', endDate: '2026-06-30', isActive: true, sortOrder: 1 },
];

// ============ Delivery Hubs ============

export const deliveryHubs: DeliveryHub[] = [
  { id: 'hub1', name: 'Thimphu Hub', dzongkhag: 'Thimphu', address: 'Changzamtog, Thimphu', phone: '+975 2321123', isActive: true },
  { id: 'hub2', name: 'Phuntsholing Hub', dzongkhag: 'Chhukha', address: 'Near Bus Stand, Phuntsholing', phone: '+975 5251123', isActive: true },
  { id: 'hub3', name: 'Paro Hub', dzongkhag: 'Paro', address: 'Bondey, Paro', phone: '+975 8271123', isActive: true },
];

// ============ Addresses ============

export const addresses: Address[] = [
  {
    id: 'a1', userId: 'u1', label: 'Home', recipientName: 'Karma Dorji', phone: '+975 17123456',
    dzongkhag: 'Thimphu', gewog: 'Chang', village: 'Changzamtog', landmark: 'Near Druk School',
    isDefault: true, deliveryHubId: 'hub1'
  },
  {
    id: 'a2', userId: 'u1', label: 'Office', recipientName: 'Karma Dorji', phone: '+975 17123456',
    dzongkhag: 'Thimphu', gewog: 'Kawang', village: 'Motithang', landmark: 'Above Gas Station',
    isDefault: false, deliveryHubId: 'hub1'
  },
  {
    id: 'a3', userId: 'u1', label: 'Parents Home', recipientName: 'Sonam Dorji', phone: '+975 17876543',
    dzongkhag: 'Paro', gewog: 'Dopshari', village: 'Dopshari', landmark: 'Near Lhakhang',
    isDefault: false, deliveryHubId: 'hub3'
  },
];

// ============ Cart ============

export const defaultCart: Cart = {
  items: [
    {
      id: 'ci1', productId: 'p1', product: products[0], quantity: 1, selectedAttributes: { color: 'Black' }, addedAt: '2026-01-18T10:00:00Z'
    },
    {
      id: 'ci2', productId: 'p9', product: products[8], quantity: 2, selectedAttributes: { size: '30ml' }, addedAt: '2026-01-18T10:05:00Z'
    },
    {
      id: 'ci3', productId: 'p15', product: products[14], quantity: 1, selectedAttributes: { color: 'Purple' }, addedAt: '2026-01-18T10:10:00Z'
    },
  ],
  deliveryHubId: 'hub1',
};

// ============ Orders ============

export const orders: Order[] = [
  {
    id: 'o1', orderNumber: 'S2B-20260001', userId: 'u1', user: currentUser,
    items: [
      { id: 'oi1', productId: 'p1', product: products[0], productName: products[0].name, productImage: products[0].images[0], quantity: 1, unitPrice: 1299, attributes: {} },
      { id: 'oi2', productId: 'p9', product: products[8], productName: products[8].name, productImage: products[8].images[0], quantity: 2, unitPrice: 699, attributes: {} },
    ],
    status: 'delivered', type: 'catalog', deliveryHubId: 'hub1', deliveryHub: deliveryHubs[0],
    shippingAddress: addresses[0],
    quotation: {
      id: 'q1', orderId: 'o1', status: 'approved', items: [
        { id: 'qi1', orderItemId: 'oi1', productName: products[0].name, productImage: products[0].images[0], quantity: 1, unitPrice: 1299, totalPrice: 1299 },
        { id: 'qi2', orderItemId: 'oi2', productName: products[8].name, productImage: products[8].images[0], quantity: 2, unitPrice: 699, totalPrice: 1398 },
      ],
      productTotal: 2697, serviceCharge: 200, deliveryFee: 150, taxAmount: 135, totalAmount: 3182,
      validUntil: '2026-01-12T00:00:00Z', createdAt: '2026-01-10T12:00:00Z', respondedAt: '2026-01-10T14:30:00Z'
    },
    payment: {
      id: 'pay1', orderId: 'o1', amount: 3182, method: 'MBob', transactionId: 'MB123456789',
      status: 'verified', verifiedBy: 'admin1', verifiedAt: '2026-01-10T16:00:00Z', createdAt: '2026-01-10T15:00:00Z'
    },
    createdAt: '2026-01-10T08:00:00Z', updatedAt: '2026-01-15T10:00:00Z'
  },
  {
    id: 'o2', orderNumber: 'S2B-20260002', userId: 'u1', user: currentUser,
    items: [
      { id: 'oi3', productId: 'p7', product: products[6], productName: products[6].name, productImage: products[6].images[0], quantity: 1, unitPrice: 2199, attributes: {} },
    ],
    status: 'in_transit', type: 'catalog', deliveryHubId: 'hub1', deliveryHub: deliveryHubs[0],
    shippingAddress: addresses[0],
    quotation: {
      id: 'q2', orderId: 'o2', status: 'approved', items: [
        { id: 'qi3', orderItemId: 'oi3', productName: products[6].name, productImage: products[6].images[0], quantity: 1, unitPrice: 2199, totalPrice: 2199 },
      ],
      productTotal: 2199, serviceCharge: 180, deliveryFee: 150, taxAmount: 110, totalAmount: 2639,
      validUntil: '2026-01-18T00:00:00Z', createdAt: '2026-01-16T10:00:00Z', respondedAt: '2026-01-16T12:00:00Z'
    },
    payment: {
      id: 'pay2', orderId: 'o2', amount: 2639, method: 'Bank Transfer', transactionId: 'BT987654321',
      status: 'verified', verifiedBy: 'admin1', verifiedAt: '2026-01-16T15:00:00Z', createdAt: '2026-01-16T14:00:00Z'
    },
    createdAt: '2026-01-16T08:00:00Z', updatedAt: '2026-01-20T06:00:00Z'
  },
  {
    id: 'o3', orderNumber: 'S2B-20260003', userId: 'u1', user: currentUser,
    items: [
      { id: 'oi4', sourceUrl: 'https://amazon.in/dp/B08N5WRWNW', sourcePlatform: 'amazon', productName: 'Sony WH-1000XM4 Headphones', productImage: 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=400', quantity: 1, unitPrice: 24990, attributes: {} },
    ],
    status: 'quoted', type: 'paste_link', deliveryHubId: 'hub1', deliveryHub: deliveryHubs[0],
    shippingAddress: addresses[0],
    quotation: {
      id: 'q3', orderId: 'o3', status: 'sent', items: [
        { id: 'qi4', orderItemId: 'oi4', productName: 'Sony WH-1000XM4 Headphones', productImage: 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=400', quantity: 1, unitPrice: 26200, totalPrice: 26200 },
      ],
      productTotal: 26200, serviceCharge: 1800, deliveryFee: 400, taxAmount: 1310, totalAmount: 29710,
      validUntil: '2026-01-25T00:00:00Z', createdAt: '2026-01-22T10:00:00Z'
    },
    createdAt: '2026-01-20T14:00:00Z', updatedAt: '2026-01-22T10:00:00Z'
  },
  {
    id: 'o4', orderNumber: 'S2B-20260004', userId: 'u1', user: currentUser,
    items: [
      { id: 'oi5', productId: 'p5', product: products[4], productName: products[4].name, productImage: products[4].images[0], quantity: 1, unitPrice: 1599, attributes: {} },
      { id: 'oi6', productId: 'p12', product: products[11], productName: products[11].name, productImage: products[11].images[0], quantity: 1, unitPrice: 1299, attributes: {} },
    ],
    status: 'payment_pending', type: 'catalog', deliveryHubId: 'hub1', deliveryHub: deliveryHubs[0],
    shippingAddress: addresses[0],
    quotation: {
      id: 'q4', orderId: 'o4', status: 'approved', items: [
        { id: 'qi5', orderItemId: 'oi5', productName: products[4].name, productImage: products[4].images[0], quantity: 1, unitPrice: 1599, totalPrice: 1599 },
        { id: 'qi6', orderItemId: 'oi6', productName: products[11].name, productImage: products[11].images[0], quantity: 1, unitPrice: 1299, totalPrice: 1299 },
      ],
      productTotal: 2898, serviceCharge: 220, deliveryFee: 150, taxAmount: 145, totalAmount: 3413,
      validUntil: '2026-01-28T00:00:00Z', createdAt: '2026-01-23T09:00:00Z', respondedAt: '2026-01-23T11:00:00Z'
    },
    createdAt: '2026-01-21T16:00:00Z', updatedAt: '2026-01-23T11:00:00Z'
  },
  {
    id: 'o5', orderNumber: 'S2B-20260005', userId: 'u1', user: currentUser,
    items: [
      { id: 'oi7', sourceUrl: 'https://flipkart.com/p/itm123', sourcePlatform: 'flipkart', productName: 'Samsung Galaxy Tablet A9', productImage: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400', quantity: 1, unitPrice: 15999, attributes: {} },
    ],
    status: 'quotation_pending', type: 'paste_link', deliveryHubId: 'hub1', deliveryHub: deliveryHubs[0],
    shippingAddress: addresses[1],
    createdAt: '2026-01-22T10:00:00Z', updatedAt: '2026-01-22T10:00:00Z'
  },
  {
    id: 'o6', orderNumber: 'S2B-20260006', userId: 'u1', user: currentUser,
    items: [
      { id: 'oi8', productId: 'p17', product: products[16], productName: products[16].name, productImage: products[16].images[0], quantity: 2, unitPrice: 499, attributes: {} },
    ],
    status: 'arrived_at_hub', type: 'catalog', deliveryHubId: 'hub3', deliveryHub: deliveryHubs[2],
    shippingAddress: addresses[2],
    quotation: {
      id: 'q5', orderId: 'o6', status: 'approved', items: [
        { id: 'qi7', orderItemId: 'oi8', productName: products[16].name, productImage: products[16].images[0], quantity: 2, unitPrice: 499, totalPrice: 998 },
      ],
      productTotal: 998, serviceCharge: 120, deliveryFee: 200, taxAmount: 50, totalAmount: 1368,
      validUntil: '2026-01-20T00:00:00Z', createdAt: '2026-01-18T08:00:00Z', respondedAt: '2026-01-18T10:00:00Z'
    },
    payment: {
      id: 'pay3', orderId: 'o6', amount: 1368, method: 'BPay', transactionId: 'BP456789123',
      status: 'verified', verifiedAt: '2026-01-18T14:00:00Z', createdAt: '2026-01-18T12:00:00Z'
    },
    createdAt: '2026-01-17T09:00:00Z', updatedAt: '2026-01-24T08:00:00Z'
  },
  {
    id: 'o7', orderNumber: 'S2B-20260007', userId: 'u1', user: currentUser,
    items: [
      { id: 'oi9', productId: 'p21', product: products[20], productName: products[20].name, productImage: products[20].images[0], quantity: 3, unitPrice: 449, attributes: {} },
      { id: 'oi10', productId: 'p22', product: products[21], productName: products[21].name, productImage: products[21].images[0], quantity: 1, unitPrice: 1299, attributes: {} },
    ],
    status: 'out_for_delivery', type: 'catalog', deliveryHubId: 'hub1', deliveryHub: deliveryHubs[0],
    shippingAddress: addresses[0],
    quotation: {
      id: 'q6', orderId: 'o7', status: 'approved', items: [
        { id: 'qi8', orderItemId: 'oi9', productName: products[20].name, productImage: products[20].images[0], quantity: 3, unitPrice: 449, totalPrice: 1347 },
        { id: 'qi9', orderItemId: 'oi10', productName: products[21].name, productImage: products[21].images[0], quantity: 1, unitPrice: 1299, totalPrice: 1299 },
      ],
      productTotal: 2646, serviceCharge: 200, deliveryFee: 150, taxAmount: 132, totalAmount: 3128,
      validUntil: '2026-01-24T00:00:00Z', createdAt: '2026-01-22T08:00:00Z', respondedAt: '2026-01-22T10:00:00Z'
    },
    payment: {
      id: 'pay4', orderId: 'o7', amount: 3128, method: 'MBob', transactionId: 'MB789123456',
      status: 'verified', verifiedAt: '2026-01-22T14:00:00Z', createdAt: '2026-01-22T12:00:00Z'
    },
    createdAt: '2026-01-21T08:00:00Z', updatedAt: '2026-01-25T06:00:00Z'
  },
  {
    id: 'o8', orderNumber: 'S2B-20260008', userId: 'u1', user: currentUser,
    items: [
      { id: 'oi11', productId: 'p3', product: products[2], productName: products[2].name, productImage: products[2].images[0], quantity: 1, unitPrice: 1899, attributes: {} },
    ],
    status: 'order_placed', type: 'catalog', deliveryHubId: 'hub2', deliveryHub: deliveryHubs[1],
    shippingAddress: addresses[0],
    quotation: {
      id: 'q7', orderId: 'o8', status: 'approved', items: [
        { id: 'qi10', orderItemId: 'oi11', productName: products[2].name, productImage: products[2].images[0], quantity: 1, unitPrice: 1899, totalPrice: 1899 },
      ],
      productTotal: 1899, serviceCharge: 160, deliveryFee: 250, taxAmount: 95, totalAmount: 2404,
      validUntil: '2026-01-26T00:00:00Z', createdAt: '2026-01-24T10:00:00Z', respondedAt: '2026-01-24T12:00:00Z'
    },
    payment: {
      id: 'pay5', orderId: 'o8', amount: 2404, method: 'Bank Transfer', transactionId: 'BT111222333',
      status: 'verified', verifiedAt: '2026-01-24T16:00:00Z', createdAt: '2026-01-24T14:00:00Z'
    },
    createdAt: '2026-01-23T10:00:00Z', updatedAt: '2026-01-26T04:00:00Z'
  },
  {
    id: 'o9', orderNumber: 'S2B-20260009', userId: 'u1', user: currentUser,
    items: [
      { id: 'oi12', sourceUrl: 'https://myntra.com/p/fashion123', sourcePlatform: 'myntra', productName: 'Designer Silk Saree', productImage: 'https://images.unsplash.com/photo-1610030469983-98e36082c7c5?w=400', quantity: 1, unitPrice: 5999, attributes: {} },
    ],
    status: 'pending_confirmation', type: 'paste_link', deliveryHubId: 'hub1', deliveryHub: deliveryHubs[0],
    shippingAddress: addresses[0],
    createdAt: '2026-01-24T12:00:00Z', updatedAt: '2026-01-24T12:00:00Z'
  },
  {
    id: 'o10', orderNumber: 'S2B-20260010', userId: 'u1', user: currentUser,
    items: [
      { id: 'oi13', productId: 'p19', product: products[18], productName: products[18].name, productImage: products[18].images[0], quantity: 1, unitPrice: 899, attributes: {} },
      { id: 'oi14', productId: 'p20', product: products[19], productName: products[19].name, productImage: products[19].images[0], quantity: 1, unitPrice: 2199, attributes: {} },
    ],
    status: 'cancelled', type: 'catalog', deliveryHubId: 'hub1', deliveryHub: deliveryHubs[0],
    shippingAddress: addresses[0],
    createdAt: '2026-01-15T08:00:00Z', updatedAt: '2026-01-16T10:00:00Z'
  },
  {
    id: 'o11', orderNumber: 'S2B-20260011', userId: 'u1', user: currentUser,
    items: [
      { id: 'oi15', productId: 'p6', product: products[5], productName: products[5].name, productImage: products[5].images[0], quantity: 2, unitPrice: 1899, attributes: { color: 'Maroon', size: 'M' } },
    ],
    status: 'payment_verified', type: 'catalog', deliveryHubId: 'hub3', deliveryHub: deliveryHubs[2],
    shippingAddress: addresses[2],
    quotation: {
      id: 'q8', orderId: 'o11', status: 'approved', items: [
        { id: 'qi11', orderItemId: 'oi15', productName: products[5].name, productImage: products[5].images[0], quantity: 2, unitPrice: 1899, totalPrice: 3798 },
      ],
      productTotal: 3798, serviceCharge: 280, deliveryFee: 200, taxAmount: 190, totalAmount: 4468,
      validUntil: '2026-01-27T00:00:00Z', createdAt: '2026-01-25T08:00:00Z', respondedAt: '2026-01-25T10:00:00Z'
    },
    payment: {
      id: 'pay6', orderId: 'o11', amount: 4468, method: 'MBob', transactionId: 'MB444555666',
      status: 'verified', verifiedBy: 'admin1', verifiedAt: '2026-01-25T16:00:00Z', createdAt: '2026-01-25T14:00:00Z'
    },
    createdAt: '2026-01-24T08:00:00Z', updatedAt: '2026-01-25T16:00:00Z'
  },
  {
    id: 'o12', orderNumber: 'S2B-20260012', userId: 'u1', user: currentUser,
    items: [
      { id: 'oi16', productId: 'p23', product: products[22], productName: products[22].name, productImage: products[22].images[0], quantity: 2, unitPrice: 699, attributes: {} },
      { id: 'oi17', productId: 'p16', product: products[15], productName: products[15].name, productImage: products[15].images[0], quantity: 1, unitPrice: 599, attributes: {} },
    ],
    status: 'in_transit', type: 'catalog', deliveryHubId: 'hub2', deliveryHub: deliveryHubs[1],
    shippingAddress: addresses[0],
    quotation: {
      id: 'q9', orderId: 'o12', status: 'approved', items: [
        { id: 'qi12', orderItemId: 'oi16', productName: products[22].name, productImage: products[22].images[0], quantity: 2, unitPrice: 699, totalPrice: 1398 },
        { id: 'qi13', orderItemId: 'oi17', productName: products[15].name, productImage: products[15].images[0], quantity: 1, unitPrice: 599, totalPrice: 599 },
      ],
      productTotal: 1997, serviceCharge: 170, deliveryFee: 250, taxAmount: 100, totalAmount: 2517,
      validUntil: '2026-01-28T00:00:00Z', createdAt: '2026-01-26T08:00:00Z', respondedAt: '2026-01-26T10:00:00Z'
    },
    payment: {
      id: 'pay7', orderId: 'o12', amount: 2517, method: 'BPay', transactionId: 'BP777888999',
      status: 'verified', verifiedBy: 'admin1', verifiedAt: '2026-01-26T16:00:00Z', createdAt: '2026-01-26T14:00:00Z'
    },
    createdAt: '2026-01-25T10:00:00Z', updatedAt: '2026-01-27T04:00:00Z'
  },
];

// ============ Notifications ============

export const notifications: Notification[] = [
  { id: 'n1', userId: 'u1', type: 'order_update', title: 'Order Delivered', message: 'Your order #S2B-20260001 has been delivered successfully.', link: '/order/o1', isRead: false, createdAt: '2026-01-15T10:00:00Z' },
  { id: 'n2', userId: 'u1', type: 'quotation', title: 'Quotation Received', message: 'A new quotation is ready for your order #S2B-20260003. Review and approve before it expires.', link: '/quotation/o3', isRead: false, createdAt: '2026-01-22T10:00:00Z' },
  { id: 'n3', userId: 'u1', type: 'payment', title: 'Payment Verified', message: 'Your payment of Nu. 2,639 for order #S2B-20260002 has been verified.', link: '/order/o2', isRead: true, createdAt: '2026-01-16T16:00:00Z' },
  { id: 'n4', userId: 'u1', type: 'order_update', title: 'Order Arrived at Hub', message: 'Your order #S2B-20260006 has arrived at Paro Hub. Ready for pickup soon.', link: '/order/o6', isRead: false, createdAt: '2026-01-24T08:00:00Z' },
  { id: 'n5', userId: 'u1', type: 'promotion', title: 'Weekend Flash Sale!', message: 'Get up to 40% off on electronics this weekend only. Don\'t miss out!', link: '/catalog', isRead: true, createdAt: '2026-01-23T09:00:00Z' },
  { id: 'n6', userId: 'u1', type: 'order_update', title: 'Out for Delivery', message: 'Your order #S2B-20260007 is out for delivery. Expected today.', link: '/order/o7', isRead: false, createdAt: '2026-01-25T06:00:00Z' },
  { id: 'n7', userId: 'u1', type: 'system', title: 'App Updated', message: 'Shop2Bhutan has been updated with new features. Check out the improved order tracking!', isRead: true, createdAt: '2026-01-20T00:00:00Z' },
  { id: 'n8', userId: 'u1', type: 'quotation', title: 'Quotation Approved', message: 'You approved the quotation for order #S2B-20260004. Please upload your payment.', link: '/payment/o4', isRead: true, createdAt: '2026-01-23T11:00:00Z' },
];

// ============ Delivery Fee Rules ============

export const deliveryFeeRules: DeliveryFeeRule[] = DZONGKHAGS.map((dz, i) => ({
  id: `dfr${i + 1}`,
  dzongkhag: dz,
  hubId: dz === 'Paro' ? 'hub3' : dz === 'Chhukha' ? 'hub2' : 'hub1',
  baseFee: dz === 'Thimphu' || dz === 'Paro' || dz === 'Chhukha' ? 100 : dz === 'Haa' || dz === 'Punakha' || dz === 'Wangdue Phodrang' ? 150 : 200,
  perKgFee: dz === 'Thimphu' || dz === 'Paro' || dz === 'Chhukha' ? 30 : 50,
  estimatedDays: dz === 'Thimphu' || dz === 'Paro' || dz === 'Chhukha' ? 2 : dz === 'Haa' || dz === 'Punakha' || dz === 'Wangdue Phodrang' ? 3 : 5,
  isActive: true
}));

// ============ Service Charge Rules ============

export const serviceChargeRules: ServiceChargeRule[] = [
  { id: 'scr1', name: 'Small Orders', minAmount: 0, maxAmount: 999, percentage: 10, flatFee: 50, isActive: true },
  { id: 'scr2', name: 'Medium Orders', minAmount: 1000, maxAmount: 4999, percentage: 8, flatFee: 0, isActive: true },
  { id: 'scr3', name: 'Large Orders', minAmount: 5000, maxAmount: 19999, percentage: 5, flatFee: 0, isActive: true },
  { id: 'scr4', name: 'Bulk Orders', minAmount: 20000, maxAmount: null, percentage: 3, flatFee: 0, isActive: true },
];

// ============ Payment Methods ============

export const paymentMethods: PaymentMethod[] = [
  {
    id: 'pm1', name: 'Bank of Bhutan', type: 'bank_transfer', accountNumber: '1000123456', accountName: 'Shop2Bhutan Pvt Ltd',
    bankName: 'Bank of Bhutan', branch: 'Thimphu Main Branch', instructions: 'Transfer to the above account and upload the screenshot. Mention your order number in remarks.', isActive: true, sortOrder: 1
  },
  {
    id: 'pm2', name: 'MBob', type: 'mobile_wallet', accountNumber: '17123456', accountName: 'Shop2Bhutan',
    instructions: 'Transfer via MBob to 17123456. Upload the transaction screenshot with visible transaction ID.', isActive: true, sortOrder: 2
  },
  {
    id: 'pm3', name: 'BPay', type: 'mobile_wallet', accountNumber: 'S2B2024', accountName: 'Shop2Bhutan',
    instructions: 'Pay via BPay merchant code S2B2024. Screenshot the confirmation page.', isActive: true, sortOrder: 3
  },
];

// ============ FAQs ============

export const faqs: FAQItem[] = [
  { id: 'faq1', category: 'Ordering', question: 'How do I place an order?', answer: 'You can browse our catalog and add items to cart, or paste a product link from Amazon, Flipkart, Myntra, or Meesho. Proceed to checkout, review your quotation, and pay.', sortOrder: 1 },
  { id: 'faq2', category: 'Ordering', question: 'Which Indian websites are supported?', answer: 'We currently support Amazon.in, Flipkart, Myntra, and Meesho. Simply paste the product URL and we will handle the rest.', sortOrder: 2 },
  { id: 'faq3', category: 'Payment', question: 'What payment methods are accepted?', answer: 'We accept Bank of Bhutan transfers, MBob, and BPay. After your quotation is approved, upload a screenshot of your payment.', sortOrder: 3 },
  { id: 'faq4', category: 'Payment', question: 'Is my payment secure?', answer: 'Yes, all payments are verified manually by our team. We only release funds to sellers after confirming your order.', sortOrder: 4 },
  { id: 'faq5', category: 'Delivery', question: 'How long does delivery take?', answer: 'Delivery typically takes 3-7 business days after payment verification. Orders accepted from all 20 dzongkhags. Pickup/delivery hubs currently available in Thimphu, Phuntsholing, and Paro.', sortOrder: 5 },
  { id: 'faq6', category: 'Delivery', question: 'Where can I pick up my order?', answer: 'Orders accepted from all 20 dzongkhags. Pickup/delivery hubs currently available in Thimphu, Phuntsholing, and Paro. Select the nearest hub during checkout.', sortOrder: 6 },
  { id: 'faq7', category: 'Returns', question: 'What is your return policy?', answer: 'We accept returns within 7 days of delivery for damaged or incorrect items. Please contact our support team to initiate a return.', sortOrder: 7 },
  { id: 'faq8', category: 'Returns', question: 'Can I cancel my order?', answer: 'Orders can be cancelled before payment verification. Once the order is placed with the seller, cancellations may not be possible.', sortOrder: 8 },
];

// ============ Reviews ============

export const reviews: Review[] = [
  { id: 'r1', productId: 'p1', userName: 'Pema Wangmo', rating: 5, comment: 'Amazing sound quality for the price! Battery lasts all day. Highly recommend.', date: '2026-01-10' },
  { id: 'r2', productId: 'p1', userName: 'Tenzin Dorji', rating: 4, comment: 'Good earbuds, comfortable fit. Noise cancellation works well on flights.', date: '2026-01-08' },
  { id: 'r3', productId: 'p1', userName: 'Sonam Choden', rating: 5, comment: 'Best purchase this year! The bass is incredible.', date: '2026-01-05' },
  { id: 'r4', productId: 'p2', userName: 'Dorji Tamang', rating: 4, comment: 'Great fitness tracker. Accurate heart rate monitoring.', date: '2026-01-12' },
  { id: 'r5', productId: 'p2', userName: 'Lhamo Yangzom', rating: 5, comment: 'Love the sleep tracking feature. Helps me improve my sleep schedule.', date: '2026-01-09' },
];

// ============ Paste Link Items ============

export const pasteLinkItems: PasteLinkItem[] = [
  { id: 'pli1', sourceUrl: 'https://amazon.in/dp/B08N5WRWNW', sourcePlatform: 'amazon', productName: 'Sony WH-1000XM4 Headphones', productImage: 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=400', price: 24990, quantity: 1 },
  { id: 'pli2', sourceUrl: 'https://flipkart.com/p/itm123', sourcePlatform: 'flipkart', productName: 'Samsung Galaxy Tablet A9', productImage: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400', price: 15999, quantity: 1 },
];

// ============ Admin Dashboard Data ============

export const dashboardStats: DashboardStats = {
  totalOrders: 1284,
  totalOrdersChange: 12,
  pendingQuotations: 24,
  revenue: 420000,
  revenueChange: 8,
  activeCustomers: 386,
  newCustomers: 23,
};

export const revenueData: RevenueDataPoint[] = [
  { date: 'Jan 18', amount: 42000 }, { date: 'Jan 19', amount: 38000 }, { date: 'Jan 20', amount: 55000 },
  { date: 'Jan 21', amount: 48000 }, { date: 'Jan 22', amount: 62000 }, { date: 'Jan 23', amount: 45000 },
  { date: 'Jan 24', amount: 51000 },
];

export const orderStatusCounts: OrderStatusCount[] = [
  { status: 'pending_confirmation', count: 18, color: '#F97316' },
  { status: 'quotation_pending', count: 24, color: '#F59E0B' },
  { status: 'quoted', count: 15, color: '#8B5CF6' },
  { status: 'payment_pending', count: 22, color: '#F97316' },
  { status: 'payment_verified', count: 8, color: '#3B82F6' },
  { status: 'order_placed', count: 12, color: '#3B82F6' },
  { status: 'in_transit', count: 45, color: '#3B82F6' },
  { status: 'arrived_at_hub', count: 20, color: '#10B981' },
  { status: 'out_for_delivery', count: 15, color: '#10B981' },
  { status: 'delivered', count: 105, color: '#10B981' },
  { status: 'cancelled', count: 10, color: '#EF4444' },
];

export const topProducts: TopProduct[] = [
  { id: 'p1', name: 'Wireless Bluetooth Earbuds Pro', unitsSold: 234, revenue: 304566 },
  { id: 'p9', name: 'Vitamin C Serum 30ml', unitsSold: 189, revenue: 132111 },
  { id: 'p7', name: 'Men\'s Casual Sneakers', unitsSold: 156, revenue: 343044 },
  { id: 'p23', name: 'Basmati Rice - 5kg Premium', unitsSold: 145, revenue: 101355 },
  { id: 'p15', name: 'Yoga Mat - 6mm Thick', unitsSold: 134, revenue: 107066 },
];

// ============ Status Config ============

export const orderStatusLabels: Record<string, string> = {
  pending_confirmation: 'Pending Confirmation',
  quotation_pending: 'Quotation Pending',
  quoted: 'Quoted',
  payment_pending: 'Payment Pending',
  payment_verified: 'Payment Verified',
  order_placed: 'Order Placed',
  in_transit: 'In Transit',
  arrived_at_hub: 'Arrived at Hub',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const orderStatusColors: Record<string, { bg: string; text: string }> = {
  pending_confirmation: { bg: 'bg-orange-50', text: 'text-orange-600' },
  quotation_pending: { bg: 'bg-amber-50', text: 'text-amber-600' },
  quoted: { bg: 'bg-violet-50', text: 'text-violet-600' },
  payment_pending: { bg: 'bg-orange-50', text: 'text-orange-600' },
  payment_verified: { bg: 'bg-blue-50', text: 'text-blue-600' },
  order_placed: { bg: 'bg-blue-50', text: 'text-blue-600' },
  in_transit: { bg: 'bg-blue-50', text: 'text-blue-600' },
  arrived_at_hub: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  out_for_delivery: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  delivered: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  cancelled: { bg: 'bg-red-50', text: 'text-red-600' },
};

export const appSettings = {
  // Order coverage: which dzongkhags can place orders
  orderCoverage: {
    dzongkhags: DZONGKHAGS,
    totalCount: DZONGKHAGS.length,
    label: 'Orders accepted from all 20 dzongkhags',
    shortLabel: 'Orders from all 20 dzongkhags',
  },
  // Delivery hubs: where customers can pick up orders
  deliveryHubs: {
    hubs: deliveryHubs,
    activeHubs: deliveryHubs.filter(h => h.isActive),
    activeHubNames: deliveryHubs.filter(h => h.isActive).map(h => h.name),
    hubNamesShort: deliveryHubs.filter(h => h.isActive).map(h => h.name.replace(' Hub', '')),
    hubNamesJoined: deliveryHubs.filter(h => h.isActive).map(h => h.name.replace(' Hub', '')).join(', '),
    pickupLine: 'Pickup/delivery hubs currently available in Thimphu, Phuntsholing, and Paro.',
  },
};

export const trackingSteps = [
  { status: 'pending_confirmation', label: 'Order Received', description: 'Your order has been received' },
  { status: 'quotation_pending', label: 'Quotation Pending', description: 'We are preparing your quotation' },
  { status: 'quoted', label: 'Quotation Sent', description: 'Review and approve your quotation' },
  { status: 'payment_pending', label: 'Payment Pending', description: 'Upload your payment screenshot' },
  { status: 'payment_verified', label: 'Payment Verified', description: 'Your payment has been verified' },
  { status: 'order_placed', label: 'Order Placed', description: 'Order placed with seller' },
  { status: 'in_transit', label: 'In Transit', description: 'Your order is on the way to Bhutan' },
  { status: 'arrived_at_hub', label: 'Arrived at Hub', description: 'Package arrived at delivery hub' },
  { status: 'out_for_delivery', label: 'Out for Delivery', description: 'Package is out for delivery' },
  { status: 'delivered', label: 'Delivered', description: 'Package delivered successfully' },
];
