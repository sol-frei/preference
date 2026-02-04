
import React, { useState, useEffect } from 'react';
// @ts-ignore
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { 
  get_all_users, 
  updateUser, 
  toggle_ban_user, 
  get_banned_words 
} from '../services/storage';
import { 
  UserPlus, Ban, Copy, ShieldAlert, Check, UserCircle, Crown, Loader2, ShieldCheck, ArrowLeft, RefreshCw
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Toast from '../components/Toast';

export default function AdminPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUser, setNewUser] = useState<any | null>(null);
  const [bannedWordsInput, setBannedWordsInput] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'settings'>('users');
  const [copiedId, setCopiedId] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [allUsers, words] = await Promise.all([
        get_all_users(),
        get_banned_words()
      ]);
      setUsers(allUsers);
      setBannedWordsInput(words.join(', '));
    } catch (err: any) {
      setToast({ msg: '加载数据失败: ' + err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateUser = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('请先登录');

      // Calls our Vercel Serverless Function
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ role: 'user' }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || '创建用户失败');
      }

      const generatedUser = await res.json();
      setNewUser(generatedUser);
      // Immediately add to the list to show the new count
      setUsers(prev => [generatedUser, ...prev]);
      setToast({ msg: '受邀账号生成成功', type: 'success' });
    } catch (err: any) {
      setToast({ msg: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBan = async (id: string, currentStatus: boolean) => {
    try {
      await toggle_ban_user(id, currentStatus);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, is_banned: !currentStatus } : u));
      setToast({ msg: '状态已更新', type: 'success' });
    } catch (err: any) {
      setToast({ msg: '操作失败', type: 'error' });
    }
  };

  const handleToggleRole = async (id: string, currentRole: string) => {
    const newRole = currentRole === 'i女er' ? 'user' : 'i女er';
    try {
      await updateUser(id, { role: newRole });
      setUsers(prev => prev.map(u => u.id === id ? { ...u, role: newRole } : u));
      setToast({ msg: '角色已切换', type: 'success' });
    } catch (err: any) {
      setToast({ msg: '更新失败', type: 'error' });
    }
  };

  const handleSaveWords = async () => {
    try {
      const wordsArray = bannedWordsInput
        .split(/[，, \n]+/)
        .map(w => w.trim())
        .filter(w => w.length > 0);
      const uniqueWords = Array.from(new Set(wordsArray));

      const { error: deleteError } = await supabase
        .from('sensitive_words')
        .delete()
        .not('id', 'is', null);

      if (deleteError) throw deleteError;

      const inserts = uniqueWords.map(w => ({
        word: w,
        category: 'misogyny',
        replacement: '***',
      }));

      if (inserts.length > 0) {
        const { error: insertError } = await supabase
          .from('sensitive_words')
          .insert(inserts);
        if (insertError) throw insertError;
      }
      setToast({ msg: '敏感词库已更新', type: 'success' });
    } catch (err: any) {
      setToast({ msg: '保存失败: ' + err.message, type: 'error' });
    }
  };

  const copyToClipboard = (text: string, type: 'id' | 'pass') => {
    navigator.clipboard.writeText(text);
    if (type === 'id') {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } else {
      setCopiedPass(true);
      setTimeout(() => setCopiedPass(false), 2000);
    }
  };

  return (
    <div className="flex flex-col min-h-screen w-full bg-[#fdfcf0] pb-24 text-black">
      <Sidebar />
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      
      <main className="w-full max-w-6xl mx-auto px-6 md:px-12 pt-12">
        <header className="flex flex-col space-y-6 mb-12">
          <div className="flex items-center space-x-6">
            <button 
              onClick={() => navigate(-1)} 
              className="p-3 hover:bg-black/5 rounded-full transition-colors flex items-center justify-center"
            >
              <ArrowLeft size={28} />
            </button>
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-[#fdfcf0]">
                <ShieldCheck size={24} />
              </div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight">管理后台</h1>
            </div>
          </div>
          
          <div className="flex space-x-12 border-b border-black/5">
            <button 
              onClick={() => setActiveTab('users')}
              className={`pb-4 text-sm font-black uppercase tracking-[0.2em] transition-all relative ${
                activeTab === 'users' ? 'text-black' : 'text-zinc-400'
              }`}
            >
              用户管理 ({users.length})
              {activeTab === 'users' && <div className="absolute bottom-0 left-0 w-full h-[3px] bg-black rounded-full" />}
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`pb-4 text-sm font-black uppercase tracking-[0.2em] transition-all relative ${
                activeTab === 'settings' ? 'text-black' : 'text-zinc-400'
              }`}
            >
              发言限制
              {activeTab === 'settings' && <div className="absolute bottom-0 left-0 w-full h-[3px] bg-black rounded-full" />}
            </button>
          </div>
        </header>

        {activeTab === 'users' ? (
          <div className="space-y-12 animate-in fade-in duration-500">
            {/* Create Section */}
            <div className="bg-[#f7f5e6] p-8 md:p-10 rounded-[2rem] border border-black/5 space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-xl font-black">生成受邀用户</h3>
                  <p className="text-sm text-zinc-500 font-medium">通过 Vercel 安全接口创建具备初始权限的新账户</p>
                </div>
                <button 
                  disabled={loading}
                  onClick={handleGenerateUser}
                  className="bg-black text-[#fdfcf0] px-8 py-4 rounded-2xl font-bold hover:opacity-80 transition-all flex items-center space-x-3 shadow-xl shadow-black/5 disabled:opacity-50"
                >
                  {loading ? <RefreshCw size={18} className="animate-spin" /> : <UserPlus size={18} />}
                  <span>{loading ? '正在处理' : '生成受邀账号'}</span>
                </button>
              </div>

              {newUser && (
                <div className="p-6 bg-[#fdfcf0] rounded-2xl border-2 border-dashed border-black/10 animate-in zoom-in duration-300">
                  <p className="text-xs font-black text-red-500 uppercase tracking-widest mb-4">请将以下账号信息复制给受邀者（离开此页面后将无法再次查看）</p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between bg-black/5 p-4 rounded-xl">
                      <span className="font-mono text-sm">账号: {newUser.login_id}</span>
                      <button onClick={() => copyToClipboard(newUser.login_id, 'id')} className="text-xs font-bold flex items-center space-x-2">
                        {copiedId ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                        <span>{copiedId ? '已复制' : '复制'}</span>
                      </button>
                    </div>
                    <div className="flex items-center justify-between bg-black/5 p-4 rounded-xl">
                      <span className="font-mono text-sm font-bold">密码: {newUser.password}</span>
                      <button onClick={() => copyToClipboard(newUser.password, 'pass')} className="text-xs font-bold flex items-center space-x-2">
                        {copiedPass ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                        <span>{copiedPass ? '已复制' : '复制'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* List Section */}
            <div className="overflow-hidden border border-black/5 rounded-[2rem]">
              <table className="w-full text-left">
                <thead className="bg-[#f7f5e6] border-b border-black/5">
                  <tr>
                    <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">用户</th>
                    <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">角色 & 状态</th>
                    <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 text-right">管理操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {users.map(u => (
                    <tr key={u.id} className={`transition-colors hover:bg-black/[0.01] ${u.is_banned ? 'bg-red-50/30' : ''}`}>
                      <td className="p-6">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 rounded-full bg-[#f0eee0] border border-black/5 overflow-hidden flex items-center justify-center">
                            {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={24} className="text-zinc-300" />}
                          </div>
                          <div>
                            <div className="font-black text-base">{u.username}</div>
                            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{u.id.split('-')[0]}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="flex flex-col space-y-2">
                          <div className="flex items-center space-x-2">
                            {u.role === 'admin' ? (
                              <span className="bg-black text-[#fdfcf0] text-[9px] px-2 py-1 rounded-md font-black uppercase tracking-widest">Admin</span>
                            ) : u.role === 'i女er' ? (
                              <span className="bg-purple-600 text-white text-[9px] px-2 py-1 rounded-md font-black uppercase tracking-widest flex items-center space-x-1">
                                <Crown size={10} /> <span>i女er</span>
                              </span>
                            ) : (
                              <span className="text-zinc-400 text-[9px] font-black uppercase tracking-widest">User</span>
                            )}
                          </div>
                          {u.is_banned && (
                            <span className="text-red-500 text-[9px] font-black uppercase tracking-widest flex items-center space-x-1 animate-pulse">
                              <ShieldAlert size={10} /> <span>已封禁</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-6 text-right">
                        {u.role !== 'admin' && (
                          <div className="flex items-center justify-end space-x-2">
                            <button 
                              onClick={() => handleToggleBan(u.id, u.is_banned)}
                              className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border ${
                                u.is_banned 
                                ? 'border-green-600 text-green-600 hover:bg-green-50' 
                                : 'border-red-600 text-red-600 hover:bg-red-50'
                              }`}
                            >
                              {u.is_banned ? '解封' : '封禁'}
                            </button>
                            {!u.is_banned && (
                              <button
                                onClick={() => handleToggleRole(u.id, u.role)}
                                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl border border-purple-600 text-purple-600 hover:bg-purple-50 transition-all"
                              >
                                {u.role === 'i女er' ? '设为User' : '设为i女er'}
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-[#f7f5e6] p-10 rounded-[3rem] border border-black/5 space-y-8 animate-in slide-in-from-bottom-10 duration-500">
            <div className="space-y-2">
              <h3 className="text-2xl font-black flex items-center space-x-3">
                <Ban size={28} />
                <span>违禁词管理库</span>
              </h3>
              <p className="text-zinc-500 font-medium">配置后即刻全站生效。多个词请用逗号或换行分隔。</p>
            </div>
            
            <textarea 
              value={bannedWordsInput}
              onChange={(e) => setBannedWordsInput(e.target.value)}
              className="w-full h-80 p-8 bg-[#fdfcf0] rounded-[2rem] border border-black/5 focus:outline-none focus:ring-4 ring-black/5 font-mono text-base leading-relaxed resize-none"
              placeholder="输入违禁词..."
            />
            
            <div className="flex justify-end">
              <button 
                onClick={handleSaveWords}
                className="bg-black text-[#fdfcf0] px-12 py-5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-2xl shadow-black/10 hover:opacity-80 transition-all"
              >
                保存并同步云端
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
