import { invoke } from '@tauri-apps/api/core';
import type { 
  Chat, 
  Message, 
  ChatWithLastMessage, 
  CreateChatRequest, 
  CreateMessageRequest, 
  UpdateChatRequest 
} from './types';

// Chat operations
export async function createChat(request: CreateChatRequest): Promise<Chat> {
  return await invoke('create_chat', { request });
}

export async function getChats(): Promise<ChatWithLastMessage[]> {
  return await invoke('get_chats');
}

export async function getChat(chatId: string): Promise<Chat | null> {
  return await invoke('get_chat', { chatId });
}

export async function updateChat(chatId: string, request: UpdateChatRequest): Promise<Chat> {
  return await invoke('update_chat', { chatId, request });
}

export async function deleteChat(chatId: string): Promise<void> {
  return await invoke('delete_chat', { chatId });
}

// Message operations
export async function createMessage(request: CreateMessageRequest): Promise<Message> {
  return await invoke('create_message', { request });
}

export async function getMessages(chatId: string): Promise<Message[]> {
  return await invoke('get_messages', { chatId });
}

export async function deleteMessage(messageId: string): Promise<void> {
  return await invoke('delete_message', { messageId });
}