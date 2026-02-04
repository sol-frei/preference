import React from 'react';
// @ts-ignore
import { NavLink } from 'react-router-dom';
import { Home, Bell, Mail, User, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Sidebar: React.FC = () => {
  const { profile, unreadNotificationsCount, unreadMessagesCount } = useAuth();

  const navItems = [
    { icon: <Home size={28} />, label: '主页', path: '/' },
    { 
      icon: <Bell size={28} />, 
      label: '通知', 
      path: '/notifications',
      hasBadge: unreadNotificationsCount > 0 
    },
    { 
      icon: <Mail size={28} />, 
      label: '私信', 
      path: '/messages',
      hasBadge: unreadMessagesCount > 0 
    },
    { icon: <User size={28} />, label: '个人', path: `/profile/${profile?.username || ''}` },
  ];

  // Add Admin link if user has privileges
  if (profile?.role === 'admin' || profile?.role === 'i女er') {
    navItems.splice(3, 0, { icon: <ShieldCheck size={28} />, label: '管理', path: '/admin' });
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-[72px] bg-[#fdfcf0]/90 backdrop-blur-2xl border-t border-black/5 z-50 flex items-center justify-around px-8 pb-safe shadow-sm">
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }: { isActive: boolean }) => 
            `flex items-center justify-center transition-all flex-1 h-full relative group ${
              isActive ? 'text-black scale-110' : 'text-zinc-400 hover:text-black'
            }`
          }
        >
          <div className="p-2 relative">
            {item.icon}
            {'hasBadge' in item && item.hasBadge && (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#fdfcf0]"></span>
            )}
          </div>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-[2px] bg-black rounded-full scale-x-0 group-[.active]:scale-x-100 transition-transform origin-center" />
        </NavLink>
      ))}
    </nav>
  );
};

export default Sidebar;