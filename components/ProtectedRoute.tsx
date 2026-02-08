import React from 'react';
// @ts-ignore
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  allowFirstLogin?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireAuth = true,
  allowFirstLogin = false 
}) => {
  const { user, profile, loading } = useAuth();

  // 等待认证状态加载
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#fdfcf0]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-black/20 border-t-black rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-zinc-500">加载中...</p>
        </div>
      </div>
    );
  }

  // 需要认证但用户未登录 → 跳转到登录页
  if (requireAuth && !user) {
    return <Navigate to="/login" replace />;
  }

  // 用户已登录，且是首次登录 → 跳转到修改密码页面
  // 除非当前页面允许首次登录访问（如修改密码页面本身）
  if (user && profile?.is_first_login && !allowFirstLogin) {
    return <Navigate to="/change-password" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
