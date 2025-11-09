/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import type { SegmentObject } from '../types/segmentation';

type EditMode = 'precision' | 'chat';

const getObjectDisplayNumber = (obj: SegmentObject, fallback: number): number => {
  const match = obj.id.match(/obj_(\d+)/);
  if (match) {
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed + 1 : fallback;
  }
  return fallback;
};

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
  { value: 'precision', label: 'Precise Select', description: 'Choose exact objects for pixel-level control.' },
  { value: 'chat', label: 'Chat Edit', description: 'Skip selections and edit the entire image with one prompt.' },
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
            ✕ Clear all
          </button>
        </div>
      )}
      <div className="w-full bg-white border border-gray-300 rounded-lg overflow-hidden shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition">
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="e.g., make it red, turn it blue, replace it with a dog..."
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
        {isLoading ? 'AI is generating...' : 'Generate'}
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
            <div className="text-xs text-red-600 bg-red-50 rounded-lg p-2 border border-red-200 flex flex-col gap-1.5">
              <p>❌ {segmentationError}</p>
              <button
                type="button"
                onClick={() => onEditModeChange('chat')}
                className="self-start inline-flex items-center gap-1 rounded-md border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-50"
              >
                → Switch to Chat Edit
              </button>
            </div>
          )}

          {objectCount > 0 && (
            <button
              type="button"
              onClick={onResegment}
              disabled={isSegmenting}
              className="w-full text-center bg-gray-50 border border-gray-200 text-gray-700 font-semibold rounded-md py-2 px-3 text-sm transition-all duration-200 ease-in-out hover:bg-gray-100 hover:border-gray-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSegmenting ? 'Reanalyzing...' : 'Resegment'}
            </button>
          )}

          {selectedObjects.length === 0 ? (
            <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
              <p className="text-sm">👆 Click objects in the image to start editing. Multiple selections are allowed.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <p className="text-xs text-gray-600 leading-snug">
                  ✅ Selected {selectedObjects.length} objects. Describe the change you want.
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedObjects.map((obj, index) => {
                    const label = obj.label?.trim() || 'Unnamed object';
                    const number = getObjectDisplayNumber(obj, index + 1);
                    const title = `#${number} ${label}`;
                    return (
                    <button
                      key={obj.id}
                      type="button"
                      onClick={() => onRemoveSelected(obj.id)}
                      className="flex items-center gap-1 rounded-full bg-blue-100 text-blue-700 px-3 py-1 text-xs font-medium hover:bg-blue-200 transition"
                    >
                      <span>{title}</span>
                      <span aria-hidden="true">×</span>
                    </button>
                    );
                  })}
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
            💬 Chat Edit: Enter the effect you want—e.g., “make it cyberpunk” or “brighten the sky”—and the AI will edit the entire image.
          </div>
          {renderPromptForm(false)}
        </>
      )}
    </div>
  );
};

export default EditPanel;
