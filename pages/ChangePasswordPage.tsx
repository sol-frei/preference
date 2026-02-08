import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
// @ts-ignore
import { useNavigate } from 'react-router-dom';
import { KeyRound, Eye, EyeOff } from 'lucide-react';

const ChangePasswordPage: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("两次密码不一致");
      return;
    }
    if (password.length < 6) {
      setError("密码长度至少为 6 位");
      return;
    }

    setLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.updateUser({ password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
    } else {
      // Update is_first_login in profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ is_first_login: false })
        .eq('id', (await supabase.auth.getUser()).data.user?.id);

      if (profileError) {
        setError(profileError.message);
        setLoading(false);
      } else {
        await refreshProfile();
        navigate('/');
      }
    }
  };

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
            <div className="bg-red-100 border border-red-400 text-red-700 p-3 text-sm rounded">
              {error}
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
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b7355] hover:text-[#5d4e37] transition-colors"
              aria-label={showPassword ? "隐藏密码" : "显示密码"}
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
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b7355] hover:text-[#5d4e37] transition-colors"
              aria-label={showConfirmPassword ? "隐藏密码" : "显示密码"}
            >
              {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#5d4e37] text-white font-bold p-4 rounded-none hover:bg-[#4a3d2c] transition-colors disabled:opacity-50"
          >
            {loading ? "更新中..." : "确认修改并进入"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordPage;
