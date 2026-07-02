import { Routes, Route } from 'react-router-dom';
import { AppProvider } from '@/contexts/AppContext';

// Layouts
import CustomerLayout from '@/layouts/CustomerLayout';
import AdminLayout from '@/layouts/AdminLayout';

// Shared
import RequireAuth from '@/components/shared/RequireAuth';

// Customer Pages
import Login from '@/pages/customer/Login';
import Register from '@/pages/customer/Register';
import ForgotPassword from '@/pages/customer/ForgotPassword';
import ResetPassword from '@/pages/customer/ResetPassword';
import Home from '@/pages/customer/Home';
import Catalog from '@/pages/customer/Catalog';
import ProductDetail from '@/pages/customer/ProductDetail';
import PasteLink from '@/pages/customer/PasteLink';
import RequestBag from '@/pages/customer/RequestBag';
import Checkout from '@/pages/customer/Checkout';
import QuotationReview from '@/pages/customer/QuotationReview';
import PaymentUpload from '@/pages/customer/PaymentUpload';
import Orders from '@/pages/customer/Orders';
import OrderDetail from '@/pages/customer/OrderDetail';
import Account from '@/pages/customer/Account';
import Profile from '@/pages/customer/Profile';
import Addresses from '@/pages/customer/Addresses';
import ChangePassword from '@/pages/customer/ChangePassword';
import Support from '@/pages/customer/Support';
import Notifications from '@/pages/customer/Notifications';
import Parcel from '@/pages/customer/Parcel';
import ParcelBooking from '@/pages/customer/ParcelBooking';
import MyParcels from '@/pages/customer/MyParcels';
import Shop from '@/pages/customer/Shop';

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
import AdminParcelTrips from '@/pages/admin/ParcelTrips';
import AdminParcelRequests from '@/pages/admin/ParcelRequests';

export default function App() {
  return (
    <AppProvider>
      <Routes>
        {/* Auth Routes - No Layout */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Customer Routes */}
        <Route element={<CustomerLayout />}>
          {/* Public browsing routes */}
          <Route path="/" element={<Home />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/paste-link" element={<PasteLink />} />
          <Route path="/account" element={<Account />} />
          <Route path="/support" element={<Support />} />
          <Route path="/parcel" element={<Parcel />} />
          <Route path="/shop" element={<Shop />} />

          {/* Customer-only routes/actions */}
          <Route
            path="/request-bag"
            element={
              <RequireAuth title="Sign in to view Request Bag" message="Save product links, screenshots, and quantities in your Request Bag before requesting a quotation.">
                <RequestBag />
              </RequireAuth>
            }
          />
          <Route
            path="/cart"
            element={
              <RequireAuth title="Sign in to view Request Bag" message="Your old cart is now Request Bag for quotation requests.">
                <RequestBag />
              </RequireAuth>
            }
          />
          <Route
            path="/checkout"
            element={
              <RequireAuth
                title="Sign in to checkout"
                message="Please sign in before placing an order so we can save your quotation, payment, and tracking history."
              >
                <Checkout />
              </RequireAuth>
            }
          />
          <Route
            path="/quotation/:orderId"
            element={
              <RequireAuth title="Sign in to view quotation" message="Your quotation is linked to your Shop2Bhutan account.">
                <QuotationReview />
              </RequireAuth>
            }
          />
          <Route
            path="/payment/:orderId"
            element={
              <RequireAuth title="Sign in to upload payment" message="Payment screenshots are kept private and linked to your account.">
                <PaymentUpload />
              </RequireAuth>
            }
          />
          <Route
            path="/orders"
            element={
              <RequireAuth title="Sign in to view orders" message="Your order history, quotations, and tracking updates are available after sign in.">
                <Orders />
              </RequireAuth>
            }
          />
          <Route
            path="/order/:id"
            element={
              <RequireAuth title="Sign in to view order" message="Order details are private and linked to your account.">
                <OrderDetail />
              </RequireAuth>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireAuth title="Sign in to edit profile" message="Manage your name, phone, email, dzongkhag, and profile picture after sign in.">
                <Profile />
              </RequireAuth>
            }
          />
          <Route
            path="/addresses"
            element={
              <RequireAuth title="Sign in to manage addresses" message="Saved addresses are private and linked to your Shop2Bhutan account.">
                <Addresses />
              </RequireAuth>
            }
          />
          <Route
            path="/change-password"
            element={
              <RequireAuth title="Sign in to change password" message="For security, password changes require an active signed-in session.">
                <ChangePassword />
              </RequireAuth>
            }
          />
          <Route
            path="/notifications"
            element={
              <RequireAuth title="Sign in to view notifications" message="Account notifications are linked to your order and payment activity.">
                <Notifications />
              </RequireAuth>
            }
          />
          <Route
            path="/parcel-booking/:tripId"
            element={
              <RequireAuth title="Sign in to book parcel" message="Parcel bookings need your verified customer profile and contact details.">
                <ParcelBooking />
              </RequireAuth>
            }
          />
          <Route
            path="/my-parcels"
            element={
              <RequireAuth title="Sign in to view parcels" message="Your parcel requests and bookings are available after sign in.">
                <MyParcels />
              </RequireAuth>
            }
          />
        </Route>

        {/* Admin Routes */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<OrdersPanel />} />
          <Route path="orders/:id" element={<AdminOrderDetail />} />
          <Route path="quotation/:id" element={<QuotationBuilder />} />
          <Route path="parcels" element={<AdminParcelTrips />} />
          <Route path="parcel-requests" element={<AdminParcelRequests />} />
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
