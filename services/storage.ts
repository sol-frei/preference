import { supabase } from './supabaseClient';

export const get_all_users = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const updateUser = async (id: string, updates: any) => {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
};

export const toggle_ban_user = async (id: string, currentStatus: boolean) => {
  const { error } = await supabase
    .from('profiles')
    .update({ is_banned: !currentStatus })
    .eq('id', id);
  if (error) throw error;
};

export const get_banned_words = async () => {
  const { data, error } = await supabase
    .from('sensitive_words')
    .select('word');
  if (error) throw error;
  return data.map((d: any) => d.word);
};