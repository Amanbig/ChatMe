import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FaFile, FaFolder, FaExternalLinkAlt } from "react-icons/fa";
import { toast } from "sonner";
import { openPath } from "@/lib/agent-utils";

interface FileListDisplayProps {
    directories?: Array<{ name: string; }>;
    files?: Array<{ name: string; }>;
    basePath: string;
}

export default function FileListDisplay({ directories = [], files = [], basePath }: FileListDisplayProps) {
    const handleOpenItem = async (itemName: string) => {
        try {
            const fullPath = `${basePath}${basePath.endsWith('/') || basePath.endsWith('\\') ? '' : '\\'}${itemName}`;
            await openPath(fullPath);
            toast.success(`Opened ${itemName} successfully`);
        } catch (error) {
            toast.error(`Failed to open ${itemName}: ${error}`);
        }
    };

    if (directories.length === 0 && files.length === 0) {
        return (
            <Card className="my-4">
                <CardContent className="pt-6">
                    <p className="text-muted-foreground text-center">No files or folders found</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="my-4">
            <CardContent className="pt-6">
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <FaFolder className="h-4 w-4" />
                        <span>Files and folders in {basePath}</span>
                    </div>
                    
                    {/* Directories */}
                    {directories.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-sm font-semibold flex items-center gap-2">
                                <FaFolder className="h-4 w-4 text-blue-500" />
                                Directories ({directories.length})
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {directories.map((dir, index) => (
                                    <Button
                                        key={`dir-${index}`}
                                        variant="outline"
                                        size="sm"
                                        className="justify-between h-auto p-3 text-left"
                                        onClick={() => handleOpenItem(dir.name)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <FaFolder className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                            <span className="truncate">{dir.name}/</span>
                                        </div>
                                        <FaExternalLinkAlt className="h-3 w-3 text-muted-foreground" />
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {/* Files */}
                    {files.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-sm font-semibold flex items-center gap-2">
                                <FaFile className="h-4 w-4 text-gray-600" />
                                Files ({files.length})
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {files.map((file, index) => (
                                    <Button
                                        key={`file-${index}`}
                                        variant="outline"
                                        size="sm"
                                        className="justify-between h-auto p-3 text-left"
                                        onClick={() => handleOpenItem(file.name)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <FaFile className="h-4 w-4 text-gray-600 flex-shrink-0" />
                                            <span className="truncate">{file.name}</span>
                                        </div>
                                        <FaExternalLinkAlt className="h-3 w-3 text-muted-foreground" />
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                        💡 Click any item to open it with the default application
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
