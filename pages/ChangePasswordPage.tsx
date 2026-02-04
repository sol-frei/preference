import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
// @ts-ignore
import { useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';

const ChangePasswordPage: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-black px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <KeyRound size={48} className="mx-auto text-white mb-4" />
          <h1 className="text-2xl font-bold text-white">首次登录，请修改密码</h1>
          <p className="text-zinc-500 text-sm">为了您的账号安全，必须重置初始密码。</p>
        </div>

        <form onSubmit={handleUpdate} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 text-sm rounded">
              {error}
            </div>
          )}
          
          <input
            type="password"
            placeholder="新密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-[#0a0a0a] border border-zinc-800 p-4 rounded-none focus:outline-none focus:border-white"
            required
          />
          <input
            type="password"
            placeholder="确认新密码"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full bg-[#0a0a0a] border border-zinc-800 p-4 rounded-none focus:outline-none focus:border-white"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black font-bold p-4 rounded-none hover:bg-zinc-200 transition-colors disabled:opacity-50"
          >
            {loading ? "更新中..." : "确认修改并进入"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordPage;