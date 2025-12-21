/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useMemo, useState } from 'react';
import { HomeIcon } from '../../components/icons';

interface HistorySidebarProps {
  history: File[];
  historyIndex: number;
  onSelect: (index: number) => void;
  onGoHome?: () => void;
  maxEntries?: number;
}

type HistoryEntry = {
  file: File;
  index: number;
  stepLabel: string;
};

const HistorySidebar: React.FC<HistorySidebarProps> = ({
  history,
  historyIndex,
  onSelect,
  onGoHome,
  maxEntries = 5
}) => {
  const visibleEntries = useMemo<HistoryEntry[]>(() => {
    if (history.length === 0) {
      return [];
    }

    const startIndex = Math.max(0, history.length - maxEntries);
    return history.slice(startIndex).map((file, offset) => {
      const index = startIndex + offset;
      return {
        file,
        index,
        stepLabel: `Step ${index + 1}`
      };
    });
  }, [history, maxEntries]);

  const [thumbUrls, setThumbUrls] = useState<Record<number, string>>({});

  useEffect(() => {
    if (visibleEntries.length === 0) {
      setThumbUrls({});
      return;
    }

    const nextMap: Record<number, string> = {};
    const createdUrls: Array<{ index: number; url: string }> = [];

    visibleEntries.forEach(entry => {
      const previewUrl = URL.createObjectURL(entry.file);
      nextMap[entry.index] = previewUrl;
      createdUrls.push({ index: entry.index, url: previewUrl });
    });

    setThumbUrls(nextMap);

    return () => {
      createdUrls.forEach(item => URL.revokeObjectURL(item.url));
    };
  }, [visibleEntries]);

  if (visibleEntries.length === 0) {
    return null;
  }

  return (
    <div className="w-32 flex-shrink-0 bg-gray-50/80 border border-gray-200 rounded-2xl p-3 flex flex-col gap-3 shadow-inner shadow-white/60">
      {onGoHome && (
        <button
          type="button"
          onClick={onGoHome}
          className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl py-2 px-3 flex items-center justify-center gap-2 transition-all duration-200 shadow-md hover:shadow-lg active:scale-95"
          title="返回首页"
          aria-label="返回首页"
        >
          <HomeIcon className="w-4 h-4" />
          <span className="text-xs">首页</span>
        </button>
      )}
      <div className="flex flex-col gap-2 overflow-y-auto max-h-[60vh] pr-1">
        {visibleEntries.map(entry => {
          const isActive = entry.index === historyIndex;
          const thumbUrl = thumbUrls[entry.index];
          return (
            <button
              key={entry.index}
              type="button"
              onClick={() => onSelect(entry.index)}
              className={`w-full rounded-2xl border transition-all duration-200 overflow-hidden ${
                isActive
                  ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-500/20'
                  : 'border-transparent bg-white hover:border-gray-200 hover:shadow'
              }`}
            >
              <div className="relative w-full overflow-hidden bg-gray-100" style={{ paddingTop: '100%' }}>
                {thumbUrl ? (
                  <img
                    src={thumbUrl}
                    alt={entry.file.name || entry.stepLabel}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs">
                    Loading…
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default HistorySidebar;
