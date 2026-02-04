
export interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  is_first_login: boolean;
  created_at: string;
  role: 'user' | 'admin' | 'i女er';
  is_banned: boolean;
}

export interface Post {
  id: string;
  user_id: string;
  content: string;
  images: string[];
  type: 'original' | 'repost';
  parent_id: string | null;
  created_at: string;
  profiles: Profile;
  likes_count?: number;
  comments_count?: number;
}

export interface PollOption {
  id: string;
  poll_id: string;
  option_text: string;
  votes_count: number;
}

export interface Poll {
  id: string;
  question: string;
  is_multiple_choice: boolean;
  expires_at: string | null;
  options: PollOption[];
  created_by: string;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string | null;
  group_id?: string | null;
  content: string;
  images: string[];
  is_read: boolean;
  created_at: string;
  poll_id?: string | null;
  poll?: Poll;
}

export interface Collection {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  actor_id: string;
  type: 'like' | 'comment' | 'follow' | 'repost';
  read_status: boolean;
  created_at: string;
  actor_profile?: {
    username: string;
    avatar_url: string | null;
  };
}
