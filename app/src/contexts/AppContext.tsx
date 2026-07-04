import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { Cart, CartItem, User, Notification, Order } from '@/types';

interface AppContextType {
  // Legacy auth state. Real Supabase auth lives in AuthContext.
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => boolean;
  loginAsAdmin: () => void;
  logout: () => void;

  // Cart
  cart: Cart;
  addToCart: (item: CartItem) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  cartItemCount: number;

  // Notifications
  notifications: Notification[];
  unreadCount: number;
  markNotificationRead: (id: string) => void;
  markAllRead: () => void;

  // Orders
  orders: Order[];
  addOrder: (order: Order) => void;
  updateOrderStatus: (orderId: string, status: string) => void;
}

const EMPTY_CART: Cart = { items: [], deliveryHubId: 'hub1' };

function makeLegacyUser(email: string, isAdmin = false): User {
  const cleanEmail = email.trim().toLowerCase();
  const name = cleanEmail ? cleanEmail.split('@')[0] : isAdmin ? 'Admin' : 'Customer';

  return {
    id: isAdmin ? 'legacy-admin' : 'legacy-customer',
    name,
    email: cleanEmail,
    phone: '',
    role: isAdmin ? 'admin' : 'customer',
    dzongkhag: '',
    isActive: true,
    createdAt: new Date().toISOString(),
  };
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [cart, setCart] = useState<Cart>(EMPTY_CART);
  const [notificationList, setNotificationList] = useState<Notification[]>([]);
  const [orderList, setOrderList] = useState<Order[]>([]);

  const isAuthenticated = !!user;
  const cartItemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  const unreadCount = notificationList.filter((notification) => !notification.isRead).length;

  const login = useCallback((email: string, password: string) => {
    if (email && password.length >= 6) {
      setUser(makeLegacyUser(email));
      setIsAdmin(false);
      setNotificationList([]);
      setOrderList([]);
      setCart(EMPTY_CART);
      return true;
    }
    return false;
  }, []);

  const loginAsAdmin = useCallback(() => {
    setUser(makeLegacyUser('admin@shop2bhutan.com', true));
    setIsAdmin(true);
    setNotificationList([]);
    setOrderList([]);
    setCart(EMPTY_CART);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setIsAdmin(false);
    setNotificationList([]);
    setOrderList([]);
    setCart(EMPTY_CART);
  }, []);

  const addToCart = useCallback((item: CartItem) => {
    setCart((prev) => {
      const existing = prev.items.find((cartItem) => cartItem.productId === item.productId);
      if (existing) {
        return {
          ...prev,
          items: prev.items.map((cartItem) =>
            cartItem.productId === item.productId
              ? { ...cartItem, quantity: cartItem.quantity + item.quantity }
              : cartItem
          ),
        };
      }
      return { ...prev, items: [...prev.items, item] };
    });
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setCart((prev) => ({ ...prev, items: prev.items.filter((item) => item.id !== itemId) }));
  }, []);

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => ({ ...prev, items: prev.items.filter((item) => item.id !== itemId) }));
      return;
    }
    setCart((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === itemId ? { ...item, quantity } : item)),
    }));
  }, []);

  const clearCart = useCallback(() => {
    setCart(EMPTY_CART);
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setNotificationList((prev) =>
      prev.map((notification) => (notification.id === id ? { ...notification, isRead: true } : notification))
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotificationList((prev) => prev.map((notification) => ({ ...notification, isRead: true })));
  }, []);

  const addOrder = useCallback((order: Order) => {
    setOrderList((prev) => [order, ...prev]);
  }, []);

  const updateOrderStatus = useCallback((orderId: string, status: string) => {
    setOrderList((prev) =>
      prev.map((order) => (order.id === orderId ? { ...order, status: status as Order['status'] } : order))
    );
  }, []);

  return (
    <AppContext.Provider
      value={{
        user,
        isAuthenticated,
        isAdmin,
        login,
        loginAsAdmin,
        logout,
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        cartItemCount,
        notifications: notificationList,
        unreadCount,
        markNotificationRead,
        markAllRead,
        orders: orderList,
        addOrder,
        updateOrderStatus,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
