import { useState } from "react";
import { Button } from "../ui/button";
import { Moon, Sun } from "lucide-react"
import { useTheme } from "../theme-provider";

export default function ThemeToggle(){
    const {setTheme} = useTheme();
    const [isDarkTheme, setIsDarkTheme] = useState(false);

    return(
        <Button variant="ghost" onClick={() => {
            setTheme(isDarkTheme ? "light" : "dark");
            setIsDarkTheme(!isDarkTheme);
        }}>
            {isDarkTheme ? <Sun/> : <Moon/>}
        </Button>
    );
}