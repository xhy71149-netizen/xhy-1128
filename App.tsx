
import React, { useState, useMemo } from 'react';
import { VideoClip, SequenceConfig, GeneratedSequence, ProcessingState } from './types';
import { processUploadedFiles, formatDuration, concatVideos } from './utils/video';
import { generateBatchSequences } from './services/gemini';
import { FileUploader } from './components/FileUploader';
import { Player } from './components/Player';
import { Controls } from './components/Controls';

const App: React.FC = () => {
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [bgmFiles, setBgmFiles] = useState<File[]>([]); // Changed to array
  const [config, setConfig] = useState<SequenceConfig>({ minDuration: 10, maxDuration: 60 });
  
  // Now store an array of generated sequences (one per BGM)
  const [generatedSequences, setGeneratedSequences] = useState<GeneratedSequence[]>([]);
  // Track which sequence is currently selected for preview
  const [selectedSequenceId, setSelectedSequenceId] = useState<string | null>(null);

  const [processingState, setProcessingState] = useState<ProcessingState>({ status: 'idle' });
  
  // Export states
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [useGPU, setUseGPU] = useState(false);

  const totalAvailableDuration = useMemo(() => 
    clips.reduce((acc, clip) => acc + clip.duration, 0), 
  [clips]);

  const activeSequence = useMemo(() => 
    generatedSequences.find(s => s.id === selectedSequenceId) || generatedSequences[0] || null,
  [generatedSequences, selectedSequenceId]);

  const handleUploadVideos = async (files: File[]) => {
    setProcessingState({ status: 'analyzing', message: '正在提取视频元数据...' });
    try {
      const newClips = await processUploadedFiles(files);
      setClips(prev => [...prev, ...newClips]);
      setProcessingState({ status: 'idle' });
    } catch (error) {
      setProcessingState({ status: 'error', message: '处理视频失败。' });
    }
  };

  const handleUploadBGM = (files: File[]) => {
    if (files.length > 0) {
        setBgmFiles(prev => [...prev, ...files]);
    }
  };

  const removeBGM = (index: number) => {
      setBgmFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    if (clips.length === 0) return;
    
    // If no BGM is uploaded, we can technically still generate one video without BGM
    // But logic prefers BGM for rhythm. We'll handle empty BGM array as "1 video, no BGM".
    
    setProcessingState({ status: 'generating', message: 'AI 导演正在初始化...' });
    setGeneratedSequences([]);
    setSelectedSequenceId(null);

    try {
      const results = await generateBatchSequences(
        clips, 
        bgmFiles, 
        config,
        (msg) => setProcessingState({ status: 'generating', message: msg })
      );
      
      setGeneratedSequences(results);
      if (results.length > 0) {
          setSelectedSequenceId(results[0].id);
      }
      setProcessingState({ status: 'complete' });
    } catch (error) {
      console.error(error);
      setProcessingState({ status: 'error', message: 'AI 生成失败，请重试。' });
    }
  };

  const handleClear = () => {
    setClips([]);
    setGeneratedSequences([]);
    setProcessingState({ status: 'idle' });
  };

  const handleDownloadMerged = async () => {
    if (!activeSequence?.timeline.length) return;
    
    setIsExporting(true);
    setExportProgress(0);
    
    try {
      const blob = await concatVideos(
          activeSequence.timeline, 
          activeSequence.bgmFile || null, 
          useGPU,
          (progress) => {
            setExportProgress(progress);
          }
      );
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeSequence.title || 'smart-clip-sequence'}.webm`;
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
          上传原始素材和背景音乐，Gemini AI 将聆听节奏、分析内容，为您自动卡点剪辑。
          <br/><span className="text-sm text-brand-400/80">支持多首BGM批量生成 · 智能去重</span>
        </p>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Input & Controls */}
        <div className="lg:col-span-4 space-y-6">
          {/* Video Uploader */}
          <div className="h-40">
            <FileUploader 
                onUpload={handleUploadVideos} 
                isLoading={processingState.status === 'analyzing'}
                label="添加视频素材"
                icon={
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                }
            />
          </div>

          {/* BGM Uploader */}
          <div>
             <div className="mb-2 flex justify-between items-center">
                <h3 className="text-sm font-medium text-gray-300">背景音乐列表 ({bgmFiles.length})</h3>
                {bgmFiles.length > 0 && (
                    <button onClick={() => setBgmFiles([])} className="text-xs text-red-400 hover:text-red-300">清空</button>
                )}
             </div>
             
             {/* BGM List */}
             {bgmFiles.length > 0 && (
                 <div className="mb-3 max-h-32 overflow-y-auto space-y-2 pr-1">
                     {bgmFiles.map((file, idx) => (
                         <div key={idx} className="flex items-center justify-between bg-brand-900/30 border border-brand-500/20 rounded-lg p-2">
                             <div className="flex items-center gap-2 overflow-hidden">
                                 <svg className="w-4 h-4 text-brand-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                                 <span className="text-xs text-gray-200 truncate">{file.name}</span>
                             </div>
                             <button onClick={() => removeBGM(idx)} className="text-gray-500 hover:text-red-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                             </button>
                         </div>
                     ))}
                 </div>
             )}

             <div className="h-24">
                <FileUploader 
                    onUpload={handleUploadBGM} 
                    isLoading={false}
                    accept="audio/*"
                    multiple={true} // Allow multiple BGM
                    label={bgmFiles.length > 0 ? "继续添加 BGM" : "上传背景音乐 (可多选)"}
                    subLabel="MP3, WAV, AAC - 每个 BGM 生成一个视频"
                    icon={
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                    }
                />
             </div>
          </div>

          {clips.length > 0 && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-dark-800 rounded-xl p-4 border border-gray-700 max-h-48 overflow-y-auto">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-gray-200">视频库 ({clips.length})</h3>
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
                useGPU={useGPU}
                onToggleGPU={setUseGPU}
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
                    AI 正在生成 ({generatedSequences.length}/{bgmFiles.length || 1})...
                  </span>
                ) : (
                  `批量生成 ${bgmFiles.length > 0 ? bgmFiles.length : 1} 个视频`
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
          {activeSequence ? (
            <div className="space-y-6 animate-fade-in">
              {/* Tabs for Multiple Generations */}
              {generatedSequences.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                      {generatedSequences.map((seq, idx) => (
                          <button
                            key={seq.id}
                            onClick={() => setSelectedSequenceId(seq.id)}
                            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all
                                ${selectedSequenceId === seq.id 
                                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/30' 
                                    : 'bg-dark-800 text-gray-400 hover:bg-dark-700'}`}
                          >
                              视频 #{idx + 1}
                              <span className="block text-[10px] opacity-70 truncate max-w-[100px]">{seq.bgmName}</span>
                          </button>
                      ))}
                  </div>
              )}

              <div className="bg-dark-800 rounded-xl overflow-hidden border border-gray-700 shadow-2xl p-4">
                 <Player 
                    timeline={activeSequence.timeline} 
                    bgmFile={activeSequence.bgmFile || null}
                    onEnded={() => console.log('Sequence ended')} 
                    autoPlay={true}
                 />
              </div>

              <div className="bg-dark-800 p-6 rounded-xl border border-gray-700">
                <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-1">{activeSequence.title}</h2>
                        <div className="flex flex-col gap-1 text-sm text-gray-400">
                            <div className="flex gap-4">
                                <span>总时长: {activeSequence.totalDuration.toFixed(1)}s</span>
                                <span>片段数: {activeSequence.timeline.length}</span>
                            </div>
                            {activeSequence.bgmName && (
                                <span className="text-brand-400">♫ BGM: {activeSequence.bgmName}</span>
                            )}
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
                           正在合成 ({(exportProgress * 100).toFixed(0)}%)...
                         </>
                      ) : (
                         <>
                           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                           </svg>
                           导出当前视频
                         </>
                      )}
                    </button>
                </div>
                
                <div className="bg-dark-900 p-4 rounded-lg border border-gray-800">
                    <h4 className="text-sm font-semibold text-brand-500 mb-2 uppercase tracking-wider">AI 导演笔记</h4>
                    <p className="text-gray-300 italic leading-relaxed">
                        "{activeSequence.narrativeReasoning}"
                    </p>
                </div>
              </div>
            </div>
          ) : (
            /* Empty State */
            <div className="h-full min-h-[400px] flex items-center justify-center bg-dark-800/50 rounded-xl border-2 border-dashed border-gray-700">
                <div className="text-center text-gray-600 max-w-sm">
                    <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-medium text-gray-500 mb-2">准备就绪</h3>
                    <p className="text-sm">在左侧上传素材和 BGM，AI 将分析元数据和音乐节奏为您构建故事。</p>
                </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
