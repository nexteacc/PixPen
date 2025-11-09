/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import { generateEditedImage, generateFilteredImage } from './services/geminiService';
import { segmentImage, alignMasksToOriginal } from './src/services/segmentationService';
import type { SegmentObject } from './src/types/segmentation';
import Header from './components/Header';
import FilterPanel from './components/FilterPanel';
import CropPanel from './components/CropPanel';
import { UndoIcon, RedoIcon, EyeIcon, StackLayoutIcon, RightDockLayoutIcon, LeftDockLayoutIcon } from './components/icons';
import StartScreen from './components/StartScreen';
import CameraCapture from './components/CameraCapture';
import LoadingOverlay from './src/components/LoadingOverlay';
import ObjectSelectCanvas from './src/components/ObjectSelectCanvas';
import EditPanel from './src/components/EditPanel';
// import MaskPainter, { type MaskPainterHandle } from './components/MaskPainter';

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

const fileToDataURL = async (file: File): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

const combineMaskFiles = async (maskFiles: File[]): Promise<File> => {
  if (maskFiles.length === 1) {
    return maskFiles[0];
  }

  const dataUrls = await Promise.all(maskFiles.map(fileToDataURL));
  const baseImage = await loadImage(dataUrls[0]);
  const width = baseImage.naturalWidth || baseImage.width;
  const height = baseImage.naturalHeight || baseImage.height;

  if (!width || !height) {
    throw new Error('无法读取掩码尺寸。');
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('无法创建掩码画布。');
  }

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = false;

  for (const dataUrl of dataUrls) {
    const maskImg = await loadImage(dataUrl);
    const previousComposite = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighten';
    ctx.drawImage(maskImg, 0, 0, width, height);
    ctx.globalCompositeOperation = previousComposite;
  }

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));

  if (!blob) {
    throw new Error('无法导出组合掩码。');
  }

  return new File([blob], `combined-mask-${Date.now()}.png`, { type: 'image/png' });
};

const createFullImageMask = async (imageFile: File): Promise<File> => {
  const dataUrl = await fileToDataURL(imageFile);
  const image = await loadImage(dataUrl);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;

  if (!width || !height) {
    throw new Error('无法创建全图掩码，未知图像尺寸。');
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('无法创建全图掩码画布。');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));

  if (!blob) {
    throw new Error('无法导出全图掩码。');
  }

  return new File([blob], `full-mask-${Date.now()}.png`, { type: 'image/png' });
};

