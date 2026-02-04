import React, { useState, useEffect } from 'react';
import { supabase, isConfigured } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { FolderPlus, Trash2, Edit3, X, Check, Folder } from 'lucide-react';
import { Collection } from '../types';

const CollectionManager: React.FC = () => {
  const { user } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchCollections = async () => {
    if (!isConfigured || !user) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('collections')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });
    if (!error) setCollections(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchCollections(); }, [user]);

  const handleCreate = async () => {
    if (!newCollectionName.trim()) return;
    const { error } = await supabase.from('collections').insert({ name: newCollectionName, user_id: user?.id });
    if (!error) { setNewCollectionName(''); fetchCollections(); }
  };

  const handleRename = async (id: string) => {
    if (!editName.trim()) return;
    const { error } = await supabase.from('collections').update({ name: editName }).eq('id', id);
    if (!error) { setEditingId(null); fetchCollections(); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('确定删除此收藏夹吗？')) return;
    const { error } = await supabase.from('collections').delete().eq('id', id);
    if (!error) fetchCollections();
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center space-x-4 bg-[#f7f5e6] p-4 rounded-2xl border border-black/5 shadow-sm group transition-all focus-within:ring-2 ring-black/5">
        <input
          type="text"
          placeholder="给新集锦起个名字..."
          value={newCollectionName}
          onChange={(e) => setNewCollectionName(e.target.value)}
          className="flex-1 bg-transparent border-none focus:outline-none text-sm px-2 font-medium placeholder:text-zinc-400"
        />
        <button
          onClick={handleCreate}
          disabled={!newCollectionName.trim()}
          className="bg-black text-[#fdfcf0] p-3 rounded-xl hover:opacity-80 disabled:opacity-20 transition-all flex items-center space-x-2 shadow-lg shadow-black/5"
        >
          <FolderPlus size={18} />
          <span className="text-xs font-black uppercase tracking-widest hidden sm:inline">创建</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-black/5 animate-pulse rounded-2xl"></div>
          ))
        ) : collections.length === 0 ? (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-zinc-300 space-y-4">
            <Folder size={48} strokeWidth={1} />
            <p className="text-[10px] font-black uppercase tracking-[0.4em]">暂无集锦</p>
          </div>
        ) : (
          collections.map((col) => (
            <div
              key={col.id}
              className="group flex flex-col justify-between bg-[#f7f5e6] border border-black/5 hover:border-black/20 p-6 rounded-3xl transition-all hover:shadow-xl hover:shadow-black/5 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-black/[0.02] rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>

              <div className="flex-1 z-10">
                {editingId === col.id ? (
                  <div className="flex items-center space-x-2">
                    <input
                      autoFocus
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 bg-black/5 border-none rounded-xl px-4 py-2 text-sm font-bold focus:outline-none"
                    />
                    <button onClick={() => handleRename(col.id)} className="p-2 text-green-600 bg-green-50 rounded-full">
                      <Check size={16} />
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-2 text-zinc-400 bg-black/5 rounded-full">
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col space-y-1">
                    <h3 className="text-lg font-black text-black tracking-tight">{col.name}</h3>
                  </div>
                )}
              </div>
              
              <div className="flex items-center justify-end space-x-2 mt-4 pt-4 border-t border-black/[0.03] opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button
                  onClick={() => { setEditingId(col.id); setEditName(col.name); }}
                  className="p-2 text-zinc-400 hover:text-black hover:bg-black/5 rounded-full transition-all"
                >
                  <Edit3 size={16} />
                </button>
                <button
                  onClick={() => handleDelete(col.id)}
                  className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CollectionManager;