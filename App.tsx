/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import { generateEditedImage, generateFilteredImage } from './services/geminiService';
import Header from './components/Header';
import Spinner from './components/Spinner';
import FilterPanel from './components/FilterPanel';
import CropPanel from './components/CropPanel';
import { UndoIcon, RedoIcon, EyeIcon, StackLayoutIcon, RightDockLayoutIcon, LeftDockLayoutIcon } from './components/icons';
import StartScreen from './components/StartScreen';
import CameraCapture from './components/CameraCapture'; // Import new component

// Helper to convert a data URL string to a File object
const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    if (arr.length < 2) throw new Error("Invalid data URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");

    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type:mime});
}

type Tab = 'retouch' | 'filters' | 'crop';
type LayoutMode = 'vertical' | 'rightDock' | 'leftDock';

type LayoutOption = {
  value: LayoutMode;
  label: string;
  Icon: React.FC<{ className?: string }>;
};

const LAYOUT_OPTIONS: LayoutOption[] = [
  { value: 'vertical', label: 'Stack layout', Icon: StackLayoutIcon },
  { value: 'rightDock', label: 'Right dock layout', Icon: RightDockLayoutIcon },
  { value: 'leftDock', label: 'Left dock layout', Icon: LeftDockLayoutIcon },
];

const LAYOUT_STORAGE_KEY = 'pixpen:layout';

