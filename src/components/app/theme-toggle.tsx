import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { FaSun, FaMoon } from "react-icons/fa";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function ThemeToggle() {
    const { theme, setTheme } = useTheme();

    const toggleTheme = () => {
        if (theme === "light") {
            setTheme("dark");
        } else if (theme === "dark") {
            setTheme("light");
        } else {
            // System theme - check current system preference
            const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
                ? "light"
                : "dark";
            setTheme(systemTheme);
        }
    };

    const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

    return (
        <TooltipProvider delayDuration={200}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleTheme}
                        className="h-8 w-8 p-0 rounded-lg hover:bg-muted transition-all duration-200"
                    >
                        {isDark ? (
                            <FaSun size={14} className="text-amber-500 transition-transform duration-200 hover:rotate-12" />
                        ) : (
                            <FaMoon size={14} className="text-indigo-500 transition-transform duration-200 hover:-rotate-12" />
                        )}
                        <span className="sr-only">Toggle {isDark ? 'light' : 'dark'} mode</span>
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                    <p className="text-xs">Switch to {isDark ? 'light' : 'dark'} mode</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
