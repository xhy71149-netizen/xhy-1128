
import React, { useCallback } from 'react';

interface FileUploaderProps {
  onUpload: (files: File[]) => void;
  isLoading: boolean;
  accept?: string;
  label?: string;
  subLabel?: string;
  multiple?: boolean;
  icon?: React.ReactNode;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ 
  onUpload, 
  isLoading,
  accept = "video/*",
  label = "拖放视频片段到这里 或 点击上传",
  subLabel = "支持 MP4, MOV, WebM",
  multiple = true,
  icon
}) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(Array.from(e.target.files) as File[]);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const validFiles = (Array.from(e.dataTransfer.files) as File[]).filter(f => {
        // Simple mime type check based on accept prop
        const type = accept.split('/')[0]; 
        return f.type.startsWith(type);
      });
      if (validFiles.length > 0) {
        onUpload(validFiles);
      }
    }
  }, [onUpload, accept]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const inputId = `file-input-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div 
      className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer flex flex-col items-center justify-center gap-3 h-full
        ${isLoading ? 'opacity-50 pointer-events-none border-gray-600' : 'border-gray-600 hover:border-brand-500 hover:bg-dark-800'}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={() => document.getElementById(inputId)?.click()}
    >
      <input 
        type="file" 
        id={inputId} 
        multiple={multiple}
        accept={accept}
        className="hidden" 
        onChange={handleFileChange}
      />
      
      {icon || (
        <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      )}
      
      <div>
        <div className="text-base font-medium text-gray-200">
          {label}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {subLabel}
        </p>
      </div>
    </div>
  );
};
