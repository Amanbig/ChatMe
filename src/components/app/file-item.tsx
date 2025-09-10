import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { FaFile, FaFolder } from "react-icons/fa";
import { openPath } from "@/lib/agent-utils";

interface FileItemProps {
    name: string;
    path: string;
    isDirectory: boolean;
}

export default function FileItem({ name, path, isDirectory }: FileItemProps) {
    const handleOpen = async () => {
        try {
            const result = await openPath(path);
            toast.success(result);
        } catch (error) {
            toast.error(`Failed to open ${name}: ${error}`);
        }
    };

    return (
        <Button
            variant="ghost"
            className="flex items-center gap-2 h-auto p-2 justify-start"
            onClick={handleOpen}
        >
            {isDirectory ? (
                <FaFolder className="h-4 w-4 text-blue-500" />
            ) : (
                <FaFile className="h-4 w-4 text-gray-600" />
            )}
            <span className="text-sm">{name}</span>
        </Button>
    );
}
