import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isConfigured } from '../services/supabaseClient';
import PostComposer from '../components/PostComposer';
import CommentSection from '../components/CommentSection';
import { Post, Profile } from '../types';
import { Heart, MessageCircle, Repeat, Bookmark, User, Share2, Sparkles, PenLine, X, Loader2, RefreshCw, ChevronLeft, Search, Send, Users, Check } from 'lucide-react';
// @ts-ignore
import { Link, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../contexts/AuthContext';
import Toast from '../components/Toast';

const POSTS_PER_PAGE = 10;
const PULL_THRESHOLD = 70;

const HomePage: React.FC = () => {
  const { user, isDemo } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchUsers, setSearchUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [sensitiveWords, setSensitiveWords] = useState<{word: string, replacement: string}[]>([]);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [activeCommentPost, setActiveCommentPost] = useState<Post | null>(null);
  const [userLikes, setUserLikes] = useState<Set<string>>(new Set());
  const [userBookmarks, setUserBookmarks] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  
  // Share to Chat States
  const [sharePost, setSharePost] = useState<Post | null>(null);
  const [shareTargets, setShareTargets] = useState<{friends: Profile[], groups: any[]}>({friends: [], groups: []});
  const [sentTargets, setSentTargets] = useState<Set<string>>(new Set());
  const [shareSearch, setShareSearch] = useState('');

  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const startY = useRef(0);

  useEffect(() => {
    const handlePopState = () => {
      if (isComposerOpen) setIsComposerOpen(false);
      if (sharePost) setSharePost(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isComposerOpen, sharePost]);

  const handleOpenComposer = () => {
    setIsComposerOpen(true);
    window.history.pushState({ modal: 'composer' }, '');
  };

  const handleCloseComposer = () => {
    if (isComposerOpen) navigate(-1);
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

  const fetchPosts = async (isInitial = true) => {
    if (!isConfigured) {
      if (isInitial) {
        setPosts([{
          id: '1', user_id: 'demo', content: '欢迎来到 Preference。', 
          images: [], type: 'original', parent_id: null, created_at: new Date().toISOString(),
          profiles: { username: 'Admin', avatar_url: null, id: '1', bio: '', is_first_login: false, created_at: '', role: 'admin', is_banned: false }
        }]);
        setHasMore(false);
      }
      setLoading(false);
      return;
    }

    if (isInitial && !refreshing) setLoading(true);
    try {
      const from = isInitial ? 0 : posts.length;
      const to = from + POSTS_PER_PAGE - 1;

      if (isInitial && searchTerm.trim()) {
        const { data: userData } = await supabase.from('profiles').select('*').ilike('username', `%${searchTerm.trim()}%`).limit(5);
        setSearchUsers((userData as Profile[]) || []);
      } else if (isInitial) {
        setSearchUsers([]);
      }

      let query = supabase.from('posts').select(`*, profiles (username, avatar_url, role, is_banned)`).order('created_at', { ascending: false }).range(from, to);
      if (searchTerm.trim()) query = query.ilike('content', `%${searchTerm.trim()}%`);

      const { data } = await query;
      if (data) {
        const newPosts = data as unknown as Post[];
        if (isInitial) setPosts(newPosts);
        else setPosts(prev => [...prev, ...newPosts]);
        setHasMore(newPosts.length === POSTS_PER_PAGE);

        if (user && isInitial) {
          const { data: likes } = await supabase.from('likes').select('post_id').eq('user_id', user.id);
          if (likes) setUserLikes(new Set(likes.map(l => l.post_id)));
          const { data: collections } = await supabase.from('collections').select('id').eq('user_id', user.id);
          if (collections?.length) {
            const { data: items } = await supabase.from('collection_items').select('post_id').in('collection_id', collections.map(c => c.id));
            if (items) setUserBookmarks(new Set(items.map(i => i.post_id)));
          }
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setPullDistance(0);
    }
  };

  const handleShareClick = async (post: Post) => {
    setSharePost(post);
    setSentTargets(new Set());
    window.history.pushState({ modal: 'share' }, '');
    
    if (isDemo) {
      setShareTargets({
        friends: [{ id: 'demo-1', username: '演示好友', avatar_url: null, bio: '', is_first_login: false, created_at: '', role: 'user', is_banned: false }],
        groups: [{ id: 'demo-g1', name: '偏爱测试群' }]
      });
      return;
    }

    const { data: friends } = await supabase.rpc('get_mutual_follows', { uid: user?.id });
    const { data: memberGroups } = await supabase.from('group_members').select('group:groups(*)').eq('user_id', user?.id);
    
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

    const content = `「分享动态」: ${sharePost.content.substring(0, 100)}${sharePost.content.length > 100 ? '...' : ''}\n来自 @${sharePost.profiles.username}`;
    const payload: any = { sender_id: user?.id, content };
    if (isGroup) payload.group_id = targetId;
    else payload.receiver_id = targetId;

    const { error } = await supabase.from('messages').insert(payload);
    if (!error) {
      setSentTargets(prev => new Set(prev).add(targetId));
    } else {
      setToast({ msg: '发送失败', type: 'error' });
    }
  };

  const handleToggleLike = async (post: Post) => {
    if (!user || isDemo) return;
    const isLiked = userLikes.has(post.id);
    setUserLikes(prev => { const next = new Set(prev); isLiked ? next.delete(post.id) : next.add(post.id); return next; });
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes_count: (p.likes_count || 0) + (isLiked ? -1 : 1) } : p));
    try {
      if (isLiked) await supabase.from('likes').delete().eq('user_id', user.id).eq('post_id', post.id);
      else await supabase.from('likes').insert({ user_id: user.id, post_id: post.id });
    } catch { fetchPosts(true); }
  };

  const handleRepost = async (post: Post) => {
    if (!user || isDemo) return;
    if (window.confirm('转发此动态到你的主页？')) {
      try {
        const { error } = await supabase.from('posts').insert({
          user_id: user.id,
          content: post.content,
          images: post.images,
          type: 'repost',
          parent_id: post.id
        });
        if (!error) setToast({ msg: '已转发至你的个人页', type: 'success' });
      } catch { setToast({ msg: '转发失败', type: 'error' }); }
    }
  };

  const handleToggleBookmark = async (post: Post) => {
    if (!user || isDemo) return;
    const isBookmarked = userBookmarks.has(post.id);
    setUserBookmarks(prev => { const next = new Set(prev); isBookmarked ? next.delete(post.id) : next.add(post.id); return next; });
    try {
      const { data: col } = await supabase.from('collections').select('id').eq('user_id', user.id).eq('name', '默认收藏').single();
      if (!col) return;
      if (isBookmarked) await supabase.from('collection_items').delete().eq('collection_id', col.id).eq('post_id', post.id);
      else await supabase.from('collection_items').insert({ collection_id: col.id, post_id: post.id });
    } catch { fetchPosts(true); }
  };

  useEffect(() => {
    const timer = setTimeout(() => fetchPosts(true), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (isConfigured && !isDemo) {
      const channel = supabase.channel('home_realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => fetchPosts(true)).subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [isDemo, user?.id]);

  const handleTouchStart = (e: React.TouchEvent) => { if (window.scrollY === 0) { startY.current = e.touches[0].pageY; setIsPulling(true); } };
  const handleTouchMove = (e: React.TouchEvent) => { if (isPulling) { const diff = e.touches[0].pageY - startY.current; if (diff > 0 && window.scrollY === 0) setPullDistance(Math.min(Math.pow(diff, 0.85), 120)); else setIsPulling(false); } };
  const handleTouchEnd = () => { if (pullDistance >= PULL_THRESHOLD) { setRefreshing(true); fetchPosts(true); } else setPullDistance(0); setIsPulling(false); };

  const filteredShareFriends = shareTargets.friends.filter(f => f.username.toLowerCase().includes(shareSearch.toLowerCase()));
  const filteredShareGroups = shareTargets.groups.filter(g => g.name.toLowerCase().includes(shareSearch.toLowerCase()));

  return (
    <div className="flex flex-col min-h-screen w-full bg-[#fdfcf0] pb-32 text-black relative touch-pan-y" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      <Sidebar />
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="absolute left-0 right-0 flex justify-center pointer-events-none z-50 transition-transform duration-200" style={{ transform: `translateY(${pullDistance}px)`, top: '-40px', opacity: pullDistance / PULL_THRESHOLD }}>
        <div className={`p-2 bg-black rounded-full shadow-xl ${pullDistance >= PULL_THRESHOLD ? 'scale-110' : 'scale-100'}`}>
          <RefreshCw size={20} className={`text-[#fdfcf0] ${refreshing ? 'animate-spin' : ''}`} style={{ transform: `rotate(${pullDistance * 3}deg)` }} />
        </div>
      </div>

      <main className="w-full transition-transform duration-200" style={{ transform: `translateY(${pullDistance > 0 ? pullDistance * 0.5 : 0}px)` }}>
        <header className="w-full p-6 md:px-12 bg-[#fdfcf0]/80 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between border-b border-black/[0.02]">
          <div className="flex items-center space-x-3">
            <Sparkles size={20} />
            <h1 className="text-xl font-black uppercase tracking-tight">时间轴</h1>
            {refreshing && <Loader2 size={16} className="animate-spin text-zinc-400" />}
          </div>
          
          <div className="flex items-center space-x-2">
            <div className={`relative flex items-center transition-all duration-300 ${isSearchOpen ? 'w-[180px] sm:w-[260px] opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}>
              <div className="absolute left-3 text-zinc-400"><Search size={14} /></div>
              <input type="text" placeholder="搜索动态..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#f7f5e6] border border-black/5 p-2 pl-9 rounded-full focus:outline-none focus:border-black/20 text-xs font-medium" />
            </div>
            <button onClick={() => { setIsSearchOpen(!isSearchOpen); if (isSearchOpen) setSearchTerm(''); }} className={`p-2.5 rounded-full transition-all ${isSearchOpen ? 'bg-black text-[#fdfcf0]' : 'hover:bg-black/5 text-zinc-600'}`}>
              {isSearchOpen ? <X size={18} /> : <Search size={20} />}
            </button>
          </div>
        </header>
        
        <div className="w-full divide-y divide-black/[0.03]">
          {posts.map((post) => (
            <div key={post.id} className="p-4 md:p-12 lg:px-20 hover:bg-black/[0.01] transition-colors">
              <div className="flex space-x-6 md:space-x-10">
                <Link to={`/profile/${post.profiles.username}`} className="flex-shrink-0">
                  <div className="w-12 h-12 md:w-16 md:h-16 rounded-full border border-black/5 overflow-hidden bg-[#f0eee0]">
                    {post.profiles.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-zinc-400"><User size={28} /></div>}
                  </div>
                </Link>
                <div className="flex-1 space-y-4">
                  <div className="flex items-center justify-between">
                    <Link to={`/profile/${post.profiles.username}`} className="font-black text-lg hover:underline">{post.profiles.username}</Link>
                    <span className="text-[10px] text-zinc-300 font-bold uppercase tracking-widest">{new Date(post.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-black text-lg md:text-xl leading-relaxed font-medium">{applyFilters(post.content)}</p>
                  {post.images?.length > 0 && (
                    <div className={`grid gap-4 mt-6 rounded-[2rem] overflow-hidden ${post.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      {post.images.map((img, i) => <img key={i} src={img} className="w-full h-auto max-h-[800px] object-cover border border-black/5" />)}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-6 text-zinc-400">
                    <button onClick={() => handleToggleLike(post)} className={`flex items-center space-x-3 transition-all active:scale-125 ${userLikes.has(post.id) ? 'text-red-500' : ''}`}><Heart size={20} fill={userLikes.has(post.id) ? "currentColor" : "none"} /><span className="text-xs font-bold">{post.likes_count || 0}</span></button>
                    <button onClick={() => setActiveCommentPost(post)} className="flex items-center space-x-3 hover:text-black"><MessageCircle size={20} /><span className="text-xs font-bold">{post.comments_count || 0}</span></button>
                    <button onClick={() => handleRepost(post)} className="hover:text-green-600"><Repeat size={20} /></button>
                    <button onClick={() => handleToggleBookmark(post)} className={`transition-all ${userBookmarks.has(post.id) ? 'text-black scale-110' : 'hover:text-black'}`}><Bookmark size={20} fill={userBookmarks.has(post.id) ? "currentColor" : "none"} /></button>
                    <button onClick={() => handleShareClick(post)} className="hover:text-black active:scale-90 transition-transform"><Share2 size={20} /></button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Share Modal */}
      {sharePost && (
        <div className="fixed inset-0 z-[150] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-md p-0 md:p-4">
          <div className="bg-[#fdfcf0] w-full max-w-md h-[70vh] md:h-auto md:max-h-[80vh] rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
             <header className="p-6 border-b border-black/5 flex items-center justify-between">
                <h2 className="text-xl font-black tracking-tight">分享给好友</h2>
                <button onClick={() => setSharePost(null)} className="p-2 hover:bg-black/5 rounded-full"><X size={20} /></button>
             </header>
             <div className="p-4">
                <div className="relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"><Search size={14} /></div>
                  <input type="text" placeholder="搜索对话..." value={shareSearch} onChange={(e) => setShareSearch(e.target.value)} className="w-full bg-[#f7f5e6] p-3 pl-9 rounded-2xl border border-black/5 focus:outline-none text-xs font-bold" />
                </div>
             </div>
             <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-2">
                {filteredShareGroups.length > 0 && <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2 mb-2">群聊</div>}
                {filteredShareGroups.map(g => (
                  <div key={g.id} className="flex items-center justify-between p-3 hover:bg-black/5 rounded-2xl transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-black/5 flex items-center justify-center text-zinc-400"><Users size={18} /></div>
                      <span className="font-bold text-sm">{g.name}</span>
                    </div>
                    <button 
                      onClick={() => sendInternalMessage(g.id, true)}
                      disabled={sentTargets.has(g.id)}
                      className={`px-4 py-2 rounded-full text-[10px] font-black uppercase transition-all ${sentTargets.has(g.id) ? 'bg-zinc-100 text-zinc-400' : 'bg-black text-[#fdfcf0] hover:opacity-80'}`}
                    >
                      {sentTargets.has(g.id) ? <Check size={14} className="mx-auto" /> : '发送'}
                    </button>
                  </div>
                ))}
                
                {filteredShareFriends.length > 0 && <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2 mt-4 mb-2">好友</div>}
                {filteredShareFriends.map(f => (
                  <div key={f.id} className="flex items-center justify-between p-3 hover:bg-black/5 rounded-2xl transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-[#f0eee0] overflow-hidden">
                        {f.avatar_url ? <img src={f.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-zinc-300 font-black">{f.username.charAt(0)}</div>}
                      </div>
                      <span className="font-bold text-sm">{f.username}</span>
                    </div>
                    <button 
                      onClick={() => sendInternalMessage(f.id, false)}
                      disabled={sentTargets.has(f.id)}
                      className={`px-4 py-2 rounded-full text-[10px] font-black uppercase transition-all ${sentTargets.has(f.id) ? 'bg-zinc-100 text-zinc-400' : 'bg-black text-[#fdfcf0] hover:opacity-80'}`}
                    >
                      {sentTargets.has(f.id) ? <Check size={14} className="mx-auto" /> : '发送'}
                    </button>
                  </div>
                ))}
                
                {shareSearch && filteredShareFriends.length === 0 && filteredShareGroups.length === 0 && (
                  <div className="py-20 text-center text-zinc-300 text-[10px] font-black uppercase">找不到匹配项</div>
                )}
             </div>
          </div>
        </div>
      )}

      {activeCommentPost && <CommentSection post={activeCommentPost} onClose={() => { setActiveCommentPost(null); fetchPosts(true); }} />}
      <button onClick={handleOpenComposer} className="fixed bottom-24 right-6 w-16 h-16 bg-black text-[#fdfcf0] rounded-full shadow-2xl flex items-center justify-center transition-all z-50 active:scale-90"><PenLine size={24} /></button>

      {isComposerOpen && (
        <div className="fixed inset-0 z-[100] bg-[#fdfcf0] flex flex-col animate-in slide-in-from-bottom duration-300">
          <header className="p-4 md:p-6 border-b border-black/5 flex items-center justify-between sticky top-0 bg-[#fdfcf0] z-10">
            <button onClick={handleCloseComposer} className="text-sm font-bold text-zinc-500 hover:text-black transition-colors flex items-center space-x-1"><ChevronLeft size={20} /><span>取消</span></button>
            <h2 className="text-lg font-black uppercase tracking-tight">发布动态</h2>
            <div className="w-12"></div>
          </header>
          <div className="flex-1 overflow-y-auto px-6 py-8 md:px-12 no-scrollbar">
            <PostComposer onSuccess={() => { fetchPosts(true); handleCloseComposer(); }} isFullScreen={true} />
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;