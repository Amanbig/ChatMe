import "./App.css";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { ThemeProvider } from "./components/theme-provider";
import SettingsPage from "./pages/settings";
import HomePage from "./pages/home";
import { SidebarProvider } from "./components/ui/sidebar";

const router = createBrowserRouter([
  {
    path: "/",
    element: <HomePage/>,
  },
  {
    path: "/settings",
    element: <SettingsPage/>,
  },
]);

function App() {

  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <SidebarProvider>
    <RouterProvider router={router} />
      </SidebarProvider>
    </ThemeProvider>
  );
}

export default App;
