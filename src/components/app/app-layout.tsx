import React, { useState, useEffect } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarInset,
  SidebarTrigger,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FaPlus,
  FaCog,
  FaTrash,
  FaRobot
} from "react-icons/fa";
import { useNavigate, useLocation } from "react-router";
import { getChats, createChat, deleteChat as deleteChatApi } from "@/lib/api";
import type { ChatWithLastMessage } from "@/lib/types";



interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const [chats, setChats] = useState<ChatWithLastMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChats();
  }, []);

  const loadChats = async () => {
    try {
      setLoading(true);
      const fetchedChats = await getChats();
      setChats(fetchedChats);
    } catch (error) {
      console.error('Failed to load chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '';

    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } else if (days === 1) {
      return "Yesterday";
    } else if (days < 7) {
      return `${days}d ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const handleNewChat = async () => {
    try {
      const newChat = await createChat({ title: "New Chat" });
      setChats(prev => [
        {
          ...newChat,
          api_config_name: null,
          last_message: null,
          last_message_time: null,
          unread_count: 0
        },
        ...prev
      ]);
      navigate(`/chat/${newChat.id}`);
    } catch (error) {
      console.error('Failed to create chat:', error);
    }
  };

  const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteChatApi(chatId);
      setChats(prev => prev.filter(chat => chat.id !== chatId));

      // Navigate away if we're currently viewing the deleted chat
      const currentChatId = location.pathname.split('/').pop();
      if (currentChatId === chatId) {
        navigate('/');
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
    }
  };

  const currentChatId = location.pathname.split('/').pop();

  return (
    <>
      <Sidebar
        style={{
          '--sidebar-width': '20rem',
          '--sidebar-width-icon': '3rem',
        } as React.CSSProperties}
      >
        <SidebarHeader className="p-6 bg-background">
          <div className="flex items-center gap-3 mb-6">
            <FaRobot className="text-primary" size={28} />
            <h1 className="font-bold text-xl">ChatMe</h1>
          </div>

          <Button
            onClick={handleNewChat}
            className="w-full gap-2 h-11"
          >
            <FaPlus size={16} />
            New Chat
          </Button>
        </SidebarHeader>

        <SidebarContent className="overflow-hidden bg-background">
          <SidebarGroup>
            <SidebarGroupLabel className="px-6 py-2 text-sm font-semibold">
              Chat History
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <div
                className="h-[calc(100vh-240px)] overflow-y-auto scrollbar-hide no-scrollbar px-2"
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  WebkitScrollbar: { display: 'none' }
                } as React.CSSProperties}
              >
                <SidebarMenu className="space-y-1">
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-sm text-muted-foreground">Loading chats...</div>
                    </div>
                  ) : chats.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">
                        No chats yet
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Create your first chat to get started
                      </p>
                    </div>
                  ) : (
                    chats.map((chat) => (
                      <SidebarMenuItem key={chat.id} className="group">
                        <SidebarMenuButton
                          onClick={() => navigate(`/chat/${chat.id}`)}
                          isActive={currentChatId === chat.id}
                          className="w-full p-3 h-auto flex-col items-start rounded-lg hover:bg-muted/80 transition-colors relative"
                        >
                          <div className="flex items-start justify-between w-full">
                            <div className="flex-1 min-w-0 pr-8">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm truncate">
                                  {chat.title}
                                </span>
                                {chat.unread_count > 0 && (
                                  <Badge className="h-5 min-w-5 text-xs flex items-center justify-center bg-primary">
                                    {chat.unread_count}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate mb-1">
                                {chat.last_message || "No messages yet"}
                              </p>
                              <span className="text-xs text-muted-foreground/80">
                                {formatTime(chat.last_message_time || chat.updated_at)}
                              </span>
                            </div>

                            {/* Delete Button - positioned absolutely */}
                            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                              <div
                                className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground rounded-md cursor-pointer flex items-center justify-center"
                                onClick={(e) => handleDeleteChat(chat.id, e)}
                              >
                                <FaTrash size={10} />
                              </div>
                            </div>
                          </div>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))
                  )}
                </SidebarMenu>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="p-2 border-t bg-background">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => navigate('/settings')}
                isActive={location.pathname === '/settings'}
                className="gap-3 p-3 rounded-lg cursor-pointer transition-colors"
              >
                <FaCog size={18} />
                <span className="font-medium">Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 flex h-16 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6 z-10">
          <SidebarTrigger className="h-9 w-9" />
          <div className="flex items-center gap-2 ml-2">
            <h2 className="font-semibold text-lg">
              {currentChatId ?
                chats.find(chat => chat.id === currentChatId)?.title || 'Chat' :
                'ChatMe'
              }
            </h2>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm">
              Share
            </Button>
            <Button variant="outline" size="sm">
              Export
            </Button>
          </div>
        </header>
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </SidebarInset>
    </>
  );
}
