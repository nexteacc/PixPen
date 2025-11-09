/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI } from "@google/genai";
import type { SegmentObject } from "../types/segmentation";

const resolveApiKey = (): string => {
    const browserKey = (import.meta as any).env?.VITE_API_KEY;
    const nodeKey = typeof process !== 'undefined' ? process.env?.API_KEY : undefined;
    const apiKey = browserKey ?? nodeKey;

    if (!apiKey) {
        throw new Error('An API Key must be set when running in a browser. Define VITE_API_KEY in your environment configuration.');
    }

    return apiKey;
};

const createClient = () => new GoogleGenAI({ apiKey: resolveApiKey() });

/**
 * 压缩图片（复用 gemini-mask.html 的逻辑）
 */
async function resizeAndCompressImage(file: File): Promise<File> {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d')!;
                let width = img.width;
                let height = img.height;
                
                // 如果宽度超过 1000，按比例缩放
                if (width > 1000) {
                    height = Math.round((height * 1000) / width);
                    width = 1000;
                }
                
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob(function(blob) {
                    resolve(new File([blob!], 'compressed.jpg', { type: 'image/jpeg' }));
                }, 'image/jpeg', 0.7);
            };
            img.src = event.target.result as string;
        };
        reader.readAsDataURL(file);
    });
}

type RawSegment = {
    box_2d?: number[];
    mask?: string;
    label?: string;
};

const DEFAULT_MASK_THRESHOLD = 127;
const SEGMENTATION_PROMPT = `You are a precise segmentation assistant for both real and synthetic photos.
Return a JSON array where each entry contains:
- "box_2d": [y0, x0, y1, x1] using normalized coordinates between 0 and 1000 (top-left to bottom-right).
- "mask": base64 PNG probability map for that object.
- "label": a short descriptive English name (e.g., "wooden chair", "glass vase").

Only include visually distinct objects with valid bounding boxes. Omit duplicates or overlapping detections.`;

const stripMarkdownFence = (payload: string): string => {
    const trimmed = payload.trim();
    const jsonFenceIndex = trimmed.indexOf('```json');
    if (jsonFenceIndex !== -1) {
        const afterFence = trimmed.slice(jsonFenceIndex + 7);
        const closingFence = afterFence.indexOf('```');
        return (closingFence !== -1 ? afterFence.slice(0, closingFence) : afterFence).trim();
    }

    const genericFenceIndex = trimmed.indexOf('```');
    if (genericFenceIndex !== -1) {
        const afterFence = trimmed.slice(genericFenceIndex + 3);
        const closingFence = afterFence.indexOf('```');
        return (closingFence !== -1 ? afterFence.slice(0, closingFence) : afterFence).trim();
    }

    return trimmed;
};

const extractSegmentsWithRegex = (text: string): Array<{ box: number[]; mask: string; label?: string }> => {
    const regex = /"box_2d"\s*:\s*\[\s*(\d+(?:\s*,\s*\d+){3})\s*\]\s*,[^}]*?"mask"\s*:\s*"(data:image\/png;base64,[^"]+)"/g;
    const labelRegex = /"label"\s*:\s*"([^"]+)"/;
    const results: Array<{ box: number[]; mask: string; label?: string }> = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
        const boxValues = match[1]
            .split(',')
            .map(value => Number(value.trim()))
            .filter(Number.isFinite);

        if (boxValues.length !== 4) continue;

        const mask = match[2];
        const surroundingSnippet = text.slice(match.index, Math.min(text.length, match.index + 400));
        const labelMatch = surroundingSnippet.match(labelRegex);

        results.push({
            box: boxValues as [number, number, number, number],
            mask,
            label: labelMatch?.[1],
        });
    }

    return results;
};

const parseSegmentationResponse = (responseText: string): Array<{ box: number[]; mask: string; label?: string }> => {
    if (!responseText) {
        return [];
    }

    const trimmedPayload = stripMarkdownFence(responseText);

    try {
        const parsed = JSON.parse(trimmedPayload) as RawSegment[] | RawSegment;
        const entries = Array.isArray(parsed) ? parsed : [parsed];

        return entries
            .map(entry => ({
                box: entry.box_2d ?? [],
                mask: entry.mask ?? '',
                label: entry.label,
            }))
            .filter(item => item.box.length === 4 && item.mask);
    } catch {
        // Fall back to regex extraction when JSON parsing fails
        return extractSegmentsWithRegex(responseText);
    }
};

/**
 * 将 data URL 转换为 File 对象
 */
