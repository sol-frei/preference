import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
// @ts-ignore
import { useNavigate } from 'react-router-dom';
import { KeyRound, Eye, EyeOff, AlertCircle } from 'lucide-react';

const ChangePasswordPage: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();

  // 检查登录状态
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session) {
          setHasSession(false);
          setError('登录会话已过期，请重新登录');
        } else {
          setHasSession(true);
        }
      } catch (err) {
        console.error('检查会话失败:', err);
        setHasSession(false);
        setError('无法验证登录状态');
      } finally {
        setSessionChecked(true);
      }
    };

    checkSession();
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 验证密码
    if (password !== confirmPassword) {
      setError("两次密码不一致");
      return;
    }
    if (password.length < 6) {
      setError("密码长度至少为 6 位");
      return;
    }

    // 再次检查会话
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError('登录会话已失效，请重新登录');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 设置超时机制（30秒）
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('请求超时，请检查网络连接')), 30000)
      );

      // 更新密码
      const updatePromise = supabase.auth.updateUser({ password });
      const { data, error: authError } = await Promise.race([updatePromise, timeoutPromise]) as any;

      if (authError) {
        // 如果是会话问题，提示重新登录
        if (authError.message?.toLowerCase().includes('session')) {
          throw new Error('登录会话已失效，即将跳转到登录页面');
        }
        throw new Error(authError.message);
      }

      // 获取当前用户
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('获取用户信息失败');
      }

      // 更新 profile 中的 is_first_login
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ is_first_login: false })
        .eq('id', user.id);

      if (profileError) {
        console.warn('更新 profile 失败:', profileError);
        // 不阻止流程，仍然允许导航
      }

      // 刷新用户资料
      try {
        await refreshProfile();
      } catch (refreshError) {
        console.warn('刷新 profile 失败:', refreshError);
      }

      // 成功后导航到首页
      navigate('/', { replace: true });
      
    } catch (err: any) {
      console.error('密码更新错误:', err);
      const errorMessage = err.message || '密码更新失败，请重试';
      setError(errorMessage);
      
      // 如果是会话问题，2秒后跳转到登录页
      if (errorMessage.includes('会话') || errorMessage.includes('session')) {
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReturnToLogin = () => {
    navigate('/login');
  };

  // 等待会话检查完成
  if (!sessionChecked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#fef9e7]">
        <div className="text-[#8b7355]">检查登录状态...</div>
      </div>
    );
  }

  // 如果没有会话，显示错误并提供返回登录的按钮
  if (!hasSession) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#fef9e7] px-6">
        <div className="w-full max-w-sm space-y-6 text-center">
          <AlertCircle size={64} className="mx-auto text-red-500 mb-4" />
          <h1 className="text-2xl font-bold text-[#5d4e37]">登录已过期</h1>
          <p className="text-[#8b7355]">您的登录会话已失效，请重新登录后修改密码。</p>
          <button
            onClick={handleReturnToLogin}
            className="w-full bg-[#5d4e37] text-white font-bold p-4 rounded-none hover:bg-[#4a3d2c] transition-colors"
          >
            返回登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#fef9e7] px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <KeyRound size={48} className="mx-auto text-[#8b7355] mb-4" />
          <h1 className="text-2xl font-bold text-[#5d4e37]">首次登录，请修改密码</h1>
          <p className="text-[#8b7355] text-sm">为了您的账号安全，必须重置初始密码。</p>
        </div>

        <form onSubmit={handleUpdate} className="space-y-4">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 p-3 text-sm rounded flex items-start gap-2">
              <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="新密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white border border-[#d4c5a9] p-4 pr-12 rounded-none focus:outline-none focus:border-[#8b7355] text-[#5d4e37]"
              required
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b7355] hover:text-[#5d4e37] transition-colors disabled:opacity-50"
              aria-label={showPassword ? "隐藏密码" : "显示密码"}
              disabled={loading}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              placeholder="确认新密码"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-white border border-[#d4c5a9] p-4 pr-12 rounded-none focus:outline-none focus:border-[#8b7355] text-[#5d4e37]"
              required
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b7355] hover:text-[#5d4e37] transition-colors disabled:opacity-50"
              aria-label={showConfirmPassword ? "隐藏密码" : "显示密码"}
              disabled={loading}
            >
              {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#5d4e37] text-white font-bold p-4 rounded-none hover:bg-[#4a3d2c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "更新中..." : "确认修改并进入"}
          </button>

          <button
            type="button"
            onClick={handleReturnToLogin}
            className="w-full bg-transparent border border-[#8b7355] text-[#8b7355] font-bold p-4 rounded-none hover:bg-[#8b7355] hover:text-white transition-colors"
          >
            返回登录
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordPage;
