import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import AdminDashboard from './pages/AdminDashboard';
// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import WeddingsList from './pages/WeddingsList';
import WeddingDetails from './pages/WeddingDetails';
import CreateWeddingProfile from './pages/CreateWeddingProfile';
import CoupleDashboard from './pages/CoupleDashboard';
import CreateGift from './pages/CreateGift';
import GiftDetails from './pages/GiftDetails';

import './App.css';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="app">
          <Navbar />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/weddings" element={<WeddingsList />} />
              <Route
                path="/weddings/:coupleId"
                element={
                  <ProtectedRoute>
                    <WeddingDetails />
                  </ProtectedRoute>
                }
              />

              {/* Couple Routes */}
              <Route
                path="/wedding-profile/create"
                element={
                  <ProtectedRoute requireCouple>
                    <CreateWeddingProfile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute requireCouple>
                    <CoupleDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/gifts/create"
                element={
                  <ProtectedRoute requireCouple>
                    <CreateGift />
                  </ProtectedRoute>
                }
              />

              {/* Gift Details - accessible to authenticated users */}
              <Route
                path="/gifts/:giftId"
                element={
                  <ProtectedRoute>
                    <GiftDetails />
                  </ProtectedRoute>
                } />
                <Route
                    path="/admin"
                    element={
                        <ProtectedRoute requireAdmin>
                            <AdminDashboard />
                        </ProtectedRoute>
                    }
                />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

