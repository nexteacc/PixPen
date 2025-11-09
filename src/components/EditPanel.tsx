/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import type { SegmentObject } from '../types/segmentation';

type EditMode = 'precision' | 'chat';

interface EditPanelProps {
  editMode: EditMode;
  onEditModeChange: (mode: EditMode) => void;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  onGenerate: () => void;
  onResegment: () => void;
  onClearSelection: () => void;
  onRemoveSelected: (id: string) => void;
  isLoading: boolean;
  isSegmenting: boolean;
  selectedObjects: SegmentObject[];
  segmentationError: string | null;
  objectCount: number;
}

const MODE_OPTIONS: Array<{ value: EditMode; label: string; description: string }> = [
  { value: 'precision', label: '精准选区', description: '圈选具体物体，精准控制局部内容。' },
  { value: 'chat', label: '聊天改图', description: '无需选区，直接用一句话改整张图。' },
];

const EditPanel: React.FC<EditPanelProps> = ({
  editMode,
  onEditModeChange,
  prompt,
  onPromptChange,
  onGenerate,
  onResegment,
  onClearSelection,
  onRemoveSelected,
  isLoading,
  isSegmenting,
  selectedObjects,
  segmentationError,
  objectCount
}) => {
  const isPrecisionMode = editMode === 'precision';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const canGenerate = prompt.trim() && (!isPrecisionMode || selectedObjects.length > 0);
    if (canGenerate) {
      onGenerate();
    }
  };

  const renderPromptForm = (showSelectionActions: boolean) => (
    <form onSubmit={handleSubmit} className="w-full flex flex-col gap-2.5">
      {showSelectionActions && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClearSelection}
            className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
          >
            ✕ 清除全部
          </button>
        </div>
      )}
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
        disabled={isLoading || !prompt.trim() || (isPrecisionMode && selectedObjects.length === 0)}
      >
        {isLoading ? 'AI 生成中...' : '生成'}
      </button>
    </form>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <div className="grid grid-cols-2 gap-1.5">
          {MODE_OPTIONS.map((option) => {
            const isActive = option.value === editMode;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onEditModeChange(option.value)}
                className={`w-full rounded-md border text-sm font-semibold py-2 transition-all ${
                  isActive
                    ? 'border-blue-500 bg-blue-50 text-blue-600 shadow-sm'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <p className="text-center text-xs text-gray-500">
          {MODE_OPTIONS.find(option => option.value === editMode)?.description}
        </p>
      </div>

      {isPrecisionMode && (
        <>
          {segmentationError && (
            <div className="text-xs text-red-600 bg-red-50 rounded-lg p-2 border border-red-200">
              <p>❌ {segmentationError}</p>
            </div>
          )}

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

          {selectedObjects.length === 0 ? (
            <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
              <p className="text-sm">👆 点击图片中的物体开始编辑，可选择多个目标</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <p className="text-xs text-gray-600 leading-snug">
                  ✅ 已选中 {selectedObjects.length} 个物体，描述你想要的修改
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedObjects.map((obj, index) => (
                    <button
                      key={obj.id}
                      type="button"
                      onClick={() => onRemoveSelected(obj.id)}
                      className="flex items-center gap-1 rounded-full bg-blue-100 text-blue-700 px-3 py-1 text-xs font-medium hover:bg-blue-200 transition"
                    >
                      <span>{`物体 ${index + 1}`}</span>
                      <span aria-hidden="true">×</span>
                    </button>
                  ))}
                </div>
              </div>
              {renderPromptForm(true)}
            </>
          )}
        </>
      )}

      {!isPrecisionMode && (
        <>
          <div className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg p-3 leading-relaxed">
            💬 聊天改图：直接输入你想要的效果，例如“把它改成赛博朋克风格”或“让天空更通透明亮”，AI 会基于整张图片进行修改。
          </div>
          {renderPromptForm(false)}
        </>
      )}
    </div>
  );
};

export default EditPanel;
