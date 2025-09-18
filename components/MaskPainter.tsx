/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';

export interface MaskPainterHandle {
  clear: () => void;
}

interface Point {
  x: number;
  y: number;
}

interface MaskPainterProps {
  imageRef: React.RefObject<HTMLImageElement>;
  imageUrl: string | null;
  brushSize: number;
  isActive: boolean;
  isVisible: boolean;
  onMaskChange: (maskDataUrl: string | null) => void;
}

const MaskPainter = forwardRef<MaskPainterHandle, MaskPainterProps>(({
  imageRef,
  imageUrl,
  brushSize,
  isActive,
  isVisible,
  onMaskChange,
}, ref) => {
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const hasPaintRef = useRef(false);

  const redrawOverlay = useCallback(() => {
    const displayCanvas = displayCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!displayCanvas) return;
    const ctx = displayCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);

    if (!maskCanvas || !hasPaintRef.current) return;

    ctx.save();
    ctx.drawImage(maskCanvas, 0, 0, displayCanvas.width, displayCanvas.height);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = 'rgba(59, 130, 246, 0.4)';
    ctx.fillRect(0, 0, displayCanvas.width, displayCanvas.height);
    ctx.restore();
  }, []);

  const clearMask = useCallback(() => {
    const displayCanvas = displayCanvasRef.current;
    if (displayCanvas) {
      const ctx = displayCanvas.getContext('2d');
      ctx?.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
    }

    const maskCanvas = maskCanvasRef.current;
    const maskCtx = maskCtxRef.current;
    if (maskCanvas && maskCtx) {
      maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    }

    hasPaintRef.current = false;
    lastPointRef.current = null;
    onMaskChange(null);
  }, [onMaskChange]);

  useImperativeHandle(ref, () => ({ clear: clearMask }), [clearMask]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') {
      return;
    }
    const imageEl = imageRef.current;
    const displayCanvas = displayCanvasRef.current;
    if (!imageEl || !displayCanvas) return;

    const updateDisplaySize = () => {
      const rect = imageEl.getBoundingClientRect();
      displayCanvas.width = rect.width;
      displayCanvas.height = rect.height;
      redrawOverlay();
    };

    updateDisplaySize();

    const resizeObserver = new ResizeObserver(updateDisplaySize);
    resizeObserver.observe(imageEl);

    return () => resizeObserver.disconnect();
  }, [imageRef, redrawOverlay]);

  useEffect(() => {
    const imageEl = imageRef.current;
    if (!imageEl || !imageUrl) return;

    const initializeMaskCanvas = () => {
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = imageEl.naturalWidth;
      maskCanvas.height = imageEl.naturalHeight;
      const maskCtx = maskCanvas.getContext('2d');
      if (!maskCtx) return;
      maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      maskCanvasRef.current = maskCanvas;
      maskCtxRef.current = maskCtx;
      hasPaintRef.current = false;
      redrawOverlay();
      onMaskChange(null);
    };

    if (imageEl.naturalWidth && imageEl.naturalHeight) {
      initializeMaskCanvas();
    } else {
      const handleLoad = () => {
        initializeMaskCanvas();
      };
      imageEl.addEventListener('load', handleLoad, { once: true });
      return () => imageEl.removeEventListener('load', handleLoad);
    }
  }, [imageRef, imageUrl, onMaskChange, redrawOverlay]);

  const commitMask = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas || !hasPaintRef.current) {
      onMaskChange(null);
      return;
    }
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = maskCanvas.width;
    exportCanvas.height = maskCanvas.height;
    const exportCtx = exportCanvas.getContext('2d');
    if (!exportCtx) {
      onMaskChange(null);
      return;
    }
    exportCtx.fillStyle = '#000000';
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    exportCtx.drawImage(maskCanvas, 0, 0);
    onMaskChange(exportCanvas.toDataURL('image/png'));
  }, [onMaskChange]);

  const getPointerPosition = useCallback((event: React.PointerEvent<HTMLCanvasElement>): Point | null => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }, []);

  const drawStroke = useCallback((from: Point, to: Point) => {
    const maskCanvas = maskCanvasRef.current;
    const maskCtx = maskCtxRef.current;
    const displayCanvas = displayCanvasRef.current;
    if (!maskCanvas || !maskCtx || !displayCanvas) return;

    const scaleX = maskCanvas.width / displayCanvas.width;
    const scaleY = maskCanvas.height / displayCanvas.height;

    maskCtx.save();
    maskCtx.scale(scaleX, scaleY);
    maskCtx.lineCap = 'round';
    maskCtx.lineJoin = 'round';
    maskCtx.strokeStyle = '#ffffff';
    maskCtx.lineWidth = brushSize;
    maskCtx.beginPath();
    maskCtx.moveTo(from.x, from.y);
    maskCtx.lineTo(to.x, to.y);
    maskCtx.stroke();
    maskCtx.restore();

    hasPaintRef.current = true;
    redrawOverlay();
  }, [brushSize, redrawOverlay]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isActive) return;
    event.preventDefault();
    const point = getPointerPosition(event);
    if (!point) return;
    isDrawingRef.current = true;
    lastPointRef.current = point;
    drawStroke(point, point);
  }, [drawStroke, getPointerPosition, isActive]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isActive || !isDrawingRef.current) return;
    event.preventDefault();
    const point = getPointerPosition(event);
    if (!point || !lastPointRef.current) return;
    drawStroke(lastPointRef.current, point);
    lastPointRef.current = point;
  }, [drawStroke, getPointerPosition, isActive]);

  const handlePointerUp = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    lastPointRef.current = null;
    commitMask();
  }, [commitMask]);

  return (
    <canvas
      ref={displayCanvasRef}
      className={`absolute top-0 left-0 w-full h-full select-none ${
        isActive ? 'cursor-crosshair' : 'pointer-events-none'
      }`}
      style={{ opacity: isVisible ? 1 : 0, transition: 'opacity 150ms ease-in-out', touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    />
  );
});

MaskPainter.displayName = 'MaskPainter';

export default MaskPainter;
