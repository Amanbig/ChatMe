export interface Chat {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  chat_id: string;
  content: string;
  role: 'user' | 'assistant';
  created_at: string;
}

export interface ChatWithLastMessage {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message: string | null;
  last_message_time: string | null;
  unread_count: number;
}

export interface CreateChatRequest {
  title: string;
}

export interface CreateMessageRequest {
  chat_id: string;
  content: string;
  role: 'user' | 'assistant';
}

export interface UpdateChatRequest {
  title: string;
}