import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { supabase, isConfigured } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Bell, Heart, MessageCircle, UserPlus, Repeat } from 'lucide-react';
import { Notification } from '../types';

const NotificationsPage: React.FC = () => {
  const { user, isDemo, refreshUnreadCounts } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const markAsRead = async () => {
    if (!user || isDemo || !isConfigured) return;
    await supabase
      .from('notifications')
      .update({ read_status: true })
      .eq('user_id', user.id)
      .eq('read_status', false);
    
    refreshUnreadCounts();
  };

  useEffect(() => {
    if (isDemo || !isConfigured) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select(`*, actor_profile:profiles!notifications_actor_id_fkey (username, avatar_url)`)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
      if (!error) {
        setNotifications(data as unknown as Notification[]);
        markAsRead();
      }
      setLoading(false);
    };
    fetchNotifications();
  }, [user, isDemo]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'like': return <Heart className="text-red-500" size={18} fill="currentColor" />;
      case 'comment': return <MessageCircle className="text-blue-500" size={18} />;
      case 'follow': return <UserPlus className="text-purple-500" size={18} />;
      case 'repost': return <Repeat className="text-green-500" size={18} />;
      default: return <Bell size={18} />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen w-full bg-[#fdfcf0] pb-24 text-black">
      <Sidebar />
      <main className="w-full">
        <header className="sticky top-0 z-40 bg-[#fdfcf0]/80 backdrop-blur-md border-b border-black/5 p-4 md:p-6">
          <h1 className="text-2xl font-black tracking-tighter">通知中心</h1>
        </header>

        <div className="w-full max-w-4xl mx-auto divide-y divide-black/5">
          {loading ? (
            <div className="flex justify-center py-40">
              <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-60 space-y-6 text-zinc-200">
              <Bell size={64} strokeWidth={1} />
              <p className="text-[10px] font-black uppercase tracking-[0.5em]">宁静如水</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div key={n.id} className={`p-6 md:p-8 flex items-center space-x-6 transition-all hover:bg-black/[0.01] ${n.read_status ? 'opacity-50' : ''}`}>
                <div className="p-3 bg-white rounded-2xl shadow-sm border border-black/[0.03]">
                  {getIcon(n.type)}
                </div>
                <div className="flex-1">
                   <p className="text-base md:text-lg">
                      <span className="font-black">@{n.actor_profile?.username}</span>
                      <span className="text-zinc-500 ml-3 font-medium">
                        {n.type === 'like' && '点赞了你的贴文'}
                        {n.type === 'comment' && '回复了你的动态'}
                        {n.type === 'follow' && '关注了你'}
                        {n.type === 'repost' && '转发了你的内容'}
                      </span>
                   </p>
                   <p className="text-[10px] text-zinc-400 mt-2 font-bold uppercase tracking-widest">
                      {new Date(n.created_at).toLocaleString()}
                   </p>
                </div>
                <div className="w-2 h-2 rounded-full bg-black scale-0 group-hover:scale-100 transition-all"></div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default NotificationsPage;