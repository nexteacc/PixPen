/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useEffect, useState } from 'react';
import type { SegmentObject } from '../types/segmentation';

interface ObjectSelectCanvasProps {
  imageRef: React.RefObject<HTMLImageElement>;
  imageUrl: string;
  objects: SegmentObject[];
  selectedObjects: SegmentObject[];
  onToggleObject: (object: SegmentObject) => void;
  isActive: boolean;
}

const loadMaskImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

const getObjectDisplayNumber = (obj: SegmentObject): number => {
  const match = obj.id.match(/obj_(\d+)/);
  return match ? Number(match[1]) + 1 : 0;
};

const ObjectSelectCanvas: React.FC<ObjectSelectCanvasProps> = ({
  imageRef,
  imageUrl,
  objects,
  selectedObjects,
  onToggleObject,
  isActive
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [maskImages, setMaskImages] = useState<Record<string, HTMLImageElement>>({});

  useEffect(() => {
    let isMounted = true;
    if (objects.length === 0) {
      setMaskImages({});
      return;
    }

    const abortController = new AbortController();
    const loadAllMasks = async () => {
      const entries = await Promise.all(
        objects.map(async obj => {
          try {
            const img = await loadMaskImage(obj.mask);
            return [obj.id, img] as const;
          } catch (error) {
            console.warn(`Failed to load mask for ${obj.id}`, error);
            return null;
          }
        })
      );

      if (!isMounted || abortController.signal.aborted) return;

      const map: Record<string, HTMLImageElement> = {};
      entries.forEach(entry => {
        if (entry) {
          const [id, img] = entry;
          map[id] = img;
        }
      });
      setMaskImages(map);
    };

    loadAllMasks();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [objects]);

  // 绘制物体高亮
  useEffect(() => {
    if (!canvasRef.current || !imageRef.current || !imageRef.current.complete) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const img = imageRef.current;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    
    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 如果不活跃，不绘制高亮
    if (!isActive) return;
    
    // 绘制所有物体的高亮
    objects.forEach(obj => {
      const isSelected = selectedObjects.some(item => item.id === obj.id);
      const isHovered = obj.id === hoveredId;
      const maskImage = maskImages[obj.id];
      
      if ((isSelected || isHovered) && maskImage) {
        drawObjectHighlight(ctx, obj, img, maskImage, isSelected, isHovered);
      } else if (isSelected || isHovered) {
        drawObjectHighlight(ctx, obj, img, undefined, isSelected, isHovered);
      }
    });

    drawObjectBadges(ctx, img, objects, hoveredId, selectedObjects);
  }, [objects, selectedObjects, hoveredId, imageUrl, isActive, imageRef, maskImages]);

  // 检测点击了哪个物体
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isActive) return;
    
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    // 检测点击位置是否在某个物体的 box 内
    const candidateObjects = objects
      .filter(obj => {
        const [ymin, xmin, ymax, xmax] = obj.box;
        const w = canvas.width;
        const h = canvas.height;

        const boxX = (xmin / 1000) * w;
        const boxY = (ymin / 1000) * h;
        const boxW = ((xmax - xmin) / 1000) * w;
        const boxH = ((ymax - ymin) / 1000) * h;

        return x >= boxX && x <= boxX + boxW && 
               y >= boxY && y <= boxY + boxH;
      })
      .sort((a, b) => calculateBoxArea(a) - calculateBoxArea(b));

    const clickedObject = candidateObjects[0];
    
    if (clickedObject) {
      onToggleObject(clickedObject);
    }
  };

  // 检测鼠标悬停
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isActive) return;
    
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    const hoveredObject = objects
      .filter(obj => {
        const [ymin, xmin, ymax, xmax] = obj.box;
        const w = canvas.width;
        const h = canvas.height;

        const boxX = (xmin / 1000) * w;
        const boxY = (ymin / 1000) * h;
        const boxW = ((xmax - xmin) / 1000) * w;
        const boxH = ((ymax - ymin) / 1000) * h;

        return x >= boxX && x <= boxX + boxW && 
               y >= boxY && y <= boxY + boxH;
      })
      .sort((a, b) => calculateBoxArea(a) - calculateBoxArea(b));

    setHoveredId(hoveredObject[0]?.id || null);
  };

  const handleMouseLeave = () => {
    setHoveredId(null);
  };

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="absolute top-0 left-0 w-full h-auto object-contain max-h-[60vh] rounded-xl cursor-pointer"
      style={{ pointerEvents: isActive ? 'auto' : 'none' }}
    />
  );
};

