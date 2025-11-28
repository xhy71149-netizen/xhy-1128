import React from 'react';
import { SequenceConfig } from '../types';

interface ControlsProps {
  config: SequenceConfig;
  onChange: (config: SequenceConfig) => void;
  disabled: boolean;
  totalAvailableDuration: number;
  useGPU: boolean;
  onToggleGPU: (value: boolean) => void;
}

export const Controls: React.FC<ControlsProps> = ({ 
  config, 
  onChange, 
  disabled, 
  totalAvailableDuration,
  useGPU,
  onToggleGPU
}) => {
  const handleChange = (key: keyof SequenceConfig, value: string) => {
    const numVal = parseInt(value, 10);
    if (!isNaN(numVal)) {
      onChange({ ...config, [key]: numVal });
    }
  };

  const applyPreset = () => {
    onChange({ ...config, minDuration: 20, maxDuration: 30 });
  };

  return (
    <div className="bg-dark-800 p-6 rounded-xl border border-gray-700 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            生成配置
        </h3>
        
        {/* GPU Toggle Switch */}
        <div className="flex items-center gap-3">
            <span className={`text-sm font-medium transition-colors ${useGPU ? 'text-green-400' : 'text-gray-400'}`}>
                NVIDIA GPU 加速
            </span>
            <button
                onClick={() => !disabled && onToggleGPU(!useGPU)}
                disabled={disabled}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-dark-800
                    ${useGPU ? 'bg-green-600' : 'bg-gray-600'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
                <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out
                        ${useGPU ? 'translate-x-6' : 'translate-x-1'}`}
                />
            </button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">最短时长 (秒)</label>
          <input
            type="number"
            min="1"
            max={config.maxDuration - 1}
            value={config.minDuration}
            onChange={(e) => handleChange('minDuration', e.target.value)}
            disabled={disabled}
            className="w-full bg-dark-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">最长时长 (秒)</label>
          <input
            type="number"
            min={config.minDuration + 1}
            value={config.maxDuration}
            onChange={(e) => handleChange('maxDuration', e.target.value)}
            disabled={disabled}
            className="w-full bg-dark-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all disabled:opacity-50"
          />
        </div>
      </div>

      <button
        onClick={applyPreset}
        disabled={disabled}
        className="w-full py-2 px-4 bg-dark-700 hover:bg-dark-600 text-brand-400 text-sm font-medium rounded-lg border border-brand-500/30 transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        应用短视频预设 (20-30秒)
      </button>
      
      <div className="text-xs text-gray-500 pt-2 border-t border-gray-700">
        可用原始素材总时长: <span className="text-gray-300">{Math.round(totalAvailableDuration)} 秒</span>
      </div>
    </div>
  );
};
