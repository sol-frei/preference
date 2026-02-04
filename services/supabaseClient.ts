
import { createClient } from '@supabase/supabase-js';

const getEnv = (key: string): string => {
  const env = (import.meta as any).env || {};
  return (env[key] || '').trim();
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

// 校验是否为有效的 Supabase URL (排除默认模板值)
export const isConfigured = 
  !!supabaseUrl && 
  supabaseUrl.startsWith('https://') && 
  !supabaseUrl.includes('placeholder') &&
  !supabaseUrl.includes('你的项目ID');

// 创建客户端，如果未配置则使用占位符，防止初始化崩溃
export const supabase = createClient(
  isConfigured ? supabaseUrl : 'https://demo-mode.supabase.co',
  isConfigured ? supabaseAnonKey : 'demo-key'
);
