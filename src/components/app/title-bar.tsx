import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { Badge } from "../ui/badge";
import { RxCross2 } from "react-icons/rx";
import { VscChromeMinimize } from "react-icons/vsc";
import { IoMdSquareOutline } from "react-icons/io";
import { FaRobot } from "react-icons/fa";
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useAgent } from "@/contexts/AgentContext";
import { toast } from "sonner";
import ThemeToggle from "./theme-toggle";

const appWindow = getCurrentWindow();

export default function TitleBar() {
    const { isAgentActive, setAgentActive } = useAgent();

    return (
        <div className="flex flex-row items-center justify-between pl-2 drag">
            <div className="flex items-center gap-4">
                <p>ChatMe</p>
                {/* Agent Mode Toggle */}
                <div className="flex items-center gap-2 no-drag">
                    <FaRobot className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs font-medium">Agent</span>
                    {isAgentActive && <Badge variant="default" className="text-xs px-1.5 py-0.5">ON</Badge>}
                    <Switch
                        checked={isAgentActive}
                        onCheckedChange={(checked) => {
                            setAgentActive(checked);
                            toast.info(checked ? "Agent mode enabled" : "Agent mode disabled");
                        }}
                        className="scale-75"
                    />
                </div>
            </div>
            <div className="no-drag">
                <ThemeToggle />
                <Button variant="ghost" onClick={() => appWindow.minimize()}><VscChromeMinimize /></Button>
                <Button variant="ghost" onClick={async () => {
                    if (await appWindow.isMaximized()) {
                        await appWindow.unmaximize();
                    } else {
                        await appWindow.maximize();
                    }
                }}><IoMdSquareOutline /></Button>
                <Button variant="ghost" onClick={() => appWindow.close()}><RxCross2 /></Button>
            </div>
        </div>
    );
}