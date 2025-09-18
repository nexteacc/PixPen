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
  const outlineCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const hasPaintRef = useRef(false);
  const cursorPointRef = useRef<Point | null>(null);
  const outlinePhaseRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);

  const redrawOverlay = useCallback(() => {
    const displayCanvas = displayCanvasRef.current;
    if (!displayCanvas) return;
    const ctx = displayCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);

    const maskCanvas = maskCanvasRef.current;
    if (maskCanvas && hasPaintRef.current) {
      ctx.save();
      ctx.drawImage(maskCanvas, 0, 0, displayCanvas.width, displayCanvas.height);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = 'rgba(59, 130, 246, 0.35)';
      ctx.fillRect(0, 0, displayCanvas.width, displayCanvas.height);
      ctx.restore();

      const outlineCanvas = outlineCanvasRef.current;
      if (outlineCanvas) {
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(outlineCanvas, 0, 0, displayCanvas.width, displayCanvas.height);
        ctx.restore();
      }
    }

    if (cursorPointRef.current && isActive) {
      const { x, y } = cursorPointRef.current;
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = outlinePhaseRef.current;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.96)';
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }, [brushSize, isActive]);

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

    maskCanvasRef.current = maskCanvas ?? null;
    hasPaintRef.current = false;
    lastPointRef.current = null;
    cursorPointRef.current = null;
    outlineCanvasRef.current = null;
    onMaskChange(null);
    redrawOverlay();
  }, [onMaskChange, redrawOverlay]);

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
      outlineCanvasRef.current = null;
      hasPaintRef.current = false;
      cursorPointRef.current = null;
      outlinePhaseRef.current = 0;
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      redrawOverlay();
      onMaskChange(null);
    };

    if (imageEl.naturalWidth && imageEl.naturalHeight) {
      initializeMaskCanvas();
    } else {
      const handleLoad = () => initializeMaskCanvas();
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

  const updateOutline = useCallback((phase = outlinePhaseRef.current) => {
    const maskCanvas = maskCanvasRef.current;
    const maskCtx = maskCtxRef.current;
    if (!maskCanvas || !maskCtx || !hasPaintRef.current) {
      outlineCanvasRef.current = null;
      return;
    }

    const width = maskCanvas.width;
    const height = maskCanvas.height;
    const sourceData = maskCtx.getImageData(0, 0, width, height);
    let outlineCanvas = outlineCanvasRef.current;
    if (!outlineCanvas) {
      outlineCanvas = document.createElement('canvas');
      outlineCanvasRef.current = outlineCanvas;
    }
    outlineCanvas.width = width;
    outlineCanvas.height = height;
    const outlineCtx = outlineCanvas.getContext('2d');
    if (!outlineCtx) return;
    const outlineData = outlineCtx.createImageData(width, height);

    const src = sourceData.data;
    const dst = outlineData.data;
    const stride = width * 4;
    const neighborOffsets = [-4, 4, -stride, stride];
    const pattern = 16;
    const duty = 8;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const alpha = src[idx + 3];
        if (alpha === 0) continue;

        let isEdge = false;
        for (const offset of neighborOffsets) {
          const neighborIndex = idx + offset;
          if (neighborIndex < 0 || neighborIndex >= src.length) {
            isEdge = true;
            break;
          }
          if (src[neighborIndex + 3] === 0) {
            isEdge = true;
            break;
          }
        }

        if (isEdge) {
          const phasePosition = (x + y + phase) % pattern;
          if (phasePosition < duty) {
            dst[idx] = 255;
            dst[idx + 1] = 255;
            dst[idx + 2] = 255;
            dst[idx + 3] = 240;
          }
        }
      }
    }

    outlineCtx.putImageData(outlineData, 0, 0);
  }, []);

  const ensureOutlineAnimation = useCallback(() => {
    if (animationFrameRef.current !== null) return;

    const animate = () => {
      if (!hasPaintRef.current) {
        if (animationFrameRef.current !== null) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        return;
      }
      outlinePhaseRef.current = (outlinePhaseRef.current + 1) % 16;
      updateOutline(outlinePhaseRef.current);
      redrawOverlay();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [redrawOverlay, updateOutline]);

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
    updateOutline();
    ensureOutlineAnimation();
    redrawOverlay();
  }, [brushSize, ensureOutlineAnimation, redrawOverlay, updateOutline]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isActive) return;
    event.preventDefault();
    const point = getPointerPosition(event);
    if (!point) return;
    isDrawingRef.current = true;
    lastPointRef.current = point;
    cursorPointRef.current = point;
    drawStroke(point, point);
  }, [drawStroke, getPointerPosition, isActive]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isActive) return;
    event.preventDefault();
    const point = getPointerPosition(event);
    if (!point) return;
    cursorPointRef.current = point;
    if (isDrawingRef.current && lastPointRef.current) {
      drawStroke(lastPointRef.current, point);
      lastPointRef.current = point;
    } else {
      redrawOverlay();
    }
  }, [drawStroke, getPointerPosition, isActive, redrawOverlay]);

  const handlePointerUp = useCallback(() => {
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      lastPointRef.current = null;
      updateOutline();
      commitMask();
    }
  }, [commitMask, updateOutline]);

  const handlePointerLeave = useCallback(() => {
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      lastPointRef.current = null;
      updateOutline();
      commitMask();
    }
    cursorPointRef.current = null;
    redrawOverlay();
  }, [commitMask, redrawOverlay, updateOutline]);

  useEffect(() => {
    redrawOverlay();
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [brushSize, redrawOverlay]);

  return (
    <canvas
      ref={displayCanvasRef}
      className={`absolute top-0 left-0 w-full h-full select-none ${
        isActive ? 'cursor-none' : 'pointer-events-none'
      }`}
      style={{ opacity: isVisible ? 1 : 0, transition: 'opacity 150ms ease-in-out', touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
    />
  );
});

MaskPainter.displayName = 'MaskPainter';

export default MaskPainter;