// 绘制物体高亮（选中或悬停状态）
function drawObjectHighlight(
  ctx: CanvasRenderingContext2D,
  obj: SegmentObject,
  img: HTMLImageElement,
  maskImage: HTMLImageElement | undefined,
  isSelected: boolean,
  isHovered: boolean
) {
  const [ymin, xmin, ymax, xmax] = obj.box;
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  
  const x = (xmin / 1000) * w;
  const y = (ymin / 1000) * h;
  const width = ((xmax - xmin) / 1000) * w;
  const height = ((ymax - ymin) / 1000) * h;
  
  if (maskImage) {
    paintMaskOverlay(ctx, maskImage, isSelected ? 'rgba(59, 130, 246, 0.35)' : 'rgba(59, 130, 246, 0.2)');
  } else {
    ctx.fillStyle = isSelected ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.15)';
    ctx.fillRect(x, y, width, height);
  }

  if (isSelected) {
    // 选中状态：蓝色高亮 + 实线边框
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, width, height);
  } else if (isHovered) {
    // 悬停状态：淡蓝色高亮 + 虚线边框
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(x, y, width, height);
    ctx.setLineDash([]);
  }
}

function paintMaskOverlay(
  ctx: CanvasRenderingContext2D,
  maskImage: HTMLImageElement,
  fillColor: string
) {
  const { width, height } = ctx.canvas;
  ctx.save();
  ctx.fillStyle = fillColor;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(maskImage, 0, 0, width, height);
  ctx.restore();
}

export default ObjectSelectCanvas;

function calculateBoxArea(obj: SegmentObject): number {
  const [ymin, xmin, ymax, xmax] = obj.box;
  return Math.max((ymax - ymin) * (xmax - xmin), 0);
}

function drawObjectBadges(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  objects: SegmentObject[],
  hoveredId: string | null,
  selectedObjects: SegmentObject[]
) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const selectedIds = new Set(selectedObjects.map(obj => obj.id));

  objects.forEach(obj => {
    const number = getObjectDisplayNumber(obj);
    if (!number) return;

    const [ymin, xmin, ymax, xmax] = obj.box;
    const x = (xmin / 1000) * w;
    const y = (ymin / 1000) * h;
    const width = ((xmax - xmin) / 1000) * w;
    const height = ((ymax - ymin) / 1000) * h;

    const radius = 12;
    let badgeX = x + width / 2;
    let badgeY = y + height / 2;

    badgeX = Math.min(Math.max(badgeX, radius + 4), w - radius - 4);
    badgeY = Math.min(Math.max(badgeY, radius + 4), h - radius - 4);

    const isSelected = selectedIds.has(obj.id);
    const isHovered = obj.id === hoveredId;

    drawBadge(ctx, badgeX, badgeY, radius, number, isSelected, isHovered);
  });
}

function drawBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  number: number,
  isSelected: boolean,
  isHovered: boolean
) {
  const fillColor = isSelected
    ? '#2563eb'
    : isHovered
      ? 'rgba(59, 130, 246, 0.9)'
      : 'rgba(15, 23, 42, 0.65)';
  const strokeColor = isSelected ? '#1d4ed8' : 'rgba(255, 255, 255, 0.9)';

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = strokeColor;
  ctx.stroke();

  ctx.fillStyle = '#fff';
  ctx.font = '600 12px "Inter","PingFang SC",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(number), x, y + 0.5);
  ctx.restore();
}
