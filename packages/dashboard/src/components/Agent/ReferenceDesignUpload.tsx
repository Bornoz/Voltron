import { useState, useRef, useCallback } from 'react';
import { ImagePlus, X, Upload, Wand2 } from 'lucide-react';
import * as api from '../../lib/api';
import { useTranslation } from '../../i18n';

interface ReferenceDesignUploadProps {
  projectId: string;
  onGenerate: (prompt: string, attachmentUrls: string[]) => void;
}

export function ReferenceDesignUpload({ projectId, onGenerate }: ReferenceDesignUploadProps) {
  const { t } = useTranslation();
  const [image, setImage] = useState<{ url: string; name: string; uploadId?: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const result = await api.uploadFile(projectId, file);
      setImage({ url: result.url, name: result.filename, uploadId: result.id });
    } catch {
      // fallback: show local preview
      const localUrl = URL.createObjectURL(file);
      setImage({ url: localUrl, name: file.name });
    } finally {
      setUploading(false);
    }
  }, [projectId]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleGenerate = useCallback(() => {
    if (!image) return;
    const basePrompt = instruction.trim()
      ? `Reference Design: I've uploaded a design screenshot. ${instruction.trim()}\n\nPlease analyze the uploaded reference image and create a similar UI. Match the layout, spacing, color scheme, and typography as closely as possible.`
      : `Reference Design: I've uploaded a design screenshot. Please analyze it and recreate a similar UI component. Match the layout, spacing, colors, typography, and overall feel as closely as possible using modern React + Tailwind CSS.`;

    const attachments = image.url.startsWith('blob:') ? [] : [image.url];
    onGenerate(basePrompt, attachments);
  }, [image, instruction, onGenerate]);

  if (!image) {
    return (
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed cursor-pointer
          transition-all duration-200 ${
          dragOver
            ? 'border-purple-400/60 bg-purple-500/10'
            : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15] hover:bg-white/[0.04]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        {uploading ? (
          <>
            <Upload className="w-8 h-8 text-purple-400 animate-bounce mb-2" />
            <span className="text-xs text-gray-400">{t('referenceDesign.uploading')}</span>
          </>
        ) : (
          <>
            <ImagePlus className="w-8 h-8 text-gray-500 mb-2" />
            <span className="text-xs text-gray-400 font-medium">{t('referenceDesign.uploadTitle')}</span>
            <span className="text-[10px] text-gray-600 mt-1">
              {t('referenceDesign.uploadDesc')}
            </span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border border-white/[0.08] bg-white/[0.02]">
      {/* Preview */}
      <div className="relative group">
        <img
          src={image.url}
          alt={t('referenceDesign.altText')}
          className="w-full max-h-48 object-contain bg-black/30"
        />
        <button
          onClick={() => { setImage(null); setInstruction(''); }}
          className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        <div className="absolute bottom-0 left-0 right-0 px-3 py-1.5 bg-gradient-to-t from-black/80 to-transparent">
          <span className="text-[10px] text-gray-300 truncate block">{image.name}</span>
        </div>
      </div>

      {/* Instruction input */}
      <div className="p-3 space-y-2">
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder={t('referenceDesign.instructionPlaceholder')}
          rows={2}
          className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-xs text-gray-300
            placeholder:text-gray-600 focus:outline-none focus:border-purple-500/40 resize-none"
        />
        <button
          onClick={handleGenerate}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold
            bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500
            text-white transition-all active:scale-[0.98] shadow-lg shadow-purple-500/20"
        >
          <Wand2 className="w-3.5 h-3.5" />
          {t('referenceDesign.generateBtn')}
        </button>
      </div>
    </div>
  );
}
