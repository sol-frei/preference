import React, { useState } from 'react';
import { supabase, isConfigured } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
// @ts-ignore
import { useNavigate } from 'react-router-dom';
import { LogIn, AlertCircle } from 'lucide-react';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfigured) {
      setError("系统未正确配置，请联系管理员。");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
        setLoading(false);
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || '登录失败');
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#fdfcf0] px-6 select-none">
      <div className="w-full max-w-sm space-y-16">
        <div className="text-center space-y-2 animate-title opacity-0">
          <h1 className="text-8xl font-normal text-black font-decorative tracking-normal">Preference</h1>
          <p className="text-zinc-400 text-[10px] tracking-[0.5em] uppercase text-nowrap pl-2 font-bold">偏爱激女 · 极致极简</p>
        </div>

        <div className="space-y-6">
          {error && (
            <div className="bg-red-50 text-red-500 border border-red-100 p-4 text-xs flex items-start space-x-2 rounded-lg">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <input
                type="text"
                placeholder="账号 (ID / 邮箱)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#f7f5e6] border border-black/5 p-4 rounded-xl focus:outline-none focus:border-black/20 text-black placeholder:text-zinc-300 transition-all text-sm"
                required
              />
            </div>
            <div className="space-y-1">
              <input
                type="password"
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#f7f5e6] border border-black/5 p-4 rounded-xl focus:outline-none focus:border-black/20 text-black placeholder:text-zinc-300 transition-all text-sm"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-[#fdfcf0] font-bold p-4 rounded-xl hover:opacity-80 transition-all flex items-center justify-center space-x-2 shadow-xl shadow-black/5 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-[#fdfcf0] border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <LogIn size={20} />
                  <span>登录</span>
                </>
              )}
            </button>
          </form>
        </div>

        <div className="text-center pt-10">
          <p className="text-zinc-300 text-[9px] uppercase tracking-[0.6em]">
            System Architecture v1.0
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;