function dataURLtoFile(dataurl: string, filename: string): File {
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

/**
 * 将 File 转换为 Gemini API 需要的格式
 */
async function fileToPart(file: File): Promise<{ inlineData: { mimeType: string; data: string; } }> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
    
    const arr = dataUrl.split(',');
    if (arr.length < 2) throw new Error("Invalid data URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");
    
    const mimeType = mimeMatch[1];
    const data = arr[1];
    return { inlineData: { mimeType, data } };
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

/**
 * 验证掩码文件是否有效
 */
function validateMaskFile(maskFile: File): boolean {
    if (maskFile.size === 0) {
        return false;
    }
    if (!maskFile.type.includes('image')) {
        return false;
    }
    return true;
}

const isValidNormalizedBox = (box: number[]): box is [number, number, number, number] => {
    if (box.length !== 4) return false;
    const [ymin, xmin, ymax, xmax] = box;
    const values = [ymin, xmin, ymax, xmax];
    if (values.some(value => !Number.isFinite(value) || value < 0 || value > 1000)) {
        return false;
    }
    return ymin < ymax && xmin < xmax;
};

/**
 * 自动分割图片，返回所有可选物体
 */
export async function segmentImage(imageFile: File): Promise<SegmentObject[]> {
    const ai = createClient();
    
    // 1. 压缩图片
    const compressed = await resizeAndCompressImage(imageFile);
    const imagePart = await fileToPart(compressed);
    
    // 2. 调用 Gemini API（使用 gemini-mask.html 验证过的 prompt）
    const textPart = { text: SEGMENTATION_PROMPT };
    
    // 使用支持分割的模型（与 gemini-mask.html 一致）
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
            parts: [textPart, imagePart]
        },
        config: {
            thinkingConfig: {
                thinkingBudget: 0,
            },
        },
    });
    
    // 3. 解析返回的 JSON
    const segments = parseSegmentationResponse((response.text ?? '').toString())
        .filter(segment => isValidNormalizedBox(segment.box));
    
    if (segments.length === 0) {
        throw new Error('No objects detected in the image. The API response may be in an unexpected format.');
    }
    
    // 4. 转换为 SegmentObject 格式
    const objects: SegmentObject[] = segments.map((item, index) => {
        const maskDataUrl = item.mask.startsWith('data:image/png;base64,')
            ? item.mask
            : `data:image/png;base64,${item.mask}`;
        const maskFile = dataURLtoFile(maskDataUrl, `mask_${index}.png`);
        
        // 验证掩码文件
        if (!validateMaskFile(maskFile)) {
            throw new Error(`Invalid mask file generated for object ${index}`);
        }
        
        return {
            id: `obj_${index}`,
            box: item.box as [number, number, number, number],
            mask: maskDataUrl,
            maskFile,
            label: item.label,
        };
    });
    
    return objects;
}

/**
 * 将掩码拉伸到与原图相同的尺寸，保持坐标系一致。
 */
export async function alignMasksToOriginal(
    objects: SegmentObject[],
    originalImage: File,
): Promise<SegmentObject[]> {
    if (objects.length === 0) {
        return objects;
    }

    const originalDataUrl = await fileToDataURL(originalImage);
    const originalImg = await loadImage(originalDataUrl);
    const targetWidth = originalImg.naturalWidth || originalImg.width;
    const targetHeight = originalImg.naturalHeight || originalImg.height;

    if (!targetWidth || !targetHeight) {
        throw new Error('Unable to read the original image dimensions, so the masks cannot be aligned.');
    }

    return Promise.all(objects.map(async (obj, index) => {
        const maskDataUrl = await fileToDataURL(obj.maskFile);
        const maskImg = await loadImage(maskDataUrl);
        const [ymin, xmin, ymax, xmax] = obj.box;
        const x = Math.round((xmin / 1000) * targetWidth);
        const y = Math.round((ymin / 1000) * targetHeight);
        const width = Math.max(1, Math.round(((xmax - xmin) / 1000) * targetWidth));
        const height = Math.max(1, Math.round(((ymax - ymin) / 1000) * targetHeight));

        if (x >= targetWidth || y >= targetHeight || width <= 0 || height <= 0) {
            throw new Error(`Invalid mask bounding box: ${obj.id}`);
        }

        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = width;
        maskCanvas.height = height;
        const maskCtx = maskCanvas.getContext('2d');

        if (!maskCtx) {
            throw new Error('Unable to create a canvas context for mask processing.');
        }

        maskCtx.imageSmoothingEnabled = true;
        maskCtx.drawImage(maskImg, 0, 0, width, height);

        const imageData = maskCtx.getImageData(0, 0, width, height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const average = (r + g + b) / 3;
            const binary = average > DEFAULT_MASK_THRESHOLD ? 255 : 0;

            data[i] = binary;
            data[i + 1] = binary;
            data[i + 2] = binary;
            data[i + 3] = binary;
        }

        maskCtx.putImageData(imageData, 0, 0);

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            throw new Error('Unable to create a canvas context for scaling the mask.');
        }

        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, targetWidth, targetHeight);
        ctx.drawImage(maskCanvas, x, y);

        const scaledDataUrl = canvas.toDataURL('image/png');
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));

        if (!blob) {
            throw new Error('Unable to generate the aligned mask file.');
        }

        const scaledFileName = obj.maskFile.name || `mask_${index}.png`;
        const scaledFile = new File([blob], scaledFileName, { type: 'image/png' });

        return {
            ...obj,
            mask: scaledDataUrl,
            maskFile: scaledFile,
        };
    }));
}
