import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, isConfigured } from '../services/supabaseClient';
// @ts-ignore
import { useNavigate, Link } from 'react-router-dom';
import { Send, User, MessageSquareOff, ArrowLeft, Users, PlusCircle, Check, Square, X as CloseIcon, BarChart3, Loader2, Info, ChevronRight, Crown, Image as ImageIcon, Clock, ToggleLeft, ToggleRight, Search, X } from 'lucide-react';
import { Message, Profile, Poll, PollOption } from '../types';

interface Group {
  id: string;
  name: string;
}

const MGMT_GROUP_ID = 'management-group-001';

const MessagesPage: React.FC = () => {
  const { user, profile, isDemo, refreshUnreadCounts } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Profile[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [groupMembers, setGroupMembers] = useState<Profile[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatImages, setChatImages] = useState<File[]>([]);
  const [chatPreviews, setChatPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  
  // Create Group State
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  // Poll State
  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollIsMultiple, setPollIsMultiple] = useState(false);
  const [pollDuration, setPollDuration] = useState('24'); // hours
  const [isCreatingPoll, setIsCreatingPoll] = useState(false);

  const [showMembersModal, setShowMembersModal] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!user || isDemo || !isConfigured) return;
    const handleAutoJoinMgmt = async () => {
      if (profile?.role === 'admin' || profile?.role === 'i女er') {
        const { data: mgmtGroup } = await supabase.from('groups').select('*').eq('id', MGMT_GROUP_ID).single();
        if (mgmtGroup) {
          await supabase.from('group_members').upsert({ group_id: MGMT_GROUP_ID, user_id: user.id });
        }
      }
    };
    handleAutoJoinMgmt();
  }, [profile, user, isDemo]);

  const fetchConversations = async () => {
    if (isDemo || !isConfigured) {
      setConversations([
        { id: 'demo-1', username: '系统消息', avatar_url: null, bio: '', is_first_login: false, created_at: '', role: 'user', is_banned: false },
        { id: 'demo-2', username: '林黛玉', avatar_url: null, bio: '绛珠草下凡', is_first_login: false, created_at: '', role: 'user', is_banned: false }
      ]);
      setGroups([{ id: 'demo-g1', name: '偏爱预览群' }]);
      setLoading(false);
      return;
    }
    const { data: friends } = await supabase.rpc('get_mutual_follows', { uid: user?.id });
    if (friends) setConversations(friends as Profile[]);
    
    const { data: memberGroups } = await supabase.from('group_members').select('group:groups(*)').eq('user_id', user?.id);
    if (memberGroups) setGroups(memberGroups.map(m => m.group) as unknown as Group[]);
    
    setLoading(false);
  };

  useEffect(() => {
    fetchConversations();
  }, [user, isDemo]);

  const fetchGroupMembers = async (groupId: string) => {
    if (isDemo) {
        setGroupMembers([
            { id: 'demo-1', username: '管理员', avatar_url: null, bio: '', is_first_login: false, created_at: '', role: 'admin', is_banned: false },
            { id: 'demo-2', username: '演示用户', avatar_url: null, bio: '', is_first_login: false, created_at: '', role: 'user', is_banned: false }
        ]);
        return;
    }
    const { data } = await supabase.from('group_members').select('profiles(*)').eq('group_id', groupId);
    if (data) setGroupMembers(data.map(d => d.profiles) as unknown as Profile[]);
  };

  const fetchMessages = async () => {
    if (isDemo) {
        setMessages([{ id: 'm1', sender_id: 'system', receiver_id: user?.id || 'demo', content: '欢迎使用私信预览', images: [], created_at: new Date().toISOString(), is_read: true }]);
        return;
    }
    let query = supabase.from('messages').select('*, poll:polls(*, options:poll_options(*))').order('created_at', { ascending: true });
    if (selectedGroup) {
      query = query.eq('group_id', selectedGroup.id);
    } else {
      query = query.or(`and(sender_id.eq.${user?.id},receiver_id.eq.${selectedUser?.id}),and(sender_id.eq.${selectedUser?.id},receiver_id.eq.${user?.id})`);
    }
    const { data } = await query;
    if (data) setMessages(data as Message[]);
  };

  useEffect(() => {
    if (selectedUser || selectedGroup) {
      fetchMessages();
      if (selectedGroup) fetchGroupMembers(selectedGroup.id);
      
      if (!isDemo) {
        const channel = supabase.channel('messages_realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchMessages()).on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes' }, () => fetchMessages()).subscribe();
        return () => { supabase.removeChannel(channel); };
      }
    }
  }, [selectedUser, selectedGroup, user, isDemo]);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || selectedMemberIds.size === 0) return;
    setIsCreatingGroup(true);
    try {
      if (isDemo) {
        setGroups([...groups, { id: Date.now().toString(), name: newGroupName }]);
        setShowCreateGroupModal(false);
        return;
      }

      const { data: group, error: groupError } = await supabase.from('groups').insert({ name: newGroupName }).select().single();
      if (groupError) throw groupError;

      // Add members including current user
      const membersToInsert = [user?.id, ...Array.from(selectedMemberIds)].map(mid => ({
        group_id: group.id,
        user_id: mid
      }));

      await supabase.from('group_members').insert(membersToInsert);
      
      setNewGroupName('');
      setSelectedMemberIds(new Set());
      setShowCreateGroupModal(false);
      fetchConversations();
    } catch (err) {
      console.error(err);
      alert('创建失败');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const toggleMemberSelection = (id: string) => {
    setSelectedMemberIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files) as File[];
      setChatImages(prev => [...prev, ...files]);
      setChatPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() && chatImages.length === 0) return;
    setSending(true);
    const content = newMessage.trim();
    const currentImages = [...chatImages];
    
    setNewMessage('');
    setChatImages([]);
    setChatPreviews([]);

    if (isDemo) {
      setSending(false);
      return;
    }

    try {
      const uploadedUrls: string[] = [];
      for (const file of currentImages) {
        const fileName = `${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage.from('message-attachments').upload(`${user?.id}/${fileName}`, file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('message-attachments').getPublicUrl(`${user?.id}/${fileName}`);
        uploadedUrls.push(publicUrl);
      }

      const payload: any = { 
        sender_id: user?.id, 
        content, 
        images: uploadedUrls 
      };
      if (selectedGroup) payload.group_id = selectedGroup.id;
      else payload.receiver_id = selectedUser?.id;
      
      await supabase.from('messages').insert(payload);
    } finally {
      setSending(false);
    }
  };

  const handleCreatePoll = async () => {
    if (!pollQuestion.trim() || pollOptions.some(o => !o.trim()) || !selectedGroup) return;
    setIsCreatingPoll(true);
    try {
      if (isDemo) {
          setShowPollModal(false);
          return;
      }
      
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + parseInt(pollDuration));

      const { data: poll } = await supabase.from('polls').insert({ 
        question: pollQuestion, 
        created_by: user?.id,
        is_multiple_choice: pollIsMultiple,
        expires_at: expiresAt.toISOString()
      }).select().single();
      
      if (!poll) throw new Error();
      
      const optionsPayload = pollOptions.map(opt => ({ poll_id: poll.id, option_text: opt }));
      await supabase.from('poll_options').insert(optionsPayload);

      await supabase.from('messages').insert({
        sender_id: user?.id,
        group_id: selectedGroup.id,
        content: `📊 投票：${pollQuestion}`,
        poll_id: poll.id
      });

      setShowPollModal(false);
      setPollQuestion('');
      setPollOptions(['', '']);
      setPollIsMultiple(false);
    } finally {
      setIsCreatingPoll(false);
    }
  };

  const handleVote = async (poll: Poll, optionId: string) => {
    if (isDemo || !user) return;
    
    // Check expiration
    if (poll.expires_at && new Date() > new Date(poll.expires_at)) {
      alert("该投票已截止");
      return;
    }

    // If not multiple choice, check if user already voted for ANY option in this poll
    if (!poll.is_multiple_choice) {
       const { data: existing } = await supabase.from('poll_votes').select('*').eq('poll_id', poll.id).eq('user_id', user.id);
       if (existing && existing.length > 0) {
         alert("单选投票不可重复投票");
         return;
       }
    } else {
      // Multiple choice: Check if user already voted for THIS specific option
      const { data: existingOption } = await supabase.from('poll_votes').select('*').eq('option_id', optionId).eq('user_id', user.id).single();
      if (existingOption) return;
    }

    await supabase.from('poll_votes').insert({ poll_id: poll.id, option_id: optionId, user_id: user.id });
    await supabase.rpc('increment_option_vote', { opt_id: optionId });
    fetchMessages();
  };

  const filteredGroups = groups.filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredConversations = conversations.filter(c => c.username.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="flex min-h-screen max-w-7xl mx-auto md:px-4 lg:px-8 bg-[#fdfcf0] text-black">
      <main className="flex-1 flex border-x border-black/5 overflow-hidden h-screen md:h-auto">
        {/* Contacts Sidebar */}
        <div className={`w-full md:w-1/3 border-r border-black/5 flex flex-col no-scrollbar overflow-y-auto ${selectedUser || selectedGroup ? 'hidden md:flex' : 'flex'}`}>
          <header className="p-6 border-b border-black/5 sticky top-0 bg-[#fdfcf0] z-20 flex items-center justify-between">
             <div className="flex items-center space-x-2">
                <Link to="/" className="p-2 hover:bg-black/5 rounded-full transition-colors mr-1">
                  <ArrowLeft size={20} />
                </Link>
                <h1 className="text-xl font-black tracking-tighter">私信</h1>
                
                {/* Simplified Search Icon Toggle (Swapped position to be next to title) */}
                <button 
                  onClick={() => {
                    setIsSearchOpen(!isSearchOpen);
                    if (isSearchOpen) setSearchTerm('');
                  }}
                  className={`p-2 rounded-full transition-all ${isSearchOpen ? 'bg-black text-[#fdfcf0]' : 'text-zinc-400 hover:text-black hover:bg-black/5'}`}
                >
                  {isSearchOpen ? <X size={16} /> : <Search size={20} />}
                </button>
             </div>
             
             {/* Swapped Position: PlusCircle is now on the right side */}
             <div className="flex items-center space-x-2">
                {isSearchOpen && (
                  <div className="animate-in slide-in-from-right-2 fade-in duration-200">
                    <input 
                      autoFocus
                      type="text"
                      placeholder="搜索..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-[80px] sm:w-[120px] bg-[#f7f5e6] border border-black/5 p-2 px-3 rounded-full focus:outline-none focus:border-black/20 text-xs font-medium"
                    />
                  </div>
                )}
                <button onClick={() => setShowCreateGroupModal(true)} className="p-2.5 text-zinc-400 hover:text-black hover:bg-black/5 rounded-full transition-colors">
                  <PlusCircle size={22} />
                </button>
             </div>
          </header>

          <div className="flex-1 divide-y divide-black/5">
            {filteredGroups.length > 0 && <div className="p-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">群组</div>}
            {filteredGroups.map(g => (
              <button key={g.id} onClick={() => { setSelectedGroup(g); setSelectedUser(null); }} className={`w-full p-6 flex items-center space-x-4 transition-all ${selectedGroup?.id === g.id ? 'bg-black text-white' : 'hover:bg-black/5'}`}>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${selectedGroup?.id === g.id ? 'bg-white/10' : 'bg-black/5 text-zinc-400'}`}><Users size={22} /></div>
                <div className="flex-1 text-left">
                  <p className="font-black text-sm">{g.name}</p>
                  {g.id === MGMT_GROUP_ID && <span className="text-[9px] uppercase font-black text-purple-500 bg-purple-50 px-2 py-0.5 rounded-full">管理内审</span>}
                </div>
              </button>
            ))}

            {filteredConversations.length > 0 && <div className="p-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">最近私信</div>}
            {filteredConversations.map((p) => (
              <button key={p.id} onClick={() => { setSelectedUser(p); setSelectedGroup(null); }} className={`w-full flex items-center space-x-4 p-6 transition-all ${selectedUser?.id === p.id ? 'bg-black text-white' : 'hover:bg-black/5'}`}>
                <div className="w-12 h-12 rounded-full border border-black/5 bg-[#f0eee0] overflow-hidden">
                  {p.avatar_url ? <img src={p.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-black text-lg">{p.username.charAt(0)}</div>}
                </div>
                <span className="font-black text-sm">{p.username}</span>
              </button>
            ))}

            {(searchTerm && filteredGroups.length === 0 && filteredConversations.length === 0) && (
              <div className="p-20 text-center space-y-4">
                <Search size={40} className="mx-auto text-zinc-200" strokeWidth={1} />
                <p className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">找不到匹配的偏爱</p>
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className={`flex-1 flex flex-col bg-[#fdfcf0] ${(!selectedUser && !selectedGroup) ? 'hidden md:flex' : 'flex'}`}>
          {(selectedUser || selectedGroup) ? (
            <>
              <header className="p-5 border-b border-black/5 bg-[#fdfcf0]/80 backdrop-blur-md flex items-center justify-between flex-shrink-0 z-10">
                <div className="flex items-center space-x-4">
                  <button onClick={() => { setSelectedUser(null); setSelectedGroup(null); }} className="p-2 hover:bg-black/5 rounded-full"><ArrowLeft size={20} /></button>
                  <div className="flex flex-col">
                    <p className="font-black text-lg tracking-tight leading-tight">{selectedUser?.username || selectedGroup?.name}</p>
                    {selectedGroup && (
                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
                        {groupMembers.length} 位成员
                      </span>
                    )}
                  </div>
                </div>
                {selectedGroup && (
                  <button onClick={() => setShowMembersModal(true)} className="p-3 text-zinc-400 hover:text-black hover:bg-black/5 rounded-full transition-all">
                    <Info size={22} />
                  </button>
                )}
              </header>
              
              <div className="flex-1 p-6 space-y-6 overflow-y-auto no-scrollbar">
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[85%] space-y-2">
                      <div className={`p-4 text-[15px] rounded-3xl ${m.sender_id === user?.id ? 'bg-black text-[#fdfcf0] rounded-br-sm' : 'bg-black/5 text-black rounded-bl-sm'} font-medium`}>
                        {m.content}
                        
                        {/* Images in Chat */}
                        {m.images && m.images.length > 0 && (
                          <div className={`grid gap-2 mt-3 ${m.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                            {m.images.map((img, idx) => (
                              <img 
                                key={idx} 
                                src={img} 
                                className="rounded-2xl w-full h-auto object-cover border border-black/5 cursor-pointer hover:opacity-90 transition-opacity" 
                                onClick={() => window.open(img, '_blank')}
                              />
                            ))}
                          </div>
                        )}

                        {m.poll && (
                          <div className={`mt-4 p-4 rounded-2xl border space-y-3 ${m.sender_id === user?.id ? 'bg-white/10 border-white/10' : 'bg-black/5 border-black/5'}`}>
                            <div className="flex items-center justify-between mb-2">
                              <p className={`font-black text-sm ${m.sender_id === user?.id ? 'text-white' : 'text-black'}`}>{m.poll.question}</p>
                              {m.poll.expires_at && new Date() > new Date(m.poll.expires_at) && (
                                <span className="bg-red-500 text-white text-[8px] px-2 py-0.5 rounded-full font-black uppercase">已截止</span>
                              )}
                            </div>
                            
                            <div className="flex items-center space-x-2 text-[8px] font-black uppercase tracking-widest opacity-60">
                              {m.poll.is_multiple_choice ? <span>多选模式</span> : <span>单选模式</span>}
                              {m.poll.expires_at && (
                                <div className="flex items-center space-x-1">
                                  <Clock size={8} />
                                  <span>截止：{new Date(m.poll.expires_at).toLocaleString()}</span>
                                </div>
                              )}
                            </div>

                            {m.poll.options.map((opt: PollOption) => {
                              const totalVotes = m.poll?.options.reduce((acc, curr) => acc + curr.votes_count, 0) || 0;
                              const percent = totalVotes === 0 ? 0 : Math.round((opt.votes_count / totalVotes) * 100);
                              const isExpired = m.poll?.expires_at && new Date() > new Date(m.poll!.expires_at);
                              
                              return (
                                <button 
                                  key={opt.id} 
                                  disabled={isExpired}
                                  onClick={() => handleVote(m.poll!, opt.id)}
                                  className={`w-full text-left relative overflow-hidden rounded-xl p-3 border transition-all active:scale-95 ${m.sender_id === user?.id ? 'border-white/10 hover:border-white/20' : 'border-black/5 hover:border-black/10'} ${isExpired ? 'opacity-60 cursor-not-allowed' : ''}`}
                                >
                                  <div className={`absolute left-0 top-0 bottom-0 transition-all duration-1000 ${m.sender_id === user?.id ? 'bg-white/10' : 'bg-black/10'}`} style={{ width: `${percent}%` }}></div>
                                  <div className="relative flex justify-between items-center text-[12px] font-bold">
                                    <div className="flex items-center space-x-2">
                                      {m.poll?.is_multiple_choice ? <Square size={12} strokeWidth={3} /> : <div className="w-2 h-2 rounded-full border-2 border-current" />}
                                      <span>{opt.option_text}</span>
                                    </div>
                                    <span className="text-[10px] opacity-60">{percent}%</span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <p className="text-[9px] text-zinc-300 font-bold uppercase tracking-widest">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Footer with Image Previews */}
              <footer className="p-6 border-t border-black/5 bg-[#fdfcf0] space-y-4">
                {chatPreviews.length > 0 && (
                  <div className="flex space-x-3 overflow-x-auto pb-2 no-scrollbar">
                    {chatPreviews.map((p, i) => (
                      <div key={i} className="relative w-20 h-20 rounded-2xl overflow-hidden shadow-sm flex-shrink-0 group">
                        <img src={p} className="w-full h-full object-cover" />
                        <button 
                          onClick={() => {
                            setChatPreviews(prev => prev.filter((_, idx) => idx !== i));
                            setChatImages(prev => prev.filter((_, idx) => idx !== i));
                          }}
                          className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <CloseIcon size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center space-x-3 bg-[#f7f5e6] p-2 rounded-[2rem] border border-black/5 focus-within:ring-2 ring-black/5 transition-all">
                  <div className="flex items-center">
                    <button onClick={() => fileInputRef.current?.click()} className="p-3 text-zinc-400 hover:text-black transition-colors">
                      <ImageIcon size={20} />
                    </button>
                    <input type="file" multiple accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageChange} />
                    
                    {selectedGroup && (
                      <button onClick={() => setShowPollModal(true)} className="p-3 text-zinc-400 hover:text-black transition-colors">
                        <BarChart3 size={20} />
                      </button>
                    )}
                  </div>

                  <input 
                    type="text" 
                    placeholder="发消息..." 
                    value={newMessage} 
                    onChange={(e) => setNewMessage(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()} 
                    className="flex-1 bg-transparent border-none px-2 py-2 focus:outline-none text-sm font-medium" 
                  />
                  <button 
                    onClick={sendMessage} 
                    disabled={sending}
                    className="p-4 bg-black text-[#fdfcf0] rounded-full hover:opacity-80 transition-opacity disabled:opacity-30"
                  >
                    {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  </button>
                </div>
              </footer>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-200 space-y-6">
              <MessageSquareOff size={80} strokeWidth={1} />
              <p className="text-[11px] font-black uppercase tracking-[0.5em]">极简私信，保持专注</p>
            </div>
          )}
        </div>
      </main>

      {/* Create Group Modal */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-[#fdfcf0] w-full max-w-md rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-[85vh] animate-in zoom-in duration-300">
            <header className="p-8 border-b border-black/5 flex items-center justify-between">
              <h2 className="text-xl font-black tracking-tight">创建群聊</h2>
              <button onClick={() => setShowCreateGroupModal(false)} className="p-2 hover:bg-black/5 rounded-full transition-colors"><CloseIcon size={20} /></button>
            </header>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">群聊名称</label>
                <input 
                  value={newGroupName} 
                  onChange={(e) => setNewGroupName(e.target.value)} 
                  className="w-full bg-[#f7f5e6] p-5 rounded-2xl border border-black/5 focus:outline-none font-bold"
                  placeholder="给群聊起个名字..."
                />
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">选择成员 ({selectedMemberIds.size})</label>
                <div className="space-y-2">
                  {conversations.length === 0 ? (
                    <p className="text-center py-6 text-zinc-300 text-[10px] font-black uppercase">暂无互关好友</p>
                  ) : (
                    conversations.map(friend => (
                      <button 
                        key={friend.id}
                        onClick={() => toggleMemberSelection(friend.id)}
                        className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${selectedMemberIds.has(friend.id) ? 'bg-black text-white border-black' : 'bg-black/5 border-transparent hover:border-black/10'}`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full bg-[#f0eee0] border border-black/5 overflow-hidden">
                            {friend.avatar_url ? <img src={friend.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-black">{friend.username.charAt(0)}</div>}
                          </div>
                          <span className="font-bold text-sm">{friend.username}</span>
                        </div>
                        {selectedMemberIds.has(friend.id) && <Check size={18} />}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            <footer className="p-8 bg-[#f7f5e6] border-t border-black/5">
              <button 
                onClick={handleCreateGroup}
                disabled={isCreatingGroup || !newGroupName.trim() || selectedMemberIds.size === 0}
                className="w-full py-5 bg-black text-[#fdfcf0] rounded-[2rem] font-black uppercase tracking-widest text-xs hover:opacity-80 disabled:opacity-20 transition-all flex items-center justify-center space-x-3 shadow-xl shadow-black/10"
              >
                {isCreatingGroup ? <Loader2 size={16} className="animate-spin" /> : <span>开启群聊</span>}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Group Members Modal */}
      {showMembersModal && (
        <div className="fixed inset-0 z-[150] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm p-0 md:p-4">
          <div className="bg-[#fdfcf0] w-full max-w-md h-[70vh] md:h-auto md:max-h-[80vh] rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
            <header className="p-6 border-b border-black/5 flex items-center justify-between flex-shrink-0">
               <h2 className="text-xl font-black tracking-tight">群组成员 ({groupMembers.length})</h2>
               <button onClick={() => setShowMembersModal(false)} className="p-2 hover:bg-black/5 rounded-full"><CloseIcon size={20} /></button>
            </header>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
              {groupMembers.map(m => (
                <Link 
                  key={m.id} 
                  to={`/profile/${m.username}`}
                  onClick={() => setShowMembersModal(false)}
                  className="flex items-center justify-between p-4 hover:bg-black/[0.03] rounded-2xl transition-all group"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-full border border-black/5 bg-[#f0eee0] overflow-hidden">
                       {m.avatar_url ? <img src={m.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-zinc-300 font-black">{m.username.charAt(0)}</div>}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-black text-sm">{m.username}</span>
                        {(m.role === 'admin' || m.role === 'i女er') && <Crown size={12} className="text-purple-500" />}
                      </div>
                      <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">{m.role}</span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-zinc-300 group-hover:text-black transition-colors" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Poll Creation Modal */}
      {showPollModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-[#fdfcf0] w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 space-y-6 overflow-y-auto max-h-[90vh] no-scrollbar animate-in zoom-in duration-300">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black tracking-tight">发起投票</h2>
              <button onClick={() => setShowPollModal(false)} className="p-2 hover:bg-black/5 rounded-full"><CloseIcon size={20} /></button>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">提问内容</label>
                <input value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} className="w-full bg-[#f7f5e6] p-5 rounded-2xl border border-black/5 focus:outline-none font-bold" placeholder="你想问什么？" />
              </div>
              
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">选项</label>
                {pollOptions.map((opt, i) => (
                  <input key={i} value={opt} onChange={(e) => { const next = [...pollOptions]; next[i] = e.target.value; setPollOptions(next); }} className="w-full bg-[#f7f5e6] p-4 rounded-xl border border-black/5 focus:outline-none text-sm font-medium" placeholder={`选项 ${i+1}`} />
                ))}
                {pollOptions.length < 6 && <button onClick={() => setPollOptions([...pollOptions, ''])} className="text-[10px] font-black uppercase text-zinc-400 hover:text-black mt-2 ml-2 transition-colors">+ 添加选项</button>}
              </div>

              <div className="p-6 bg-[#f7f5e6] rounded-3xl border border-black/5 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-black">多选模式</p>
                    <p className="text-[10px] text-zinc-400 font-bold">允许参与者选择多个选项</p>
                  </div>
                  <button onClick={() => setPollIsMultiple(!pollIsMultiple)} className="text-black transition-transform active:scale-90">
                    {pollIsMultiple ? <ToggleRight size={32} /> : <ToggleLeft size={32} className="text-zinc-300" />}
                  </button>
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">有效时长</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { l: '1小时', v: '1' },
                      { l: '24小时', v: '24' },
                      { l: '1周', v: '168' },
                    ].map(d => (
                      <button 
                        key={d.v}
                        onClick={() => setPollDuration(d.v)}
                        className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${pollDuration === d.v ? 'bg-black text-white' : 'bg-black/5 text-zinc-400'}`}
                      >
                        {d.l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <button onClick={handleCreatePoll} disabled={isCreatingPoll || !pollQuestion.trim() || pollOptions.some(o => !o.trim())} className="w-full py-5 bg-black text-[#fdfcf0] rounded-[2rem] font-black uppercase tracking-widest text-xs hover:opacity-80 disabled:opacity-20 transition-all flex items-center justify-center space-x-3">
              {isCreatingPoll ? <Loader2 size={16} className="animate-spin" /> : <span>立即发起投票</span>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessagesPage;