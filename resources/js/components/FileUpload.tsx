import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, X, File, Image, Video } from 'lucide-react';
import { useState, useRef } from 'react';
import { router } from '@inertiajs/react';

interface FileUploadProps {
    type: 'image' | 'video' | 'document';
    value?: string;
    onChange: (url: string, filename?: string) => void;
    onDelete?: () => void;
}

export function FileUpload({ type, value, onChange, onDelete }: FileUploadProps) {
    const [uploading, setUploading] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<{
        url: string;
        filename: string;
        size: number;
    } | null>(
        value ? {
            url: value,
            filename: value.split('/').pop() || 'Файл',
            size: 0
        } : null
    );
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploading(true);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', type);

        try {
            const response = await fetch('/api/upload/automation-file', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
            });

            const data = await response.json();

            if (data.success) {
                const fileInfo = {
                    url: data.url,
                    filename: data.url.split('/').pop() || data.filename,
                    size: data.size
                };
                setUploadedFile(fileInfo);
                onChange(data.url, data.filename);
            }
        } catch (error) {
            console.error('Upload failed:', error);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async () => {
        if (uploadedFile && onDelete) {
            try {
                // Extract path from URL for deletion
                const path = uploadedFile.url.replace('/storage/', '');
                await fetch('/api/upload/automation-file', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                    },
                    body: JSON.stringify({ path }),
                });
            } catch (error) {
                console.error('Delete failed:', error);
            }

            setUploadedFile(null);
            onDelete();
        }
    };

    const getIcon = () => {
        switch (type) {
            case 'image': return <Image className="h-4 w-4" />;
            case 'video': return <Video className="h-4 w-4" />;
            default: return <File className="h-4 w-4" />;
        }
    };

    const getAccept = () => {
        switch (type) {
            case 'image': return 'image/*';
            case 'video': return 'video/*';
            default: return '*/*';
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="space-y-3">
            <input
                ref={fileInputRef}
                type="file"
                accept={getAccept()}
                onChange={handleFileSelect}
                className="hidden"
            />

            {!uploadedFile && !value && (
                <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                >
                    {uploading ? (
                        <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2" />
                            Загрузка...
                        </>
                    ) : (
                        <>
                            <Upload className="h-4 w-4 mr-2" />
                            Загрузить {type === 'image' ? 'изображение' : type === 'video' ? 'видео' : 'файл'}
                        </>
                    )}
                </Button>
            )}

            {(uploadedFile || value) && (
                <div className="flex items-center gap-2 p-3 border rounded-lg">
                    {getIcon()}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                            {uploadedFile?.filename || 'Загруженный файл'}
                        </p>
                        {uploadedFile?.size && (
                            <p className="text-xs text-muted-foreground">
                                {formatFileSize(uploadedFile.size)}
                            </p>
                        )}
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleDelete}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            )}

            <div className="text-center text-xs text-muted-foreground">
                или
            </div>

            <div>
                <Label>URL {type === 'image' ? 'изображения' : type === 'video' ? 'видео' : 'файла'}</Label>
                <Input
                    className="mt-1"
                    placeholder="https://..."
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                />
            </div>
        </div>
    );
}