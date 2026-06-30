import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Cart, CartItem, User, Notification, Order } from '@/types';
import { defaultCart, currentUser, notifications as mockNotifications, orders as mockOrders } from '@/data/mockData';

interface AppContextType {
  // Auth
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

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(currentUser);
  const [isAdmin, setIsAdmin] = useState(false);
  const [cart, setCart] = useState<Cart>(defaultCart);
  const [notificationList, setNotificationList] = useState<Notification[]>(mockNotifications);
  const [orderList, setOrderList] = useState<Order[]>(mockOrders);

  const isAuthenticated = !!user;
  const cartItemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  const unreadCount = notificationList.filter(n => !n.isRead).length;

  const login = useCallback((email: string, password: string) => {
    if (email && password.length >= 6) {
      setUser(currentUser);
      setIsAdmin(false);
      return true;
    }
    return false;
  }, []);

  const loginAsAdmin = useCallback(() => {
    setUser(currentUser);
    setIsAdmin(true);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setIsAdmin(false);
  }, []);

  const addToCart = useCallback((item: CartItem) => {
    setCart(prev => {
      const existing = prev.items.find(i => i.productId === item.productId);
      if (existing) {
        return {
          ...prev,
          items: prev.items.map(i =>
            i.productId === item.productId
              ? { ...i, quantity: i.quantity + item.quantity }
              : i
          )
        };
      }
      return { ...prev, items: [...prev.items, item] };
    });
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setCart(prev => ({ ...prev, items: prev.items.filter(i => i.id !== itemId) }));
  }, []);

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    setCart(prev => ({
      ...prev,
      items: prev.items.map(i => i.id === itemId ? { ...i, quantity } : i)
    }));
  }, [removeFromCart]);

  const clearCart = useCallback(() => {
    setCart({ items: [], deliveryHubId: 'hub1' });
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setNotificationList(prev =>
      prev.map(n => n.id === id ? { ...n, isRead: true } : n)
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotificationList(prev =>
      prev.map(n => ({ ...n, isRead: true }))
    );
  }, []);

  const addOrder = useCallback((order: Order) => {
    setOrderList(prev => [order, ...prev]);
  }, []);

  const updateOrderStatus = useCallback((orderId: string, status: string) => {
    setOrderList(prev =>
      prev.map(o => o.id === orderId ? { ...o, status: status as Order['status'] } : o)
    );
  }, []);

  return (
    <AppContext.Provider value={{
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
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
