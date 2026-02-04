import React, { useEffect, useRef } from 'react';
// @ts-ignore
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import MessagesPage from './pages/MessagesPage';
import NotificationsPage from './pages/NotificationsPage';
import AdminPage from './pages/AdminPage';

const AppContent: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const touchStartPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      touchStartPos.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touchEndDetail = e.changedTouches[0];
      const deltaX = touchEndDetail.clientX - touchStartPos.current.x;
      const deltaY = Math.abs(touchEndDetail.clientY - touchStartPos.current.y);
      const screenWidth = window.innerWidth;

      // 判定逻辑：
      // 1. 左侧边缘右滑 (iOS/Android通用)
      const isLeftEdgeBack = touchStartPos.current.x < 50 && deltaX > 80;
      // 2. 右侧边缘左滑 (Android 风格返回)
      const isRightEdgeBack = touchStartPos.current.x > screenWidth - 50 && deltaX < -80;

      if ((isLeftEdgeBack || isRightEdgeBack) && deltaY < 60) {
        // 如果不在首页，或者虽然在首页但此时浏览器有可以返回的状态（如打开了全屏Modal）
        // 这里直接调用 navigate(-1) 或 window.history.back()
        // 配合 HomePage 中的 pushState 逻辑，可以完美关闭 Modal
        navigate(-1);
      }
    };

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [location.pathname, navigate]);

  return (
    <div className="bg-[#fdfcf0] text-black min-h-screen selection:bg-black selection:text-[#fdfcf0]">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        
        <Route path="/change-password" element={
          <ProtectedRoute>
            <ChangePasswordPage />
          </ProtectedRoute>
        } />

        <Route path="/" element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        } />

        <Route path="/profile/:username" element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        } />

        <Route path="/messages" element={
          <ProtectedRoute>
            <MessagesPage />
          </ProtectedRoute>
        } />

        <Route path="/notifications" element={
          <ProtectedRoute>
            <NotificationsPage />
          </ProtectedRoute>
        } />

        <Route path="/admin" element={
          <ProtectedRoute>
            <AdminPage />
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;