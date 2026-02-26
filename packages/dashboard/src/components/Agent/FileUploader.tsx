import { useState, useRef, useCallback } from 'react';
import { Upload, X, FileText, Image, Trash2 } from 'lucide-react';
import { uploadFile, deleteUpload, type UploadResult } from '../../lib/api';
import { useTranslation } from '../../i18n';

interface FileUploaderProps {
  projectId: string;
  attachments: UploadResult[];
  onAttachmentAdd: (attachment: UploadResult) => void;
  onAttachmentRemove: (id: string) => void;
}

export function FileUploader({ projectId, attachments, onAttachmentAdd, onAttachmentRemove }: FileUploaderProps) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    setProgress(30);
    try {
      const result = await uploadFile(projectId, file);
      setProgress(100);
      onAttachmentAdd(result);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setTimeout(() => { setUploading(false); setProgress(0); }, 300);
    }
  }, [projectId, onAttachmentAdd]);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      handleUpload(files[i]);
    }
  }, [handleUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleRemove = useCallback(async (id: string) => {
    try {
      await deleteUpload(id);
      onAttachmentRemove(id);
    } catch { /* ignore */ }
  }, [onAttachmentRemove]);

  const isImage = (mime: string) => mime.startsWith('image/');

  return (
    <div className="space-y-1.5">
      {/* Attachment list */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {attachments.map((a) => (
            <div key={a.id} className="group relative flex items-center gap-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded-lg text-[10px]">
              {isImage(a.mimeType) ? (
                <Image className="w-3 h-3 text-blue-400 flex-shrink-0" />
              ) : (
                <FileText className="w-3 h-3 text-gray-400 flex-shrink-0" />
              )}
              <span className="text-gray-300 max-w-[120px] truncate">{a.filename}</span>
              <span className="text-gray-600">{formatSize(a.size)}</span>
              <button
                onClick={() => handleRemove(a.id)}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-900/30 rounded transition-opacity"
              >
                <Trash2 className="w-2.5 h-2.5 text-red-400" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload area */}
      <div
        className={`flex items-center gap-2 ${dragOver ? 'bg-blue-900/20 border-blue-500' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-400 hover:text-gray-200 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors disabled:opacity-50"
        >
          <Upload className="w-3 h-3" />
          {uploading ? `${progress}%` : t('agent.chat.attachFile')}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          accept="image/*,.pdf,.txt,.js,.ts,.tsx,.jsx,.json,.css,.html,.py,.md"
        />
        {uploading && (
          <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