const App: React.FC = () => {
  const [history, setHistory] = useState<File[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [prompt, setPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [editHotspot, setEditHotspot] = useState<{ x: number, y: number } | null>(null);
  const [displayHotspot, setDisplayHotspot] = useState<{ x: number, y: number } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('retouch');
  
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [aspect, setAspect] = useState<number | undefined>();
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false); // State for camera view
  const [layout, setLayout] = useState<LayoutMode>('vertical');
  const imgRef = useRef<HTMLImageElement>(null);

  const currentImage = history[historyIndex] ?? null;
  const originalImage = history[0] ?? null;
  const isEditing = Boolean(currentImage);

  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);

  // Effect to create and revoke object URLs safely for the current image
  useEffect(() => {
    if (currentImage) {
      const url = URL.createObjectURL(currentImage);
      setCurrentImageUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setCurrentImageUrl(null);
    }
  }, [currentImage]);
  
  // Effect to create and revoke object URLs safely for the original image
  useEffect(() => {
    if (originalImage) {
      const url = URL.createObjectURL(originalImage);
      setOriginalImageUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setOriginalImageUrl(null);
    }
  }, [originalImage]);

  // Load preferred layout from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedLayout = window.localStorage.getItem(LAYOUT_STORAGE_KEY) as LayoutMode | null;
    if (storedLayout && LAYOUT_OPTIONS.some(option => option.value === storedLayout)) {
      setLayout(storedLayout);
    }
  }, []);

  // Persist layout preference
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, layout);
  }, [layout]);


  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const addImageToHistory = useCallback((newImageFile: File) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newImageFile);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    // Reset transient states after an action
    setCrop(undefined);
    setCompletedCrop(undefined);
  }, [history, historyIndex]);

  const handleImageUpload = useCallback((file: File) => {
    setError(null);
    setHistory([file]);
    setHistoryIndex(0);
    setEditHotspot(null);
    setDisplayHotspot(null);
    setActiveTab('retouch');
    setCrop(undefined);
    setCompletedCrop(undefined);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!currentImage) {
      setError('No image loaded to edit.');
      return;
    }
    
    if (!prompt.trim()) {
        setError('Please enter a description for your edit.');
        return;
    }

    if (!editHotspot) {
        setError('Please click on the image to select an area to edit.');
        return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
        const editedImageUrl = await generateEditedImage(currentImage, prompt, editHotspot);
        const newImageFile = dataURLtoFile(editedImageUrl, `edited-${Date.now()}.png`);
        addImageToHistory(newImageFile);
        setEditHotspot(null);
        setDisplayHotspot(null);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`Failed to generate the image. ${errorMessage}`);
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, prompt, editHotspot, addImageToHistory]);
  
  const handleApplyFilter = useCallback(async (filterPrompt: string) => {
    if (!currentImage) {
      setError('No image loaded to apply a filter to.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
        const filteredImageUrl = await generateFilteredImage(currentImage, filterPrompt);
        const newImageFile = dataURLtoFile(filteredImageUrl, `filtered-${Date.now()}.png`);
        addImageToHistory(newImageFile);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`Failed to apply the filter. ${errorMessage}`);
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);
  
  const handleApplyCrop = useCallback(() => {
    if (!completedCrop || !imgRef.current) {
        setError('Please select an area to crop.');
        return;
    }

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        setError('Could not process the crop.');
        return;
    }

    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = completedCrop.width * pixelRatio;
    canvas.height = completedCrop.height * pixelRatio;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width,
      completedCrop.height,
    );
    
    const croppedImageUrl = canvas.toDataURL('image/png');
    const newImageFile = dataURLtoFile(croppedImageUrl, `cropped-${Date.now()}.png`);
    addImageToHistory(newImageFile);

  }, [completedCrop, addImageToHistory]);

  const handleUndo = useCallback(() => {
    if (canUndo) {
      setHistoryIndex(historyIndex - 1);
      setEditHotspot(null);
      setDisplayHotspot(null);
    }
  }, [canUndo, historyIndex]);
  
  const handleRedo = useCallback(() => {
    if (canRedo) {
      setHistoryIndex(historyIndex + 1);
      setEditHotspot(null);
      setDisplayHotspot(null);
    }
  }, [canRedo, historyIndex]);

  const handleReset = useCallback(() => {
    if (history.length > 0) {
      setHistoryIndex(0);
      setError(null);
      setEditHotspot(null);
      setDisplayHotspot(null);
    }
  }, [history]);

  const handleUploadNew = useCallback(() => {
      setHistory([]);
      setHistoryIndex(-1);
      setError(null);
      setPrompt('');
      setEditHotspot(null);
      setDisplayHotspot(null);
      setIsCameraOpen(false); // Make sure to close camera if open
  }, []);

  const handleDownload = useCallback(() => {
      if (currentImage) {
          const link = document.createElement('a');
          link.href = URL.createObjectURL(currentImage);
          link.download = `edited-${currentImage.name}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);
      }
  }, [currentImage]);
  
  const handleFileSelect = (files: FileList | null) => {
    if (files && files[0]) {
      handleImageUpload(files[0]);
    }
  };

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (activeTab !== 'retouch') return;
    
    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();

    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    
    setDisplayHotspot({ x: offsetX, y: offsetY });

    const { naturalWidth, naturalHeight, clientWidth, clientHeight } = img;
    const scaleX = naturalWidth / clientWidth;
    const scaleY = naturalHeight / clientHeight;

    const originalX = Math.round(offsetX * scaleX);
    const originalY = Math.round(offsetY * scaleY);

    setEditHotspot({ x: originalX, y: originalY });
};

  const handleCapture = (file: File) => {
    handleImageUpload(file);
    setIsCameraOpen(false);
  };

  const renderLayoutSelector = () => (
    <div className="w-full flex justify-end">
      <div className="flex bg-white/80 border border-gray-200 rounded-full shadow-sm overflow-hidden backdrop-blur-sm">
        {LAYOUT_OPTIONS.map(option => {
          const isActive = option.value === layout;
          const { Icon } = option;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setLayout(option.value)}
              aria-label={option.label}
              title={option.label}
              className={`w-10 h-10 flex items-center justify-center transition-colors ${
                isActive
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-5 h-5" />
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderImageSection = (mode: LayoutMode) => {
    const imageDisplay = (
      <div className="relative">
        {originalImageUrl && (
            <img
                key={originalImageUrl}
            src={originalImageUrl}
            alt="Original"
            className="w-full h-auto object-contain max-h-[60vh] rounded-xl pointer-events-none"
          />
        )}
        <img
          ref={imgRef}
          key={currentImageUrl ?? 'current'}
          src={currentImageUrl ?? ''}
          alt="Current"
          onClick={handleImageClick}
          className={`absolute top-0 left-0 w-full h-auto object-contain max-h-[60vh] rounded-xl transition-opacity duration-200 ease-in-out ${isComparing ? 'opacity-0' : 'opacity-100'} ${activeTab === 'retouch' ? 'cursor-crosshair' : ''}`}
        />
      </div>
    );

    const cropImageElement = (
      <img
        ref={imgRef}
        key={`crop-${currentImageUrl}`}
        src={currentImageUrl ?? ''}
        alt="Crop this image"
        className="w-full h-auto object-contain max-h-[60vh] rounded-xl"
      />
    );

    return (
      <div className="relative w-full shadow-2xl rounded-xl overflow-hidden bg-black/20">
        {isLoading && (
            <div className="absolute inset-0 bg-black/70 z-30 flex flex-col items-center justify-center gap-4 animate-fade-in">
                <Spinner />
                <p className="text-gray-300">AI is working its magic...</p>
            </div>
        )}

        {activeTab === 'crop' ? (
          <ReactCrop
            crop={crop}
            onChange={c => setCrop(c)}
            onComplete={c => setCompletedCrop(c)}
            aspect={aspect}
            className="max-h-[60vh]"
          >
            {cropImageElement}
          </ReactCrop>
        ) : (
          imageDisplay
        )}

        {displayHotspot && !isLoading && activeTab === 'retouch' && (
          <div
            className="absolute rounded-full w-6 h-6 bg-blue-500/50 border-2 border-white pointer-events-none -translate-x-1/2 -translate-y-1/2 z-10"
            style={{ left: `${displayHotspot.x}px`, top: `${displayHotspot.y}px` }}
          >
            <div className="absolute inset-0 rounded-full w-6 h-6 animate-ping bg-blue-400" />
          </div>
        )}
      </div>
    );
  };

  const renderTabButtons = () => {
    return (
      <div className="w-full bg-white border border-gray-200 rounded-lg p-2 flex items-center justify-center gap-2 shadow-sm">
        {(['retouch', 'crop', 'filters'] as Tab[]).map(tab => {
          const isActive = activeTab === tab;
          const sizing = 'py-3 px-5 text-base';
          const activeClasses = 'bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/20';
          const inactiveClasses = 'text-gray-600 hover:text-gray-900 hover:bg-gray-50';
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`w-full capitalize font-semibold rounded-md transition-all duration-200 ${sizing} ${isActive ? activeClasses : inactiveClasses}`}
            >
              {tab}
            </button>
          );
        })}
      </div>
    );
  };

  const renderActivePanel = () => {
    return (
      <div className="w-full">
        {activeTab === 'retouch' && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-md text-gray-600">
              {editHotspot ? 'Great! Now describe your localized edit below.' : 'Click an area on the image to make a precise edit.'}
            </p>
            <form onSubmit={(e) => { e.preventDefault(); handleGenerate(); }} className="w-full flex items-center gap-2">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={editHotspot ? "e.g., 'change my shirt color to blue'" : "First click a point on the image"}
                className="flex-grow bg-white border border-gray-300 text-gray-900 rounded-lg p-5 text-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isLoading || !editHotspot}
              />
              <button
                type="submit"
                className="bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-5 px-8 text-lg rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
                disabled={isLoading || !prompt.trim() || !editHotspot}
              >
                Generate
              </button>
            </form>
          </div>
        )}
        {activeTab === 'crop' && (
          <CropPanel
            onApplyCrop={handleApplyCrop}
            onSetAspect={setAspect}
            isLoading={isLoading}
            isCropping={!!completedCrop?.width && completedCrop.width > 0}
          />
        )}
        {activeTab === 'filters' && (
          <FilterPanel onApplyFilter={handleApplyFilter} isLoading={isLoading} />
        )}
      </div>
    );
  };

  const renderControls = () => {
    const sizing = 'py-3 px-5 text-base';
    return (
      <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
        <button
          onClick={handleUndo}
          disabled={!canUndo}
          className={`flex items-center justify-center text-center bg-gray-50 border border-gray-200 text-gray-700 font-semibold rounded-md transition-all duration-200 ease-in-out hover:bg-gray-100 hover:border-gray-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50 ${sizing}`}
          aria-label="Undo last action"
        >
          <UndoIcon className="w-5 h-5 mr-2" />
          Undo
        </button>
        <button
          onClick={handleRedo}
          disabled={!canRedo}
          className={`flex items-center justify-center text-center bg-gray-50 border border-gray-200 text-gray-700 font-semibold rounded-md transition-all duration-200 ease-in-out hover:bg-gray-100 hover:border-gray-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50 ${sizing}`}
          aria-label="Redo last action"
        >
          <RedoIcon className="w-5 h-5 mr-2" />
          Redo
        </button>

        <div className="h-6 w-px bg-gray-600 mx-1 hidden sm:block" />

        {canUndo && (
          <button
            onMouseDown={() => setIsComparing(true)}
            onMouseUp={() => setIsComparing(false)}
            onMouseLeave={() => setIsComparing(false)}
            onTouchStart={() => setIsComparing(true)}
            onTouchEnd={() => setIsComparing(false)}
            className={`flex items-center justify-center text-center bg-gray-50 border border-gray-200 text-gray-700 font-semibold rounded-md transition-all duration-200 ease-in-out hover:bg-gray-100 hover:border-gray-300 active:scale-95 ${sizing}`}
            aria-label="Press and hold to see original image"
          >
            <EyeIcon className="w-5 h-5 mr-2" />
            Compare
          </button>
        )}

        <button
          onClick={handleReset}
          disabled={!canUndo}
          className={`text-center bg-transparent border border-gray-200 text-gray-700 font-semibold rounded-md transition-all duration-200 ease-in-out hover:bg-gray-50 hover:border-gray-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-transparent ${sizing}`}
        >
          Reset
        </button>
        <button
          onClick={handleUploadNew}
          className={`text-center bg-gray-50 border border-gray-200 text-gray-700 font-semibold rounded-md transition-all duration-200 ease-in-out hover:bg-gray-100 hover:border-gray-300 active:scale-95 ${sizing}`}
        >
          Upload New
        </button>

        <button
          onClick={handleDownload}
          className={`flex-grow sm:flex-grow-0 ml-auto bg-gradient-to-br from-green-600 to-green-500 text-white font-bold rounded-md transition-all duration-300 ease-in-out shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner ${sizing}`}
        >
          Download Image
        </button>
      </div>
    );
  };

  const renderEditingLayout = () => {
    const imageSection = renderImageSection(layout);
    const tabButtons = renderTabButtons();
    const panelSection = renderActivePanel();
    const controlsSection = renderControls();
    const layoutSelector = renderLayoutSelector();

    if (layout === 'vertical') {
      return (
        <div className="w-full max-w-6xl mx-auto flex flex-col gap-6 animate-fade-in">
          {layoutSelector}
          <div className="w-full max-w-4xl mx-auto">{imageSection}</div>
          {tabButtons}
          {panelSection}
          {controlsSection}
        </div>
      );
    }

    if (layout === 'rightDock') {
      return (
        <div className="w-full max-w-6xl mx-auto flex flex-col gap-4 animate-fade-in">
          {layoutSelector}
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 flex flex-col gap-4">{imageSection}</div>
            <div className="w-full lg:w-[380px] flex flex-col gap-4">
              {tabButtons}
              {panelSection}
              {controlsSection}
            </div>
          </div>
        </div>
      );
    }

    if (layout === 'leftDock') {
      return (
        <div className="w-full max-w-6xl mx-auto flex flex-col gap-4 animate-fade-in">
          {layoutSelector}
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="w-full lg:w-[380px] flex flex-col gap-4">
              {tabButtons}
              {panelSection}
              {controlsSection}
            </div>
            <div className="flex-1 flex flex-col gap-4">{imageSection}</div>
          </div>
        </div>
      );
    }

    return (
      <div className="w-full max-w-6xl mx-auto flex flex-col gap-4 animate-fade-in">
        {layoutSelector}
        <div className="flex flex-col lg:flex-row-reverse gap-3">
          <div className="flex-1 flex flex-col gap-3">{imageSection}</div>
          <div className="w-full lg:w-[320px] flex flex-col gap-3 lg:max-h-[75vh] lg:overflow-y-auto lg:pr-1">
            {panelSection}
            {controlsSection}
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (error) {
      return (
        <div className="text-center animate-fade-in bg-red-50 border border-red-200 p-8 rounded-lg max-w-2xl mx-auto flex flex-col items-center gap-4">
          <h2 className="text-2xl font-bold text-red-700">An Error Occurred</h2>
          <p className="text-md text-red-600">{error}</p>
          <button
            onClick={() => { setError(null); if (!currentImage) handleUploadNew(); }}
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-6 rounded-lg text-md transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }

    if (!currentImageUrl) {
      if (isCameraOpen) {
        return <CameraCapture onCapture={handleCapture} onCancel={() => setIsCameraOpen(false)} />;
      }
      return <StartScreen onFileSelect={handleFileSelect} onOpenCamera={() => setIsCameraOpen(true)} />;
    }

    return renderEditingLayout();
  };
  
  return (
    <div className="min-h-screen text-gray-900 bg-white flex flex-col">
      {!isEditing && <Header />}
      {!isEditing && (
        <div className="flex items-center justify-center py-2">
          <img
            src="/yc.png"
            alt="Y Combinator"
            className="w-32 h-8 opacity-100 pointer-events-none"
            style={{ animation: 'float 9s ease-in-out infinite 9s' }}
          />
        </div>
      )}
      <main className={`flex-grow w-full max-w-[1600px] mx-auto p-2 md:p-6 flex justify-center ${currentImage ? 'items-start' : 'items-center'}`}>
        {renderContent()}
      </main>
    </div>
  );
};

export default App;
