/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { UploadIcon, MagicWandIcon, PaletteIcon, SunIcon, CameraIcon } from './icons';

interface StartScreenProps {
  onFileSelect: (files: FileList | null) => void;
  onOpenCamera: () => void;
}



const StartScreen: React.FC<StartScreenProps> = ({ onFileSelect, onOpenCamera }) => {
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFileSelect(e.target.files);
  };

  return (
    <div className="relative w-full max-w-7xl mx-auto min-h-screen">
      {/* 背景装饰图片层 - 按草图位置分布，桌面端专用 */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden hidden lg:block">

        {/* 左上角 - OpenAI logo */}
        <div className="absolute top-18 left-10">
          <img
            src="/openai.png"
            alt="OpenAI"
            className="w-64 h-64 pointer-events-none"
            style={{ animation: 'float 6s ease-in-out infinite' }}
          />
        </div>

        {/* 右上角 - DeepSeek logo */}
        <div className="absolute top-20 right-20">
          <img
            src="/deepseek.png"
            alt="DeepSeek"
            className="w-64 h-64 pointer-events-none"
            style={{ animation: 'float 8s ease-in-out infinite 1s' }}
          />
        </div>

        {/* 右上角偏下 - Bicycle */}
        <div className="absolute top-40 right-8">
          <img
            src="/bicycle.png"
            alt="Bicycle"
            className="w-20 h-20 pointer-events-none"
            style={{ animation: 'float 7s ease-in-out infinite 2s' }}
          />
        </div>

        {/* 左侧中部 - MLX */}
        <div className="absolute top-80 left-8">
          <img
            src="/mlx.png"
            alt="MLX"
            className="w-24 h-24 pointer-events-none"
            style={{ animation: 'float 9s ease-in-out infinite 3s' }}
          />
        </div>

        {/* 左下角 - Human Coded */}
        <div className="absolute bottom-40 left-08">
          <img
            src="/humancode2.png"
            alt="Human Coded"
            className="w-48 h-48 pointer-events-none"
            style={{ animation: 'float 8s ease-in-out infinite 4s' }}
          />
        </div>

        {/* 右下角 - Lama */}
        <div className="absolute bottom-06 right-20">
          <img
            src="/lama.png"
            alt="Lama"
            className="w-48 h-48 pointer-events-none"
            style={{ animation: 'float 6s ease-in-out infinite 5s' }}
          />
        </div>

        {/* 左侧上部 - Grok */}
        <div className="absolute top-60 left-4">
          <img
            src="/grok.png"
            alt="Grok"
            className="w-24 h-24 pointer-events-none"
            style={{ animation: 'float 7s ease-in-out infinite 6s' }}
          />
        </div>

        {/* 右侧中部 - Strawberry */}
        <div className="absolute top-96 right-4">
          <img
            src="/strawbeery.png"
            alt="Strawberry"
            className="w-48 h-48 pointer-events-none"
            style={{ animation: 'float 8s ease-in-out infinite 7s' }}
          />
        </div>

        {/* 左下角偏上 - Agent */}
        <div className="absolute bottom-40 right-20">
          <img
            src="/agent.png"
            alt="Agent"
            className="w-32 h-32 pointer-events-none"
            style={{ animation: 'float 6s ease-in-out infinite 8s' }}
          />
        </div>



      </div>

      {/* 主要内容区域 - 居中显示，透明背景让logo可见 */}
      <div
        className={`relative z-10 w-full max-w-4xl mx-auto text-center p-2 tansition-all duration-300 rounded-2xl border-2 ${isDraggingOver ? 'bg-blue-500/10 border-dashed border-blue-400' : 'border-transparent'}`}
        onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDraggingOver(false);
          onFileSelect(e.dataTransfer.files);
        }}
      >

        <div className="flex flex-col items-center gap-6 animate-fade-in">

          <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 sm:text-6xl md:text-7xl">
            AI-Powered Photo Editing, <span className="text-blue-600">Simplified</span>
          </h1>
          <p className="max-w-2xl text-lg text-gray-700 md:text-xl">
            Retouch photos, apply creative filters, or crop precisely using simple text prompts. No complex tools needed.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row items-center gap-4">
            <label htmlFor="image-upload-start" className="relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white bg-blue-600 rounded-full cursor-pointer group hover:bg-blue-500 transition-colors">
              <UploadIcon className="w-6 h-6 mr-3 transition-transform duration-500 ease-in-out group-hover:rotate-[360deg] group-hover:scale-110" />
              Upload Image
            </label>
            <input id="image-upload-start" type="file" className="hidden" accept="image/*" onChange={handleFileChange} />

            <button
              onClick={onOpenCamera}
              className="relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-full cursor-pointer group hover:bg-blue-100 transition-colors"
            >
              <CameraIcon className="w-6 h-6 mr-3 transition-transform duration-300 ease-in-out group-hover:scale-110" />
              Use Camera
            </button>
          </div>
          <p className="text-sm text-gray-600">or drag and drop a file</p>


          <div className="mt-2 w-full">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="relative z-10 bg-white/90 backdrop-blur-sm p-6 rounded-lg border border-gray-200/80 shadow-lg flex flex-col items-center text-center">
                <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4">
                  <MagicWandIcon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Precise Retouching</h3>
                <p className="mt-2 text-gray-600">Click any point on your image to remove blemishes, change colors, or add elements with pinpoint accuracy.</p>
              </div>
              <div className="relative z-10 bg-white/90 backdrop-blur-sm p-6 rounded-lg border border-gray-200/80 shadow-lg flex flex-col items-center text-center">
                <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-full mb-4">
                  <PaletteIcon className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Creative Filters</h3>
                <p className="mt-2 text-gray-600">Transform photos with artistic styles. From vintage looks to futuristic glows, find or create the perfect filter.</p>
              </div>
              <div className="relative z-10 bg-white/90 backdrop-blur-sm p-6 rounded-lg border border-gray-200/80 shadow-lg flex flex-col items-center text-center">
                <div className="flex items-center justify-center w-12 h-12 bg-orange-100 rounded-full mb-4">
                  <SunIcon className="w-6 h-6 text-orange-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Smart Cropping</h3>
                <p className="mt-2 text-gray-600">Trim and reframe your shots with flexible aspect ratios to create perfect social posts or product photos.</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default StartScreen;
