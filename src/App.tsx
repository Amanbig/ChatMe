import "./App.css";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { ThemeProvider } from "./components/theme-provider";
import { SidebarProvider } from "./components/ui/sidebar";
import { AgentProvider } from "./contexts/AgentContext";
import AppLayout from "./components/app/app-layout";
import SettingsPage from "./pages/settings";
import HomePage from "./pages/home";
import { Toaster } from "./components/ui/sonner";
import PermissionDialog from "./components/app/permission-dialog";

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <AppLayout>
        <HomePage />
      </AppLayout>
    ),
  },
  {
    path: "/chat/:chatId",
    element: (
      <AppLayout>
        <HomePage />
      </AppLayout>
    ),
  },
  {
    path: "/settings",
    element: (
      <AppLayout>
        <SettingsPage />
      </AppLayout>
    ),
  },
]);

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <AgentProvider>
        <SidebarProvider>
          <Toaster />
          <PermissionDialog />
          <RouterProvider router={router} />
        </SidebarProvider>
      </AgentProvider>
    </ThemeProvider>
  );
}

export default App;
