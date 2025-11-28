import React, { useState, useMemo } from 'react';
import { VideoClip, SequenceConfig, GeneratedSequence, ProcessingState } from './types';
import { processUploadedFiles, formatDuration, concatVideos } from './utils/video';
import { generateSmartSequence } from './services/gemini';
import { FileUploader } from './components/FileUploader';
import { Player } from './components/Player';
import { Controls } from './components/Controls';

const App: React.FC = () => {
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [config, setConfig] = useState<SequenceConfig>({ minDuration: 10, maxDuration: 60 });
  const [generatedSequence, setGeneratedSequence] = useState<GeneratedSequence | null>(null);
  const [processingState, setProcessingState] = useState<ProcessingState>({ status: 'idle' });
  
  // Export states
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const totalAvailableDuration = useMemo(() => 
    clips.reduce((acc, clip) => acc + clip.duration, 0), 
  [clips]);

  const handleUpload = async (files: File[]) => {
    setProcessingState({ status: 'analyzing', message: '正在提取视频元数据...' });
    try {
      const newClips = await processUploadedFiles(files);
      setClips(prev => [...prev, ...newClips]);
      setProcessingState({ status: 'idle' });
    } catch (error) {
      setProcessingState({ status: 'error', message: '处理视频失败。' });
    }
  };

  const handleGenerate = async () => {
    if (clips.length === 0) return;
    
    setProcessingState({ status: 'generating', message: 'AI 导演正在思考中...' });
    setGeneratedSequence(null);

    try {
      const result = await generateSmartSequence(clips, config);
      setGeneratedSequence(result);
      setProcessingState({ status: 'complete' });
    } catch (error) {
      console.error(error);
      setProcessingState({ status: 'error', message: 'AI 生成失败，请重试。' });
    }
  };

  const handleClear = () => {
    setClips([]);
    setGeneratedSequence(null);
    setProcessingState({ status: 'idle' });
  };

  const handleDownloadMerged = async () => {
    if (!generatedSequence?.clips.length) return;
    
    setIsExporting(true);
    setExportProgress(0);
    
    try {
      const blob = await concatVideos(generatedSequence.clips, (progress) => {
        setExportProgress(progress);
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${generatedSequence.title || 'smart-clip-sequence'}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('导出视频失败，请重试');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <header className="mb-12 text-center">
        <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-brand-500 to-purple-500 bg-clip-text text-transparent mb-4">
          智剪 AI 导演
        </h1>
        <p className="text-gray-400 max-w-2xl mx-auto text-lg">
          上传原始素材，Gemini AI 将根据文件名理解内容，为您自动剪辑出有逻辑的精彩故事。
        </p>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Input & Controls */}
        <div className="lg:col-span-4 space-y-6">
          <FileUploader 
            onUpload={handleUpload} 
            isLoading={processingState.status === 'analyzing'} 
          />

          {clips.length > 0 && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-dark-800 rounded-xl p-4 border border-gray-700 max-h-60 overflow-y-auto">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-gray-200">素材库 ({clips.length})</h3>
                  <button 
                    onClick={handleClear}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    清空
                  </button>
                </div>
                <div className="space-y-2">
                  {clips.map((clip) => (
                    <div key={clip.id} className="flex justify-between items-center text-sm bg-dark-900 p-2 rounded border border-gray-800">
                      <span className="truncate flex-1 pr-2 text-gray-300" title={clip.name}>{clip.name}</span>
                      <span className="text-gray-500 font-mono text-xs">{formatDuration(clip.duration)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Controls 
                config={config} 
                onChange={setConfig} 
                disabled={processingState.status === 'generating'}
                totalAvailableDuration={totalAvailableDuration}
              />

              <button
                onClick={handleGenerate}
                disabled={processingState.status === 'generating' || processingState.status === 'analyzing' || isExporting}
                className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98]
                  ${processingState.status === 'generating' 
                    ? 'bg-gray-700 cursor-wait text-gray-400' 
                    : 'bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white'}`}
              >
                {processingState.status === 'generating' ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    AI 正在导演中...
                  </span>
                ) : (
                  "生成剪辑序列"
                )}
              </button>
              
              {processingState.message && (
                <div className={`text-center text-sm ${processingState.status === 'error' ? 'text-red-400' : 'text-brand-500'}`}>
                    {processingState.message}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Output & Player */}
        <div className="lg:col-span-8 space-y-6">
          {generatedSequence ? (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-dark-800 rounded-xl overflow-hidden border border-gray-700 shadow-2xl">
                 <Player 
                    playlist={generatedSequence.clips} 
                    onEnded={() => console.log('Sequence ended')} 
                    autoPlay={true}
                 />
              </div>

              <div className="bg-dark-800 p-6 rounded-xl border border-gray-700">
                <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-1">{generatedSequence.title}</h2>
                        <div className="flex gap-4 text-sm text-gray-400">
                            <span>总时长: {formatDuration(generatedSequence.totalDuration)}</span>
                            <span>片段数: {generatedSequence.clips.length}</span>
                        </div>
                    </div>
                    
                    <button
                      onClick={handleDownloadMerged}
                      disabled={isExporting}
                      className={`px-6 py-2 rounded-lg font-medium transition-all flex items-center gap-2
                        ${isExporting 
                          ? 'bg-gray-700 text-gray-400 cursor-wait' 
                          : 'bg-green-600 hover:bg-green-500 text-white shadow-lg hover:shadow-green-500/20'}`}
                    >
                      {isExporting ? (
                         <>
                           <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                           </svg>
                           正在合成... {Math.round(exportProgress * 100)}%
                         </>
                      ) : (
                         <>
                           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                           </svg>
                           下载合成视频
                         </>
                      )}
                    </button>
                </div>
                
                <div className="bg-dark-900 p-4 rounded-lg border border-gray-800">
                    <h4 className="text-sm font-semibold text-brand-500 mb-2 uppercase tracking-wider">AI 导演笔记</h4>
                    <p className="text-gray-300 italic leading-relaxed">
                        "{generatedSequence.narrativeReasoning}"
                    </p>
                </div>
              </div>
            </div>
          ) : (
            /* Empty State / Placeholder */
            <div className="h-full min-h-[400px] flex items-center justify-center bg-dark-800/50 rounded-xl border-2 border-dashed border-gray-700">
                <div className="text-center text-gray-600 max-w-sm">
                    <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-medium text-gray-500 mb-2">准备就绪</h3>
                    <p className="text-sm">在左侧上传素材，AI 将分析元数据并为您构建故事。</p>
                </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;