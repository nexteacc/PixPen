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
      
      if (isSelected || isHovered) {
        drawObjectHighlight(ctx, obj, img, isSelected, isHovered);
      } else {
        // 未选中状态：淡淡的边框提示
        drawObjectBorder(ctx, obj, img);
      }
    });
  }, [objects, selectedObjects, hoveredId, imageUrl, isActive, imageRef]);

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
  
  if (isSelected) {
    // 选中状态：蓝色高亮 + 实线边框
    ctx.fillStyle = 'rgba(59, 130, 246, 0.25)';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, width, height);
  } else if (isHovered) {
    // 悬停状态：淡蓝色高亮 + 虚线边框
    ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(x, y, width, height);
    ctx.setLineDash([]);
  }
}

// 绘制物体边框（未选中状态）
function drawObjectBorder(
  ctx: CanvasRenderingContext2D,
  obj: SegmentObject,
  img: HTMLImageElement
) {
  const [ymin, xmin, ymax, xmax] = obj.box;
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  
  const x = (xmin / 1000) * w;
  const y = (ymin / 1000) * h;
  const width = ((xmax - xmin) / 1000) * w;
  const height = ((ymax - ymin) / 1000) * h;
  
  // 淡淡的白色边框提示
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.strokeRect(x, y, width, height);
  ctx.setLineDash([]);
}

export default ObjectSelectCanvas;

function calculateBoxArea(obj: SegmentObject): number {
  const [ymin, xmin, ymax, xmax] = obj.box;
  return Math.max((ymax - ymin) * (xmax - xmin), 0);
}