type Tab = 'retouch' | 'crop'; // 'filters' disabled
type LayoutMode = 'vertical' | 'rightDock' | 'leftDock';
type EditMode = 'precision' | 'chat';

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
  const [activeTab, setActiveTab] = useState<Tab>('retouch');
  
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [aspect, setAspect] = useState<number | undefined>();
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  // const [maskDataUrl, setMaskDataUrl] = useState<string | null>(null);
  // const [brushSize, setBrushSize] = useState<number>(40);
  const [layout, setLayout] = useState<LayoutMode>('rightDock');
  const [editMode, setEditMode] = useState<EditMode>('precision');
  
  // Object selection states
  const [segmentObjects, setSegmentObjects] = useState<SegmentObject[]>([]);
  const [selectedObjects, setSelectedObjects] = useState<SegmentObject[]>([]);
  const [isSegmenting, setIsSegmenting] = useState<boolean>(false);
  const [segmentationError, setSegmentationError] = useState<string | null>(null);
  
  const imgRef = useRef<HTMLImageElement>(null);
  // const maskPainterRef = useRef<MaskPainterHandle>(null);

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
    setSelectedObjects([]);
  }, [history, historyIndex]);

  const handleImageUpload = useCallback(async (file: File) => {
    setError(null);
    setHistory([file]);
    setHistoryIndex(0);
    setActiveTab('retouch');
    setCrop(undefined);
    setCompletedCrop(undefined);
    // setMaskDataUrl(null);
    // maskPainterRef.current?.clear();
    
    // Auto-segment on upload
    setIsSegmenting(true);
    setSegmentationError(null);
    setSegmentObjects([]);
    setSelectedObjects([]);
    
    try {
      const objects = await segmentImage(file);
      const alignedObjects = await alignMasksToOriginal(objects, file);
      setSegmentObjects(alignedObjects);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '图片分割失败';
      setSegmentationError(errorMessage);
      console.error('❌ Segmentation error:', err);
    } finally {
      setIsSegmenting(false);
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!currentImage) {
      setError('没有加载图片进行编辑。');
      return;
    }

    if (!prompt.trim()) {
      setError('请输入编辑描述。');
      return;
    }

    if (editMode === 'precision' && selectedObjects.length === 0) {
      setError('请选择至少一个物体进行编辑。');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const maskFile = editMode === 'precision'
        ? await combineMaskFiles(selectedObjects.map(obj => obj.maskFile))
        : await createFullImageMask(currentImage);
      const editedImageUrl = await generateEditedImage(currentImage, prompt, maskFile);
      const newImageFile = dataURLtoFile(editedImageUrl, `edited-${Date.now()}.png`);
      addImageToHistory(newImageFile);
      
      // Clear selection after successful edit
      if (editMode === 'precision') {
        setSelectedObjects([]);
      }
      setPrompt('');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '发生未知错误。';
      setError(`生成图片失败。${errorMessage}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [currentImage, prompt, selectedObjects, editMode, addImageToHistory]);
  
  const handleApplyFilter = useCallback(async (filterPrompt: string) => {
    if (!currentImage) {
      setError('没有加载图片以应用滤镜。');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
        const filteredImageUrl = await generateFilteredImage(currentImage, filterPrompt);
        const newImageFile = dataURLtoFile(filteredImageUrl, `filtered-${Date.now()}.png`);
        addImageToHistory(newImageFile);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '发生未知错误。';
        setError(`应用滤镜失败。${errorMessage}`);
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);
  
  const handleApplyCrop = useCallback(() => {
    if (!completedCrop || !imgRef.current) {
        setError('请选择要裁剪的区域。');
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
        setError('无法处理裁剪。');
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
      setSelectedObjects([]);
    }
  }, [canUndo, historyIndex]);
  
  const handleRedo = useCallback(() => {
    if (canRedo) {
      setHistoryIndex(historyIndex + 1);
      setSelectedObjects([]);
    }
  }, [canRedo, historyIndex]);

  const handleReset = useCallback(() => {
    if (history.length > 0) {
      setHistoryIndex(0);
      setError(null);
      setSelectedObjects([]);
    }
  }, [history]);

  const handleUploadNew = useCallback(() => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => {
        const target = e.target as HTMLInputElement;
        if (target.files && target.files[0]) {
          handleImageUpload(target.files[0]);
        }
      };
      input.click();
  }, [handleImageUpload]);

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

  const handleResegment = useCallback(async () => {
    if (!currentImage) return;
    
    setIsSegmenting(true);
    setSegmentationError(null);
    setSegmentObjects([]);
    setSelectedObjects([]);
    
    try {
      const objects = await segmentImage(currentImage);
      const alignedObjects = await alignMasksToOriginal(objects, currentImage);
      setSegmentObjects(alignedObjects);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '图片分割失败';
      setSegmentationError(errorMessage);
      console.error('Segmentation error:', err);
    } finally {
      setIsSegmenting(false);
    }
  }, [currentImage]);

  const renderImageSection = (mode: LayoutMode) => {
    const imageDisplay = (
      <div className="relative w-full">
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
          className={`absolute top-0 left-0 w-full h-auto object-contain max-h-[60vh] rounded-xl transition-opacity duration-200 ease-in-out pointer-events-none ${isComparing ? 'opacity-0' : 'opacity-100'}`}
        />
        {currentImageUrl && activeTab === 'retouch' && !isComparing && editMode === 'precision' && (
          <ObjectSelectCanvas
            imageRef={imgRef}
            imageUrl={currentImageUrl}
            objects={segmentObjects}
            selectedObjects={selectedObjects}
            onToggleObject={(object) => {
              setSelectedObjects(prev => {
                const exists = prev.some(item => item.id === object.id);
                if (exists) {
                  return prev.filter(item => item.id !== object.id);
                }
                return [...prev, object];
              });
            }}
            isActive={!isLoading && !isSegmenting}
          />
        )}
        {/* Old brush-based mask painter - commented out
        {currentImageUrl && (
          <MaskPainter
            ref={maskPainterRef}
            imageRef={imgRef}
            imageUrl={currentImageUrl}
            brushSize={brushSize}
            isActive={!isComparing && !isLoading && activeTab === 'retouch'}
            isVisible={activeTab === 'retouch' && !isComparing}
            onMaskChange={setMaskDataUrl}
          />
        )}
        */}
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
        {isLoading && <LoadingOverlay message="AI 正在施展魔法..." />}
        {isSegmenting && <LoadingOverlay message="正在分析图片物体..." />}

        {activeTab === 'crop' ? (
          <div className="w-full flex justify-center">
            <ReactCrop
              crop={crop}
              onChange={c => setCrop(c)}
              onComplete={c => setCompletedCrop(c)}
              aspect={aspect}
              className="max-h-[60vh]"
            >
              {cropImageElement}
            </ReactCrop>
          </div>
        ) : (
          imageDisplay
        )}
      </div>
    );
  };

  const renderTabButtons = () => {
    return (
      <div className="w-full bg-white border border-gray-200 rounded-lg p-1.5 flex items-center justify-center gap-1.5 shadow-sm">
      {(['retouch', 'crop'] as Tab[]).map(tab => {
          const isActive = activeTab === tab;
          const sizing = 'py-2 px-3 text-sm';
          const activeClasses = 'bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/20';
          const inactiveClasses = 'text-gray-600 hover:text-gray-900 hover:bg-gray-50';
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 capitalize font-semibold rounded-md transition-all duration-200 ${sizing} ${isActive ? activeClasses : inactiveClasses}`}
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
          <EditPanel
            editMode={editMode}
            onEditModeChange={setEditMode}
            prompt={prompt}
            onPromptChange={setPrompt}
            onGenerate={handleGenerate}
            onResegment={handleResegment}
            onClearSelection={() => setSelectedObjects([])}
            onRemoveSelected={(id) => setSelectedObjects(prev => prev.filter(obj => obj.id !== id))}
            isLoading={isLoading}
            isSegmenting={isSegmenting}
            selectedObjects={selectedObjects}
            segmentationError={segmentationError}
            objectCount={segmentObjects.length}
          />
        )}
        {activeTab === 'crop' && (
          <CropPanel
            onApplyCrop={handleApplyCrop}
            onSetAspect={setAspect}
            isLoading={isLoading}
            isCropping={!!completedCrop?.width && completedCrop.width > 0}
          />
        )}
        {/* 'filters' disabled
        {activeTab === 'filters' && (
          <FilterPanel onApplyFilter={handleApplyFilter} isLoading={isLoading} />
        )}
        */}
      </div>
    );
  };

  const renderControls = () => {
    const sizing = 'py-2 px-3 text-sm';
    const blueButtonClasses = 'w-full bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold rounded-md transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner';
    const grayButtonClasses = 'w-full bg-gradient-to-br from-gray-600 to-gray-500 text-white font-bold rounded-md transition-all duration-300 ease-in-out shadow-lg shadow-gray-500/20 hover:shadow-xl hover:shadow-gray-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner';
    const greenButtonClasses = 'w-full bg-gradient-to-br from-green-600 to-green-500 text-white font-bold rounded-md transition-all duration-300 ease-in-out shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner';
    
    return (
      <div className="flex flex-col gap-3 mt-4">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={handleUndo}
            disabled={!canUndo}
            className={`flex items-center justify-center text-center bg-gray-50 border border-gray-200 text-gray-700 font-semibold rounded-md transition-all duration-200 ease-in-out hover:bg-gray-100 hover:border-gray-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50 ${sizing}`}
            aria-label="Undo last action"
            title="Undo"
          >
            <UndoIcon className="w-4 h-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={!canRedo}
            className={`flex items-center justify-center text-center bg-gray-50 border border-gray-200 text-gray-700 font-semibold rounded-md transition-all duration-200 ease-in-out hover:bg-gray-100 hover:border-gray-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50 ${sizing}`}
            aria-label="Redo last action"
            title="Redo"
          >
            <RedoIcon className="w-4 h-4" />
          </button>

          {canUndo && (
            <button
              onMouseDown={() => setIsComparing(true)}
              onMouseUp={() => setIsComparing(false)}
              onMouseLeave={() => setIsComparing(false)}
              onTouchStart={() => setIsComparing(true)}
              onTouchEnd={() => setIsComparing(false)}
              className={`flex items-center justify-center text-center bg-gray-50 border border-gray-200 text-gray-700 font-semibold rounded-md transition-all duration-200 ease-in-out hover:bg-gray-100 hover:border-gray-300 active:scale-95 ${sizing}`}
              aria-label="Press and hold to see original image"
              title="Compare"
            >
              <EyeIcon className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={handleReset}
            disabled={!canUndo}
            className={`text-center bg-transparent border border-gray-200 text-gray-700 font-semibold rounded-md transition-all duration-200 ease-in-out hover:bg-gray-50 hover:border-gray-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-transparent ${sizing}`}
            title="Reset to original"
          >
            Reset
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-2">
          <button
            onClick={handleUploadNew}
            className={`${grayButtonClasses} ${sizing}`}
            title="Upload new image"
          >
            New
          </button>

          <button
            onClick={handleDownload}
            className={`${greenButtonClasses} ${sizing}`}
            title="Download edited image"
          >
            Download
          </button>
        </div>
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
        <div className="w-full max-w-4xl mx-auto flex flex-col gap-4 animate-fade-in">
          {layoutSelector}
          <div className="w-full">{imageSection}</div>
          {tabButtons}
          {panelSection}
          {controlsSection}
        </div>
      );
    }

    if (layout === 'rightDock') {
      return (
        <div className="w-full max-w-6xl mx-auto flex flex-col gap-3 animate-fade-in">
          {layoutSelector}
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="flex-1 flex flex-col gap-3 min-w-0">{imageSection}</div>
            <div className="w-full lg:w-72 flex flex-col gap-3 flex-shrink-0">
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
        <div className="w-full max-w-6xl mx-auto flex flex-col gap-3 animate-fade-in">
          {layoutSelector}
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="w-full lg:w-72 flex flex-col gap-3 flex-shrink-0">
              {tabButtons}
              {panelSection}
              {controlsSection}
            </div>
            <div className="flex-1 flex flex-col gap-3 min-w-0">{imageSection}</div>
          </div>
        </div>
      );
    }

    return (
      <div className="w-full max-w-6xl mx-auto flex flex-col gap-3 animate-fade-in">
        {layoutSelector}
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 flex flex-col gap-3 min-w-0">{imageSection}</div>
          <div className="w-full lg:w-64 flex flex-col gap-3 flex-shrink-0 lg:max-h-[70vh] lg:overflow-y-auto lg:pr-1">
            {tabButtons}
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
