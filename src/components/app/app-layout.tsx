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
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  FaPlus,
  FaCog,
  FaTrash,
  FaRobot,
  FaComments,
  FaClock,
  FaSearch
} from "react-icons/fa";
import { RxCross2 } from "react-icons/rx";
import { VscChromeMinimize } from "react-icons/vsc";
import { IoMdSquareOutline } from "react-icons/io";
import { useNavigate, useLocation } from "react-router";
import { getChats, createChat, deleteChat as deleteChatApi } from "@/lib/api";
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useIsMobile } from "@/hooks/use-mobile";
import { useAgent } from "@/contexts/AgentContext";
import ThemeToggle from "./theme-toggle";
import PermissionDialog from "./permission-dialog";
import type { ChatWithLastMessage } from "@/lib/types";

interface AppLayoutProps {
  children: React.ReactNode;
}

const appWindow = getCurrentWindow();

export default function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { isAgentActive, setAgentActive } = useAgent();

  const [chats, setChats] = useState<ChatWithLastMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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
      toast.error('Failed to load chats. Please refresh the page.');
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
      toast.success('New chat created!', { icon: <FaRobot size={14} /> });
    } catch (error) {
      console.error('Failed to create chat:', error);
      toast.error('Failed to create new chat. Please try again.');
    }
  };

  const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (deleteConfirm === chatId) {
      try {
        await deleteChatApi(chatId);
        setChats(prev => prev.filter(chat => chat.id !== chatId));
        setDeleteConfirm(null);

        const currentChatId = location.pathname.split('/').pop();
        if (currentChatId === chatId) {
          navigate('/');
        }
        toast.success('Chat deleted successfully');
      } catch (error) {
        console.error('Failed to delete chat:', error);
        toast.error('Failed to delete chat. Please try again.');
      }
    } else {
      setDeleteConfirm(chatId);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const filteredChats = chats.filter(chat =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (chat.last_message && chat.last_message.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const currentChatId = location.pathname.split('/').pop();
  const activeChat = chats.find(chat => chat.id === currentChatId);

  // Group chats by date
  const groupedChats = filteredChats.reduce((groups, chat) => {
    const date = new Date(chat.last_message_time || chat.updated_at);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    let group = 'Older';
    if (days === 0) group = 'Today';
    else if (days === 1) group = 'Yesterday';
    else if (days < 7) group = 'This Week';
    else if (days < 30) group = 'This Month';

    if (!groups[group]) groups[group] = [];
    groups[group].push(chat);
    return groups;
  }, {} as Record<string, typeof chats>);

  const groupOrder = ['Today', 'Yesterday', 'This Week', 'This Month', 'Older'];

  return (
    <TooltipProvider delayDuration={300}>
      <>
        <Sidebar
          className="border-r border-border/60"
          style={{
            '--sidebar-width': '22rem',
            '--sidebar-width-icon': '3.5rem',
          } as React.CSSProperties}
        >
          <SidebarHeader className="p-5 pb-4">
            {/* Logo */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
                <FaRobot className="text-primary-foreground" size={22} />
              </div>
              <div>
                <h1 className="font-bold text-lg leading-tight">ChatMe</h1>
                <p className="text-[11px] text-muted-foreground">AI Assistant</p>
              </div>
            </div>

            {/* New Chat Button */}
            <Button
              onClick={handleNewChat}
              className="w-full gap-2 h-10 mb-4 rounded-xl bg-primary hover:bg-primary/90 shadow-md shadow-primary/20 transition-all duration-200 hover:shadow-lg hover:shadow-primary/30"
            >
              <FaPlus size={16} />
              <span>New Chat</span>
            </Button>

            {/* Search */}
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" size={14} />
              <input
                type="text"
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-3 text-sm bg-muted/50 border border-border/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all placeholder:text-muted-foreground/50"
              />
            </div>
          </SidebarHeader>

          <SidebarContent className="px-3">
            <div className="h-[calc(100vh-280px)] overflow-y-auto scrollbar-thin pr-1">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                  <p className="text-sm text-muted-foreground">Loading chats...</p>
                </div>
              ) : filteredChats.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                    <FaComments size={20} className="text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {searchQuery ? "No chats found" : "No chats yet"}
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    {searchQuery ? "Try a different search term" : "Start a new conversation"}
                  </p>
                </div>
              ) : (
                <SidebarMenu className="space-y-4">
                  {groupOrder.map(group => {
                    const groupChats = groupedChats[group];
                    if (!groupChats || groupChats.length === 0) return null;

                    return (
                      <SidebarGroup key={group} className="p-0">
                        <SidebarGroupLabel className="px-2 py-1 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">
                          {group}
                        </SidebarGroupLabel>
                        <SidebarGroupContent className="space-y-0.5">
                          {groupChats.map((chat) => (
                            <SidebarMenuItem key={chat.id} className="group">
                              <SidebarMenuButton
                                onClick={() => navigate(`/chat/${chat.id}`)}
                                isActive={currentChatId === chat.id}
                                className="w-full p-3 h-auto rounded-xl transition-all duration-200 relative overflow-hidden"
                              >
                                <div className="flex items-start justify-between w-full gap-3">
                                  <div className="flex-1 min-w-0">
                                    {/* Title row */}
                                    <div className="flex items-center gap-2 mb-1.5">
                                      <span className={`font-medium text-sm truncate ${currentChatId === chat.id ? 'text-primary' : 'text-foreground'
                                        }`}>
                                        {chat.title}
                                      </span>
                                      {chat.unread_count > 0 && (
                                        <Badge className="h-4 min-w-4 text-[10px] px-1 flex items-center justify-center bg-primary shrink-0">
                                          {chat.unread_count}
                                        </Badge>
                                      )}
                                    </div>

                                    {/* Last message */}
                                    <p className="text-xs text-muted-foreground truncate mb-1.5 leading-relaxed">
                                      {chat.last_message || "Start a conversation..."}
                                    </p>

                                    {/* Time */}
                                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
                                      <FaClock size={10} />
                                      <span>{formatTime(chat.last_message_time || chat.updated_at)}</span>
                                    </div>
                                  </div>

                                  {/* Delete Button */}
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div
                                        role="button"
                                        tabIndex={0}
                                        className={`shrink-0 h-7 w-7 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer ${deleteConfirm === chat.id
                                          ? 'bg-destructive text-destructive-foreground opacity-100'
                                          : 'opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive'
                                          }`}
                                        onClick={(e) => handleDeleteChat(chat.id, e)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            handleDeleteChat(chat.id, e as any);
                                          }
                                        }}
                                      >
                                        <FaTrash size={12} />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="left">
                                      <p className="text-xs">
                                        {deleteConfirm === chat.id ? "Click again to confirm" : "Delete chat"}
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          ))}
                        </SidebarGroupContent>
                      </SidebarGroup>
                    );
                  })}
                </SidebarMenu>
              )}
            </div>
          </SidebarContent>

          <SidebarFooter className="p-4 border-t border-border/60">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => navigate('/settings')}
                  isActive={location.pathname === '/settings'}
                  className="gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 hover:bg-muted/80"
                >
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                    <FaCog size={16} />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="font-medium text-sm">Settings</span>
                    <span className="text-[11px] text-muted-foreground">Configure app & AI</span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="flex flex-col h-screen bg-background">
          {/* Header */}
          <header className="sticky top-0 flex h-14 shrink-0 items-center gap-3 border-b border-border/60 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 px-4 z-10 drag">
            <div className="flex items-center gap-2 no-drag">
              <SidebarTrigger className="h-9 w-9 rounded-lg hover:bg-muted" />
            </div>

            {/* Chat title */}
            <div className="flex items-center gap-3 ml-2 flex-1 min-w-0">
              {activeChat ? (
                <>
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FaComments size={14} className="text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-semibold text-sm truncate">
                      {activeChat.title}
                    </h2>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {activeChat.last_message || "New conversation"}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shrink-0">
                    <FaRobot size={14} className="text-primary" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-sm">Welcome to ChatMe</h2>
                    <p className="text-[11px] text-muted-foreground">Start a new conversation</p>
                  </div>
                </>
              )}
            </div>

            {/* Agent Mode Toggle */}
            <div className="flex items-center gap-2 no-drag px-3 py-1.5 rounded-xl bg-muted/50 border border-border/40">
              <span className="text-xs font-medium">Agent Mode</span>
              {isAgentActive && (
                <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 gap-1 bg-primary">
                  <span className="w-1 h-1 bg-white rounded-full animate-pulse" />
                  ON
                </Badge>
              )}
              <Switch
                checked={isAgentActive}
                onCheckedChange={(checked) => {
                  setAgentActive(checked);
                  toast.info(checked ? "Agent mode enabled" : "Agent mode disabled");
                }}
                className="scale-75 data-[state=checked]:bg-primary"
              />
            </div>

            {/* Window controls */}
            {!isMobile && (
              <div className="flex items-center gap-0.5 ml-2 no-drag">
                <ThemeToggle />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 rounded-lg hover:bg-muted"
                  onClick={() => appWindow.minimize()}
                >
                  <VscChromeMinimize size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 rounded-lg hover:bg-muted"
                  onClick={async () => {
                    if (await appWindow.isMaximized()) {
                      await appWindow.unmaximize();
                    } else {
                      await appWindow.maximize();
                    }
                  }}
                >
                  <IoMdSquareOutline size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 rounded-lg hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => appWindow.close()}
                >
                  <RxCross2 size={14} />
                </Button>
              </div>
            )}

            {isMobile && (
              <div className="flex items-center ml-auto no-drag">
                <ThemeToggle />
              </div>
            )}
          </header>

          {/* Main content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {children}
          </div>
        </SidebarInset>

        {/* Global Permission Dialog */}
        <PermissionDialog />
      </>
    </TooltipProvider>
  );
}
