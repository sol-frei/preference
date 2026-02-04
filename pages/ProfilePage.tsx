import React, { useState, useEffect, useRef, useCallback } from 'react';
// @ts-ignore
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase, isConfigured } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import CollectionManager from '../components/CollectionManager';
import { Post, Profile } from '../types';
import { Heart, MessageCircle, Repeat, Bookmark, User as UserIcon, ArrowLeft, ShieldAlert, UserX, Camera, Settings as SettingsIcon, LogOut, X as CloseIcon, Folder, Loader2, ChevronLeft, Share2, Search, Users, Check } from 'lucide-react';
import Toast from '../components/Toast';

type TabType = 'posts' | 'replies' | 'reposts' | 'likes' | 'collections';

interface CommentWithPost {
  id: string;
  content: string;
  created_at: string;
  post: Post;
}

const ProfilePage: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const { user: currentUser, profile: currentProfile, isDemo, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('posts');
  
  const [posts, setPosts] = useState<Post[]>([]);
  const [replies, setReplies] = useState<CommentWithPost[]>([]);
  const [reposts, setReposts] = useState<Post[]>([]);
  const [likedPosts, setLikedPosts] = useState<Post[]>([]);
  const [userLikes, setUserLikes] = useState<Set<string>>(new Set());
  const [sensitiveWords, setSensitiveWords] = useState<{word: string, replacement: string}[]>([]);
  
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  // Share States
  const [sharePost, setSharePost] = useState<Post | null>(null);
  const [shareTargets, setShareTargets] = useState<{friends: Profile[], groups: any[]}>({friends: [], groups: []});
  const [sentTargets, setSentTargets] = useState<Set<string>>(new Set());
  const [shareSearch, setShareSearch] = useState('');

  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const isOwnProfile = currentProfile?.username === username;

  useEffect(() => {
    const handlePopState = () => {
      if (showEditModal) setShowEditModal(false);
      if (sharePost) setSharePost(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [showEditModal, sharePost]);

  const handleOpenEditModal = () => {
    setShowEditModal(true);
    window.history.pushState({ modal: 'settings' }, '');
  };

  const handleCloseEditModal = () => {
    if (showEditModal) navigate(-1);
  };

  const handleSignOut = async () => {
    if (window.confirm("确定要注销并退出登录吗？")) {
      setIsLoggingOut(true);
      try {
        await signOut();
        navigate('/login', { replace: true });
      } catch (err) {
        console.error('Logout error:', err);
        setIsLoggingOut(false);
      }
    }
  };

  const applyFilters = useCallback((content: string) => {
    if (!sensitiveWords.length) return content;
    let filtered = content;
    sensitiveWords.forEach(({ word, replacement }) => {
      const regex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      filtered = filtered.replace(regex, replacement || '***');
    });
    return filtered;
  }, [sensitiveWords]);

  const fetchUserLikes = async () => {
    if (currentUser && isConfigured && !isDemo) {
      const { data } = await supabase.from('likes').select('post_id').eq('user_id', currentUser.id);
      if (data) setUserLikes(new Set(data.map(l => l.post_id)));
    }
  };

  const handleToggleLike = async (post: Post) => {
    if (!currentUser || isDemo) return;
    const isLiked = userLikes.has(post.id);
    setUserLikes(prev => {
      const next = new Set(prev);
      if (isLiked) next.delete(post.id);
      else next.add(post.id);
      return next;
    });
    const updatePostInState = (prev: Post[]) => prev.map(p => p.id === post.id ? { ...p, likes_count: (p.likes_count || 0) + (isLiked ? -1 : 1) } : p);
    setPosts(updatePostInState);
    setReposts(updatePostInState);
    setLikedPosts(updatePostInState);
    try {
      if (isLiked) await supabase.from('likes').delete().eq('user_id', currentUser.id).eq('post_id', post.id);
      else await supabase.from('likes').insert({ user_id: currentUser.id, post_id: post.id });
    } catch { fetchUserLikes(); }
  };

  const handleShareClick = async (post: Post) => {
    setSharePost(post);
    setSentTargets(new Set());
    
    if (isDemo) {
      setShareTargets({
        friends: [{ id: 'demo-1', username: '演示好友', avatar_url: null, bio: '', is_first_login: false, created_at: '', role: 'user', is_banned: false }],
        groups: [{ id: 'demo-g1', name: '偏爱测试群' }]
      });
      return;
    }

    const { data: friends } = await supabase.rpc('get_mutual_follows', { uid: currentUser?.id });
    const { data: memberGroups } = await supabase.from('group_members').select('group:groups(*)').eq('user_id', currentUser?.id);
    
    setShareTargets({
      friends: (friends as Profile[]) || [],
      groups: memberGroups?.map(m => m.group) || []
    });
  };

  const sendInternalMessage = async (targetId: string, isGroup: boolean) => {
    if (!sharePost || isDemo) {
      setSentTargets(prev => new Set(prev).add(targetId));
      return;
    }

    const shareContent = `「分享动态」: ${sharePost.content.substring(0, 100)}${sharePost.content.length > 100 ? '...' : ''}\n来自 @${sharePost.profiles.username}`;
    const payload: any = { sender_id: currentUser?.id, content: shareContent };
    if (isGroup) payload.group_id = targetId;
    else payload.receiver_id = targetId;

    const { error } = await supabase.from('messages').insert(payload);
    if (!error) {
      setSentTargets(prev => new Set(prev).add(targetId));
    } else {
      setToast({ msg: '发送失败', type: 'error' });
    }
  };

  useEffect(() => {
    const fetchProfileData = async () => {
      if (isDemo || !isConfigured) {
        const mock: Profile = { id: 'demo', username: username || 'User', avatar_url: null, bio: '演示模式个人简介', is_first_login: false, created_at: '', role: 'user', is_banned: false };
        setProfile(mock);
        setEditUsername(mock.username);
        setEditBio(mock.bio || '');
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const { data: words } = await supabase.from('sensitive_words').select('word, replacement');
        if (words) setSensitiveWords(words);
        const { data: profileData, error: profileError } = await supabase.from('profiles').select('*').eq('username', username).single();
        if (profileError) throw profileError;
        setProfile(profileData as Profile);
        setEditUsername(profileData.username);
        setEditBio(profileData.bio || '');
        const { count: fers } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', profileData.id);
        const { count: fing } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profileData.id);
        setCounts({ followers: fers || 0, following: fing || 0 });
        if (currentUser && currentUser.id !== profileData.id) {
          const { data: followData } = await supabase.from('follows').select('*').eq('follower_id', currentUser.id).eq('following_id', profileData.id).single();
          setIsFollowing(!!followData);
        }
        await fetchUserLikes();
      } catch (error) { console.error(error); } finally { setLoading(false); }
    };
    if (username) fetchProfileData();
  }, [username, currentUser, isDemo]);

  useEffect(() => {
    if (!profile || isDemo || !isConfigured) return;
    if (activeTab === 'collections') return;
    const fetchTabData = async () => {
      setTabLoading(true);
      try {
        if (activeTab === 'posts') {
          const { data } = await supabase.from('posts').select(`*, profiles(username, avatar_url, role, is_banned)`).eq('user_id', profile.id).eq('type', 'original').order('created_at', { ascending: false });
          setPosts(data as unknown as Post[] || []);
        } else if (activeTab === 'reposts') {
          const { data } = await supabase.from('posts').select(`*, profiles(username, avatar_url, role, is_banned)`).eq('user_id', profile.id).eq('type', 'repost').order('created_at', { ascending: false });
          setReposts(data as unknown as Post[] || []);
        } else if (activeTab === 'replies') {
          const { data } = await supabase.from('comments').select(`*, post:posts(*, profiles(username, avatar_url, role, is_banned))`).eq('user_id', profile.id).order('created_at', { ascending: false });
          setReplies(data as unknown as CommentWithPost[] || []);
        } else if (activeTab === 'likes') {
          const { data } = await supabase.from('likes').select(`post:posts(*, profiles(username, avatar_url, role, is_banned))`).eq('user_id', profile.id).order('created_at', { ascending: false });
          setLikedPosts((data || []).map(i => i.post).filter(p => p) as unknown as Post[]);
        }
      } catch (err) { console.error(err); } finally { setTabLoading(false); }
    };
    fetchTabData();
  }, [activeTab, profile, isDemo]);

  const handleUpdateProfile = async () => {
    if (isDemo) return alert("演示模式无法修改");
    const { error } = await supabase.from('profiles').update({ username: editUsername, bio: editBio }).eq('id', currentUser?.id);
    if (!error) {
      handleCloseEditModal();
      await refreshProfile();
      setToast({ msg: '个人资料已更新', type: 'success' });
      navigate(`/profile/${editUsername}`);
    } else setToast({ msg: '更新失败，昵称可能已被占用', type: 'error' });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || isDemo) return;
    setUploadingAvatar(true);
    try {
      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const filePath = `${currentUser?.id}/avatar-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', currentUser?.id);
      setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null);
      await refreshProfile();
      setToast({ msg: '头像更新成功', type: 'success' });
    } catch (err) {
      setToast({ msg: '头像上传失败', type: 'error' });
    } finally { setUploadingAvatar(false); }
  };

  const renderPost = (post: Post) => (
    <div key={post.id} className="p-4 md:p-12 lg:px-20 hover:bg-black/[0.01] transition-colors group">
      <div className="flex space-x-6 md:space-x-10">
        <Link to={`/profile/${post.profiles.username}`} className="w-12 h-12 md:w-16 md:h-16 rounded-full border border-black/5 overflow-hidden bg-[#f0eee0] shadow-sm flex-shrink-0">
          {post.profiles.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" /> : <UserIcon size={28} className="m-auto mt-3 text-zinc-300" />}
        </Link>
        <div className="flex-1 space-y-4">
          <div className="flex items-center justify-between">
            <Link to={`/profile/${post.profiles.username}`} className="font-black text-lg hover:underline">{post.profiles.username}</Link>
            <span className="text-[10px] text-zinc-300 font-bold uppercase tracking-widest">{new Date(post.created_at).toLocaleDateString()}</span>
          </div>
          <p className="text-black text-lg md:text-xl leading-relaxed font-medium whitespace-pre-wrap">{applyFilters(post.content)}</p>
          {post.images?.length > 0 && (
            <div className={`grid gap-4 mt-6 rounded-[2rem] overflow-hidden ${post.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {post.images.map((img, i) => <img key={i} src={img} className="w-full h-auto max-h-[800px] object-cover border border-black/5" />)}
            </div>
          )}
          <div className="flex items-center justify-between pt-6 text-zinc-400">
            <button onClick={() => handleToggleLike(post)} className={`flex items-center space-x-3 transition-all active:scale-125 ${userLikes.has(post.id) ? 'text-red-500' : 'hover:text-red-500'}`}>
              <Heart size={22} fill={userLikes.has(post.id) ? "currentColor" : "none"} /><span className="text-sm font-bold">{post.likes_count || 0}</span>
            </button>
            <button className="flex items-center space-x-3 hover:text-black transition-colors"><MessageCircle size={22} /><span className="text-sm font-bold">{post.comments_count || 0}</span></button>
            <button className="hover:text-green-500 transition-colors"><Repeat size={22} /></button>
            <button className="hover:text-black transition-colors"><Bookmark size={22} /></button>
            <button onClick={() => handleShareClick(post)} className="hover:text-black active:scale-90 transition-transform"><Share2 size={20} /></button>
          </div>
        </div>
      </div>
    </div>
  );

  const filteredShareFriends = shareTargets.friends.filter(f => f.username.toLowerCase().includes(shareSearch.toLowerCase()));
  const filteredShareGroups = shareTargets.groups.filter(g => g.name.toLowerCase().includes(shareSearch.toLowerCase()));

  if (loading) return <div className="flex min-h-screen bg-[#fdfcf0] items-center justify-center"><Loader2 size={32} className="animate-spin text-black" /></div>;
  if (!profile) return null;

  return (
    <div className="flex flex-col min-h-screen w-full bg-[#fdfcf0] pb-24 text-black">
      <Sidebar />
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <main className="w-full">
        <header className="sticky top-0 z-40 bg-[#fdfcf0]/80 backdrop-blur-md border-b border-black/5 p-4 md:p-8 flex items-center justify-between">
          <div className="flex items-center space-x-4 md:space-x-8">
            <Link to="/" className="hover:bg-black/5 p-3 rounded-full transition-colors"><ArrowLeft size={28} /></Link>
            <div className="flex flex-col"><h1 className="text-xl md:text-2xl font-black leading-tight tracking-tight">{profile.username}</h1><span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{posts.length} 动态</span></div>
          </div>
          {isOwnProfile && <button onClick={handleOpenEditModal} className="p-3 hover:bg-black/5 rounded-full transition-colors text-zinc-400 hover:text-black"><SettingsIcon size={24} /></button>}
        </header>

        <section className="p-6 md:p-16 lg:px-24 space-y-12">
          <div className="relative group w-32 h-32 md:w-56 md:h-56 rounded-full border-[6px] border-[#fdfcf0] shadow-2xl overflow-hidden bg-[#f0eee0]">
            {profile.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-zinc-300 text-6xl font-black">{profile.username.charAt(0).toUpperCase()}</div>}
            {isOwnProfile && <button onClick={() => avatarInputRef.current?.click()} className="absolute bottom-2 right-2 md:bottom-6 md:right-6 p-4 bg-black text-[#fdfcf0] rounded-full shadow-2xl opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100"><Camera size={24} /></button>}
            <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
          </div>
          <div className="space-y-6">
            <h2 className="text-4xl md:text-7xl font-black tracking-tighter">{profile.username}</h2>
            <p className="text-zinc-500 text-xl md:text-2xl font-medium leading-relaxed mt-6 max-w-4xl">{profile.bio || '在这个极简的世界里，保持沉默。'}</p>
            <div className="flex space-x-12 text-base md:text-lg font-bold pt-8 border-t border-black/5">
              <button className="hover:underline flex items-center space-x-3"><span>{counts.following}</span><span className="text-zinc-400 font-medium uppercase tracking-widest text-xs">关注中</span></button>
              <button className="hover:underline flex items-center space-x-3"><span>{counts.followers}</span><span className="text-zinc-400 font-medium uppercase tracking-widest text-xs">关注者</span></button>
            </div>
          </div>
        </section>

        <div className="flex border-b border-black/5 sticky top-[64px] md:top-[112px] bg-[#fdfcf0]/90 backdrop-blur-md z-30 overflow-x-auto no-scrollbar">
          {(['posts', 'replies', 'reposts', 'likes', 'collections'] as TabType[]).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 min-w-[80px] py-6 text-[12px] font-black uppercase tracking-[0.3em] transition-all relative ${activeTab === tab ? 'text-black' : 'text-zinc-400 hover:text-black'}`}>
              {tab === 'posts' ? '贴文' : tab === 'replies' ? '回复' : tab === 'reposts' ? '转发' : tab === 'likes' ? '喜欢' : '收藏'}{activeTab === tab && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-[4px] bg-black rounded-full"></div>}
            </button>
          ))}
        </div>

        <div className="min-h-[600px] w-full pt-4 divide-y divide-black/[0.03]">
          {tabLoading ? <div className="flex justify-center py-40"><Loader2 size={24} className="animate-spin text-zinc-300" /></div> : activeTab === 'collections' ? <div className="p-6 md:p-16 lg:px-24 max-w-4xl"><CollectionManager /></div> : (posts.length ? posts.map(renderPost) : <EmptyState />)}
        </div>
      </main>

      {/* Share Modal */}
      {sharePost && (
        <div className="fixed inset-0 z-[150] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-md p-0 md:p-4">
          <div className="bg-[#fdfcf0] w-full max-w-md h-[70vh] md:h-auto md:max-h-[80vh] rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
             <header className="p-6 border-b border-black/5 flex items-center justify-between">
                <h2 className="text-xl font-black tracking-tight">分享给好友</h2>
                <button onClick={() => setSharePost(null)} className="p-2 hover:bg-black/5 rounded-full"><CloseIcon size={20} /></button>
             </header>
             <div className="p-4"><div className="relative"><div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"><Search size={14} /></div><input type="text" placeholder="搜索对话..." value={shareSearch} onChange={(e) => setShareSearch(e.target.value)} className="w-full bg-[#f7f5e6] p-3 pl-9 rounded-2xl border border-black/5 focus:outline-none text-xs font-bold" /></div></div>
             <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-2">
                {filteredShareGroups.map(g => (
                  <div key={g.id} className="flex items-center justify-between p-3 hover:bg-black/5 rounded-2xl transition-colors">
                    <div className="flex items-center space-x-3"><div className="w-10 h-10 rounded-xl bg-black/5 flex items-center justify-center text-zinc-400"><Users size={18} /></div><span className="font-bold text-sm">{g.name}</span></div>
                    <button onClick={() => sendInternalMessage(g.id, true)} disabled={sentTargets.has(g.id)} className={`px-4 py-2 rounded-full text-[10px] font-black ${sentTargets.has(g.id) ? 'text-zinc-400' : 'bg-black text-[#fdfcf0]'}`}>{sentTargets.has(g.id) ? <Check size={14} /> : '发送'}</button>
                  </div>
                ))}
                {filteredShareFriends.map(f => (
                  <div key={f.id} className="flex items-center justify-between p-3 hover:bg-black/5 rounded-2xl transition-colors">
                    <div className="flex items-center space-x-3"><div className="w-10 h-10 rounded-full bg-[#f0eee0] overflow-hidden">{f.avatar_url ? <img src={f.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-zinc-300 font-black">{f.username.charAt(0)}</div>}</div><span className="font-bold text-sm">{f.username}</span></div>
                    <button onClick={() => sendInternalMessage(f.id, false)} disabled={sentTargets.has(f.id)} className={`px-4 py-2 rounded-full text-[10px] font-black ${sentTargets.has(f.id) ? 'text-zinc-400' : 'bg-black text-[#fdfcf0]'}`}>{sentTargets.has(f.id) ? <Check size={14} /> : '发送'}</button>
                  </div>
                ))}
             </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 z-[100] bg-[#fdfcf0] flex flex-col animate-in slide-in-from-bottom duration-300">
          <header className="p-4 md:p-6 border-b border-black/5 flex items-center justify-between sticky top-0 bg-[#fdfcf0] z-10"><button onClick={handleCloseEditModal} className="text-sm font-bold text-zinc-500 hover:text-black transition-colors flex items-center space-x-1"><ChevronLeft size={20} /><span>取消</span></button><h2 className="text-lg font-black uppercase tracking-tight">账户设置</h2><div className="w-12"></div></header>
          <div className="flex-1 overflow-y-auto no-scrollbar px-6 py-8 md:px-12 md:max-w-3xl md:mx-auto w-full"><div className="space-y-10"><div className="space-y-4"><label className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-3">公开昵称</label><input value={editUsername} onChange={(e) => setEditUsername(e.target.value)} className="w-full bg-[#f7f5e6] p-6 rounded-[2rem] border border-black/5 font-bold text-lg" placeholder="你的昵称" /></div><div className="space-y-4"><label className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-3">个人介绍</label><textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} className="w-full bg-[#f7f5e6] p-6 rounded-[2rem] border border-black/5 min-h-[180px] resize-none font-medium text-lg" placeholder="介绍一下自己..." /></div><div className="mt-12 space-y-4 border-t border-black/[0.03] pt-10 pb-32"><button onClick={handleUpdateProfile} className="w-full p-5 rounded-[2rem] bg-black text-[#fdfcf0] font-black uppercase tracking-widest text-sm">保存所有更改</button><button onClick={handleSignOut} className="w-full flex items-center justify-center space-x-2 py-4 text-red-500 font-black uppercase tracking-widest text-[10px]"><LogOut size={14} /><span>退出当前登录</span></button></div></div></div>
        </div>
      )}
    </div>
  );
};

const EmptyState = () => (
  <div className="py-60 flex flex-col items-center justify-center space-y-8 text-zinc-200">
    <div className="w-24 h-24 rounded-full border-2 border-zinc-100 flex items-center justify-center"><UserIcon size={40} strokeWidth={1} /></div>
    <span className="text-[12px] font-black uppercase tracking-[0.6em]">尘埃未落</span>
  </div>
);

export default ProfilePage;