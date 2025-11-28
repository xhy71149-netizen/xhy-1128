import React from 'react';
import { SequenceConfig } from '../types';

interface ControlsProps {
  config: SequenceConfig;
  onChange: (config: SequenceConfig) => void;
  disabled: boolean;
  totalAvailableDuration: number;
}

export const Controls: React.FC<ControlsProps> = ({ config, onChange, disabled, totalAvailableDuration }) => {
  const handleChange = (key: keyof SequenceConfig, value: string) => {
    const numVal = parseInt(value, 10);
    if (!isNaN(numVal)) {
      onChange({ ...config, [key]: numVal });
    }
  };

  return (
    <div className="bg-dark-800 p-6 rounded-xl border border-gray-700 space-y-4">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        <svg className="w-5 h-5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
        生成配置
      </h3>
      
      <div className="grid grid-cols-2 gap-4">
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
      
      <div className="text-xs text-gray-500 pt-2 border-t border-gray-700">
        可用原始素材总时长: <span className="text-gray-300">{Math.round(totalAvailableDuration)} 秒</span>
      </div>
    </div>
  );
};