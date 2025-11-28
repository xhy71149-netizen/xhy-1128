import React, { useCallback } from 'react';

interface FileUploaderProps {
  onUpload: (files: File[]) => void;
  isLoading: boolean;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onUpload, isLoading }) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(Array.from(e.target.files) as File[]);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const validFiles = (Array.from(e.dataTransfer.files) as File[]).filter(f => f.type.startsWith('video/'));
      if (validFiles.length > 0) {
        onUpload(validFiles);
      }
    }
  }, [onUpload]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div 
      className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer 
        ${isLoading ? 'opacity-50 pointer-events-none border-gray-600' : 'border-gray-600 hover:border-brand-500 hover:bg-dark-800'}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={() => document.getElementById('file-input')?.click()}
    >
      <input 
        type="file" 
        id="file-input" 
        multiple 
        accept="video/*" 
        className="hidden" 
        onChange={handleFileChange}
      />
      <div className="flex flex-col items-center gap-3">
        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <div className="text-lg font-medium text-gray-200">
          拖放视频片段到这里 或 点击上传
        </div>
        <p className="text-sm text-gray-500">
          支持 MP4, MOV, WebM。请使用描述性文件名以便 AI 更好地理解内容！
        </p>
      </div>
    </div>
  );
};