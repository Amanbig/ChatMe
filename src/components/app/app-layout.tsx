import React, { useState } from "react";
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

interface Chat {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  unread?: number;
}

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [chats, setChats] = useState<Chat[]>([
    {
      id: "1",
      title: "Getting Started",
      lastMessage: "Hello! How can I help you today?",
      timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
      unread: 1
    },
    {
      id: "2", 
      title: "Code Review",
      lastMessage: "The function looks good, but you might want to...",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    },
    {
      id: "3",
      title: "Project Planning",
      lastMessage: "Let's break down the project into smaller tasks",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    },
    {
      id: "4",
      title: "API Integration",
      lastMessage: "Here's how you can integrate the OpenAI API...",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), // 3 days ago
    }
  ]);

  const formatTime = (date: Date) => {
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

  const handleNewChat = () => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: "New Chat",
      lastMessage: "Start a new conversation...",
      timestamp: new Date()
    };
    setChats(prev => [newChat, ...prev]);
    navigate(`/chat/${newChat.id}`);
  };

  const handleDeleteChat = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChats(prev => prev.filter(chat => chat.id !== chatId));
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
        <SidebarHeader className="p-6">
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

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="px-6 py-2 text-sm font-semibold">
              Chat History
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="h-[calc(100vh-240px)] scrollbar-hide-desktop">
                <div className="scroll-content">
                  <div className="px-2 no-scrollbar">
                    <SidebarMenu className="space-y-1">
                  {chats.map((chat) => (
                    <SidebarMenuItem key={chat.id} className="group">
                      <div className="flex items-center">
                        <SidebarMenuButton
                          onClick={() => navigate(`/chat/${chat.id}`)}
                          isActive={currentChatId === chat.id}
                          className="flex-1 p-3 h-auto flex-col items-start rounded-lg hover:bg-muted/80 transition-colors"
                        >
                          <div className="flex items-start justify-between w-full">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm truncate">
                                  {chat.title}
                                </span>
                                {chat.unread && (
                                  <Badge className="h-5 min-w-5 text-xs flex items-center justify-center bg-primary">
                                    {chat.unread}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate mb-1">
                                {chat.lastMessage}
                              </p>
                              <span className="text-xs text-muted-foreground/80">
                                {formatTime(chat.timestamp)}
                              </span>
                            </div>
                          </div>
                        </SidebarMenuButton>
                        
                        {/* Delete Button */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-destructive hover:text-destructive-foreground rounded-md"
                            onClick={(e) => handleDeleteChat(chat.id, e)}
                          >
                            <FaTrash size={12} />
                          </Button>
                        </div>
                      </div>
                    </SidebarMenuItem>
                  ))}
                  
                  {chats.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">
                        No chat history yet
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Start a new conversation to begin
                      </p>
                    </div>
                    )}
                    </SidebarMenu>
                  </div>
                </div>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="p-6 border-t">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => navigate('/settings')}
                isActive={location.pathname === '/settings'}
                className="gap-3 p-3 rounded-lg hover:bg-muted/80 transition-colors"
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
