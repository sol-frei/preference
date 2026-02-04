import React, { useState, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Image as ImageIcon, X, Send, Loader2 } from 'lucide-react';
import Toast from './Toast';

interface PostComposerProps {
  onSuccess?: () => void;
  isFullScreen?: boolean;
}

const PostComposer: React.FC<PostComposerProps> = ({ onSuccess, isFullScreen = false }) => {
  const { user, profile } = useAuth();
  const [content, setContent] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files) as File[];
      setImages(prev => [...prev, ...newFiles]);
      const newPreviews = newFiles.map(file => URL.createObjectURL(file));
      setPreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const checkContent = async (text: string): Promise<boolean> => {
    try {
      const { data: words } = await supabase.from('sensitive_words').select('word');
      if (!words) return true;
      
      const found = words.some(w => text.toLowerCase().includes(w.word.toLowerCase()));
      if (found) {
        setToast({ msg: '贴文内容包含辱女词或违禁词，请修改后发布。', type: 'error' });
        return false;
      }
      return true;
    } catch (err) {
      console.error('Validation error:', err);
      return true; 
    }
  };

  const handleSubmit = async () => {
    if (!content.trim() && images.length === 0) return;
    
    setLoading(true);

    const isValid = await checkContent(content);
    if (!isValid) {
      setLoading(false);
      return;
    }

    try {
      const uploadedImageUrls: string[] = [];
      for (const file of images) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${user?.id}/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('post-images').upload(filePath, file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('post-images').getPublicUrl(filePath);
        uploadedImageUrls.push(publicUrl);
      }
      const { error: postError } = await supabase.from('posts').insert({
        user_id: user?.id,
        content,
        images: uploadedImageUrls,
        type: 'original'
      });
      if (postError) throw postError;
      
      setContent('');
      setImages([]);
      setPreviews([]);
      setToast({ msg: '发布成功', type: 'success' });
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error posting:', error);
      setToast({ msg: '发布失败，请稍后重试', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`flex flex-col h-full space-y-6 ${!isFullScreen ? 'border-b border-black/5 pb-6' : ''}`}>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="flex space-x-4 flex-1">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 bg-[#f0eee0] rounded-full border border-black/5 overflow-hidden shadow-sm">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-400 font-bold text-sm">
                {profile?.username?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>
        <div className="flex-1 flex flex-col">
          <div className="flex items-center mb-1">
             <span className="font-black text-sm">{profile?.username}</span>
          </div>
          <textarea
            autoFocus
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="表达你的偏爱..."
            className={`w-full bg-transparent text-lg md:text-xl resize-none focus:outline-none placeholder:text-zinc-400 font-medium ${isFullScreen ? 'min-h-[150px]' : 'min-h-[80px]'}`}
          />
          
          {previews.length > 0 && (
            <div className={`grid gap-4 mt-6 overflow-hidden ${previews.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {previews.map((src, idx) => (
                <div key={idx} className="relative aspect-video bg-[#f0eee0] overflow-hidden border border-black/5 rounded-[2rem] group">
                  <img src={src} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeImage(idx)}
                    className="absolute top-4 right-4 p-2 bg-black/60 text-white rounded-full hover:bg-black transition-all scale-0 group-hover:scale-100"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={`flex items-center justify-between sticky bottom-0 py-4 bg-[#fdfcf0] border-t border-black/[0.03] ${isFullScreen ? 'mt-auto' : ''}`}>
        <div className="flex space-x-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-2 p-3 text-zinc-400 hover:text-black transition-colors rounded-2xl hover:bg-black/5 group"
          >
            <ImageIcon size={24} />
            <span className="text-xs font-bold hidden sm:inline">多媒体</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageChange}
            multiple
            accept="image/*"
            className="hidden"
          />
        </div>
        
        <button
          onClick={handleSubmit}
          disabled={loading || (!content.trim() && images.length === 0)}
          className="bg-black text-[#fdfcf0] px-10 py-4 rounded-full text-sm font-black uppercase tracking-widest hover:opacity-80 disabled:opacity-20 transition-all flex items-center space-x-3 shadow-xl shadow-black/10"
        >
          {loading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <>
              <span>发布</span>
              <Send size={18} />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default PostComposer;