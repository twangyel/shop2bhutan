import { Routes, Route } from 'react-router-dom';
import { AppProvider } from '@/context/AppContext';

// Layouts
import CustomerLayout from '@/layouts/CustomerLayout';
import AdminLayout from '@/layouts/AdminLayout';

// Customer Pages
import Login from '@/pages/customer/Login';
import Register from '@/pages/customer/Register';
import ForgotPassword from '@/pages/customer/ForgotPassword';
import Home from '@/pages/customer/Home';
import Catalog from '@/pages/customer/Catalog';
import ProductDetail from '@/pages/customer/ProductDetail';
import PasteLink from '@/pages/customer/PasteLink';
import Cart from '@/pages/customer/Cart';
import Checkout from '@/pages/customer/Checkout';
import QuotationReview from '@/pages/customer/QuotationReview';
import PaymentUpload from '@/pages/customer/PaymentUpload';
import Orders from '@/pages/customer/Orders';
import OrderDetail from '@/pages/customer/OrderDetail';
import Profile from '@/pages/customer/Profile';
import Addresses from '@/pages/customer/Addresses';
import Support from '@/pages/customer/Support';
import Notifications from '@/pages/customer/Notifications';

// Admin Pages
import Dashboard from '@/pages/admin/Dashboard';
import OrdersPanel from '@/pages/admin/OrdersPanel';
import AdminOrderDetail from '@/pages/admin/OrderDetail';
import QuotationBuilder from '@/pages/admin/QuotationBuilder';
import PaymentsVerification from '@/pages/admin/PaymentsVerification';
import CustomersPanel from '@/pages/admin/CustomersPanel';
import ProductCMS from '@/pages/admin/ProductCMS';
import BannerCMS from '@/pages/admin/BannerCMS';
import CategoryCMS from '@/pages/admin/CategoryCMS';
import DeliveryFeeSettings from '@/pages/admin/DeliveryFeeSettings';
import ServiceChargeSettings from '@/pages/admin/ServiceChargeSettings';
import PaymentMethodSettings from '@/pages/admin/PaymentMethodSettings';
import AppSettings from '@/pages/admin/AppSettings';
import FAQCMS from '@/pages/admin/FAQCMS';

export default function App() {
  return (
    <AppProvider>
      <Routes>
        {/* Auth Routes - No Layout */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Customer Routes */}
        <Route element={<CustomerLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/paste-link" element={<PasteLink />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/quotation/:orderId" element={<QuotationReview />} />
          <Route path="/payment/:orderId" element={<PaymentUpload />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/order/:id" element={<OrderDetail />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/addresses" element={<Addresses />} />
          <Route path="/support" element={<Support />} />
          <Route path="/notifications" element={<Notifications />} />
        </Route>

        {/* Admin Routes */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<OrdersPanel />} />
          <Route path="orders/:id" element={<AdminOrderDetail />} />
          <Route path="quotation/:id" element={<QuotationBuilder />} />
          <Route path="payments" element={<PaymentsVerification />} />
          <Route path="customers" element={<CustomersPanel />} />
          <Route path="products" element={<ProductCMS />} />
          <Route path="banners" element={<BannerCMS />} />
          <Route path="categories" element={<CategoryCMS />} />
          <Route path="delivery-fees" element={<DeliveryFeeSettings />} />
          <Route path="service-charges" element={<ServiceChargeSettings />} />
          <Route path="payment-methods" element={<PaymentMethodSettings />} />
          <Route path="settings" element={<AppSettings />} />
          <Route path="faq" element={<FAQCMS />} />
        </Route>
      </Routes>
    </AppProvider>
  );
}
