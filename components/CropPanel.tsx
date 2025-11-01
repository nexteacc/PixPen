/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';

interface CropPanelProps {
  onApplyCrop: () => void;
  onSetAspect: (aspect: number | undefined) => void;
  isLoading: boolean;
  isCropping: boolean;
}

type AspectRatio = 'free' | '1:1' | '16:9';

const CropPanel: React.FC<CropPanelProps> = ({ onApplyCrop, onSetAspect, isLoading, isCropping }) => {
  const [activeAspect, setActiveAspect] = useState<AspectRatio>('free');
  
  const handleAspectChange = (aspect: AspectRatio, value: number | undefined) => {
    setActiveAspect(aspect);
    onSetAspect(value);
  }

  const aspects: { name: AspectRatio, value: number | undefined }[] = [
    { name: 'free', value: undefined },
    { name: '1:1', value: 1 / 1 },
    { name: '16:9', value: 16 / 9 },
  ];

  return (
    <div className="w-full bg-white border border-gray-200 rounded-lg p-3 flex flex-col gap-3 animate-fade-in shadow-sm">
      <h3 className="text-base font-semibold text-gray-700">Crop Image</h3>
      <p className="text-xs text-gray-600 leading-snug">Drag on image to select crop area</p>
      
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-gray-600">Aspect Ratio:</span>
        <div className="flex gap-1">
          {aspects.map(({ name, value }) => (
            <button
              key={name}
              onClick={() => handleAspectChange(name, value)}
              disabled={isLoading}
              className={`flex-1 px-2 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 ${
                activeAspect === name 
                ? 'bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-md shadow-blue-500/20' 
                : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={onApplyCrop}
        disabled={isLoading || !isCropping}
        className="w-full bg-gradient-to-br from-green-600 to-green-500 text-white font-bold py-2.5 px-4 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-sm disabled:from-green-800 disabled:to-green-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
      >
        Apply Crop
      </button>
    </div>
  );
};

export default CropPanel;
