import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
// @ts-ignore
import { useNavigate } from 'react-router-dom';
import { LogIn, Eye, EyeOff } from 'lucide-react';

const FirstLoginPage: React.FC = () => {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 用户使用临时密码登录
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: loginId.includes('@') ? loginId : `${loginId}@preference.internal`,
        password: password,
      });

      if (signInError) {
        throw signInError;
      }

      // 检查是否是首次登录
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_first_login')
        .eq('id', data.user.id)
        .single();

      if (profile?.is_first_login) {
        // 首次登录，跳转到修改密码页面
        navigate('/change-password');
      } else {
        // 已经修改过密码，直接进入主页
        navigate('/');
      }

    } catch (err: any) {
      console.error('登录错误:', err);
      setError(err.message || '登录失败，请检查账号和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#fef9e7] px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <LogIn size={48} className="mx-auto text-[#8b7355] mb-4" />
          <h1 className="text-2xl font-bold text-[#5d4e37]">首次登录</h1>
          <p className="text-[#8b7355] text-sm">请使用管理员提供的临时账号和密码登录</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 p-3 text-sm rounded">
              {error}
            </div>
          )}
          
          <input
            type="text"
            placeholder="账号 ID 或邮箱"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            className="w-full bg-white border border-[#d4c5a9] p-4 rounded-none focus:outline-none focus:border-[#8b7355] text-[#5d4e37]"
            required
            disabled={loading}
          />

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="临时密码"
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

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#5d4e37] text-white font-bold p-4 rounded-none hover:bg-[#4a3d2c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "登录中..." : "登录"}
          </button>
        </form>

        <div className="text-center text-xs text-[#8b7355]">
          <p>登录后您将需要修改初始密码</p>
        </div>
      </div>
    </div>
  );
};

export default FirstLoginPage;
