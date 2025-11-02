/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';

interface EditPanelProps {
  prompt: string;
  onPromptChange: (prompt: string) => void;
  onGenerate: () => void;
  onResegment: () => void;
  onClearSelection: () => void;
  isLoading: boolean;
  isSegmenting: boolean;
  hasSelectedObject: boolean;
  segmentationError: string | null;
  objectCount: number;
}

const EditPanel: React.FC<EditPanelProps> = ({
  prompt,
  onPromptChange,
  onGenerate,
  onResegment,
  onClearSelection,
  isLoading,
  isSegmenting,
  hasSelectedObject,
  segmentationError,
  objectCount
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && hasSelectedObject) {
      onGenerate();
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* 分割状态信息 */}
      {objectCount > 0 && (
        <div className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2 border border-gray-200">
          <p>✅ 已识别 {objectCount} 个物体</p>
        </div>
      )}
      
      {segmentationError && (
        <div className="text-xs text-red-600 bg-red-50 rounded-lg p-2 border border-red-200">
          <p>❌ {segmentationError}</p>
        </div>
      )}

      {/* 重新分割按钮 */}
      {objectCount > 0 && (
        <button
          type="button"
          onClick={onResegment}
          disabled={isSegmenting}
          className="w-full text-center bg-gray-50 border border-gray-200 text-gray-700 font-semibold rounded-md py-2 px-3 text-sm transition-all duration-200 ease-in-out hover:bg-gray-100 hover:border-gray-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSegmenting ? '重新分析中...' : '重新分割'}
        </button>
      )}

      {/* 编辑区域 */}
      {!hasSelectedObject ? (
        <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
          <p className="text-sm">👆 点击图片中的物体开始编辑</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-600 leading-snug">
              ✅ 已选中物体，描述你想要的修改
            </p>
            <button
              type="button"
              onClick={onClearSelection}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              清除选择
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-2.5">
            <div className="w-full bg-white border border-gray-300 rounded-lg overflow-hidden shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition">
              <textarea
                value={prompt}
                onChange={(e) => onPromptChange(e.target.value)}
                placeholder="例如：改成红色、变成蓝色、换成一只狗..."
                className="w-full bg-white text-gray-900 rounded-lg p-3 text-sm focus:outline-none resize-none disabled:cursor-not-allowed disabled:opacity-60 min-h-24 leading-relaxed"
                disabled={isLoading}
                rows={4}
              />
            </div>
            <button
              type="submit"
              className="w-full bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-3 px-4 text-sm rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
              disabled={isLoading || !prompt.trim()}
            >
              {isLoading ? 'AI 生成中...' : '生成'}
            </button>
          </form>
        </>
      )}
    </div>
  );
};

export default EditPanel;
