import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Post, Profile } from '../types';
import { X, Send, Image as ImageIcon, Loader2, User, Share2, Search, Users, Check } from 'lucide-react';
import Toast from './Toast';

interface Comment {
  id: string;
  content: string;
  images: string[];
  created_at: string;
  profiles: Profile;
}

interface CommentSectionProps {
  post: Post;
  onClose: () => void;
}

const CommentSection: React.FC<CommentSectionProps> = ({ post, onClose }) => {
  const { user, profile, isDemo } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [content, setContent] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Share States
  const [sharingComment, setSharingComment] = useState<Comment | null>(null);
  const [shareTargets, setShareTargets] = useState<{friends: Profile[], groups: any[]}>({friends: [], groups: []});
  const [sentTargets, setSentTargets] = useState<Set<string>>(new Set());
  const [shareSearch, setShareSearch] = useState('');

  const fetchComments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`*, profiles(username, avatar_url)`)
        .eq('post_id', post.id)
        .order('created_at', { ascending: true });
      if (!error) setComments(data as unknown as Comment[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchComments(); }, [post.id]);

  // Content moderation function
  const checkContent = async (text: string): Promise<boolean> => {
    try {
      const { data: words } = await supabase.from('sensitive_words').select('word');
      if (!words) return true;
      
      const found = words.some(w => text.toLowerCase().includes(w.word.toLowerCase()));
      if (found) {
        setToast({ msg: '评论内容包含辱女词或违禁词，请修改后发布。', type: 'error' });
        return false;
      }
      return true;
    } catch (err) {
      console.error('Validation error:', err);
      return true; 
    }
  };

  const handleShareClick = async (comment: Comment) => {
    setSharingComment(comment);
    setSentTargets(new Set());
    
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
    if (!sharingComment || isDemo) {
      setSentTargets(prev => new Set(prev).add(targetId));
      return;
    }

    const shareContent = `「分享评论」: ${sharingComment.content.substring(0, 100)}${sharingComment.content.length > 100 ? '...' : ''}\n来自 @${sharingComment.profiles.username}`;
    const payload: any = { sender_id: user?.id, content: shareContent };
    if (isGroup) payload.group_id = targetId;
    else payload.receiver_id = targetId;

    const { error } = await supabase.from('messages').insert(payload);
    if (!error) {
      setSentTargets(prev => new Set(prev).add(targetId));
    } else {
      setToast({ msg: '发送失败', type: 'error' });
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files) as File[];
      setImages(prev => [...prev, ...newFiles]);
      setPreviews(prev => [...prev, ...newFiles.map(f => URL.createObjectURL(f))]);
    }
  };

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!content.trim() && images.length === 0) return;
    
    setSubmitting(true);

    // Validate content before submission
    const isValid = await checkContent(content);
    if (!isValid) {
      setSubmitting(false);
      return;
    }

    try {
      let uploadedUrls: string[] = [];
      if (!isDemo) {
        for (const file of images) {
          const path = `${user?.id}/${Date.now()}-${file.name}`;
          const { error } = await supabase.storage.from('comment-images').upload(path, file);
          if (error) throw error;
          const { data: { publicUrl } } = supabase.storage.from('comment-images').getPublicUrl(path);
          uploadedUrls.push(publicUrl);
        }
        await supabase.from('comments').insert({ post_id: post.id, user_id: user?.id, content, images: uploadedUrls });
      } else {
        setToast({ msg: '演示模式：发布拦截逻辑已验证通过。', type: 'success' });
      }
      setContent('');
      setImages([]);
      setPreviews([]);
      fetchComments();
      setToast({ msg: '评论已发布', type: 'success' });
    } catch (err) {
      setToast({ msg: '发布失败', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredShareFriends = shareTargets.friends.filter(f => f.username.toLowerCase().includes(shareSearch.toLowerCase()));
  const filteredShareGroups = shareTargets.groups.filter(g => g.name.toLowerCase().includes(shareSearch.toLowerCase()));

  return (
    <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center bg-black/20 backdrop-blur-sm p-0 md:p-4">
      <div className="bg-[#fdfcf0] w-full max-w-2xl h-[90vh] md:h-[80vh] rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
        {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
        
        <header className="p-6 border-b border-black/5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3">
            <h3 className="font-black text-xl">回复</h3>
            <span className="text-zinc-300 font-bold text-xs uppercase tracking-widest">@{post.profiles.username}</span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full transition-colors"><X size={20} /></button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
          <div className="opacity-40 border-l-2 border-black/10 pl-6 mb-10">
            <p className="text-sm font-medium">{post.content}</p>
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-zinc-300" /></div>
          ) : comments.length === 0 ? (
            <div className="text-center py-20 text-zinc-300 text-[10px] font-black uppercase tracking-[0.4em]">虚位以待</div>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex space-x-4 group/comment">
                <div className="w-10 h-10 rounded-full bg-[#f0eee0] overflow-hidden flex-shrink-0">
                  {c.profiles.avatar_url ? <img src={c.profiles.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-zinc-400"><User size={18} /></div>}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-black text-sm">{c.profiles.username}</span>
                      <span className="text-[10px] text-zinc-300 font-bold">{new Date(c.created_at).toLocaleDateString()}</span>
                    </div>
                    <button onClick={() => handleShareClick(c)} className="opacity-0 group-hover/comment:opacity-100 p-2 text-zinc-400 hover:text-black transition-all">
                      <Share2 size={14} />
                    </button>
                  </div>
                  <p className="text-sm font-medium text-black leading-relaxed">{c.content}</p>
                  {c.images?.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {c.images.map((img, i) => <img key={i} src={img} className="rounded-xl border border-black/5" />)}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Internal Share Modal for Comments */}
        {sharingComment && (
          <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 backdrop-blur-md">
            <div className="bg-[#fdfcf0] w-full max-w-md h-[60vh] rounded-t-[2.5rem] shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-300">
               <header className="p-6 border-b border-black/5 flex items-center justify-between">
                  <h2 className="text-lg font-black tracking-tight">转发评论至对话</h2>
                  <button onClick={() => setSharingComment(null)} className="p-2 hover:bg-black/5 rounded-full"><X size={18} /></button>
               </header>
               <div className="p-4">
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"><Search size={14} /></div>
                    <input type="text" placeholder="搜索对话..." value={shareSearch} onChange={(e) => setShareSearch(e.target.value)} className="w-full bg-[#f7f5e6] p-3 pl-9 rounded-2xl border border-black/5 focus:outline-none text-xs font-bold" />
                  </div>
               </div>
               <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-2">
                  {filteredShareGroups.map(g => (
                    <div key={g.id} className="flex items-center justify-between p-3 hover:bg-black/5 rounded-2xl">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-black/5 flex items-center justify-center"><Users size={16} /></div>
                        <span className="font-bold text-sm">{g.name}</span>
                      </div>
                      <button onClick={() => sendInternalMessage(g.id, true)} disabled={sentTargets.has(g.id)} className={`px-4 py-2 rounded-full text-[10px] font-black ${sentTargets.has(g.id) ? 'text-zinc-400' : 'bg-black text-[#fdfcf0]'}`}>
                        {sentTargets.has(g.id) ? <Check size={14} /> : '发送'}
                      </button>
                    </div>
                  ))}
                  {filteredShareFriends.map(f => (
                    <div key={f.id} className="flex items-center justify-between p-3 hover:bg-black/5 rounded-2xl">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-[#f0eee0] overflow-hidden">
                          {f.avatar_url ? <img src={f.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-zinc-300 font-black">{f.username.charAt(0)}</div>}
                        </div>
                        <span className="font-bold text-sm">{f.username}</span>
                      </div>
                      <button onClick={() => sendInternalMessage(f.id, false)} disabled={sentTargets.has(f.id)} className={`px-4 py-2 rounded-full text-[10px] font-black ${sentTargets.has(f.id) ? 'text-zinc-400' : 'bg-black text-[#fdfcf0]'}`}>
                        {sentTargets.has(f.id) ? <Check size={14} /> : '发送'}
                      </button>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        )}

        <footer className="p-6 border-t border-black/5 bg-white/50 backdrop-blur-md">
          {previews.length > 0 && (
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 no-scrollbar">
              {previews.map((p, i) => (
                <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
                  <img src={p} className="w-full h-full object-cover" />
                  <button onClick={() => removeImage(i)} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1"><X size={10} /></button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end space-x-3">
            <button onClick={() => fileInputRef.current?.click()} className="p-3 text-zinc-400 hover:text-black transition-colors"><ImageIcon size={20} /></button>
            <input type="file" ref={fileInputRef} onChange={handleImageChange} multiple accept="image/*" className="hidden" />
            <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="写下你的回应..." className="flex-1 bg-[#f7f5e6] rounded-2xl p-4 text-sm focus:outline-none resize-none min-h-[56px] max-h-32" />
            <button disabled={submitting || (!content.trim() && images.length === 0)} onClick={handleSubmit} className="p-4 bg-black text-[#fdfcf0] rounded-2xl hover:opacity-80 disabled:opacity-20 transition-all">
              {submitting ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default CommentSection;