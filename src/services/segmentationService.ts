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

/**
 * 从 API 响应中提取 box_2d 和 mask（复用 gemini-mask.html 的逻辑）
 */
function extractBoxAndMask(text: string): Array<{ box: number[], mask: string }> {
    const regex = /"box_2d"\s*:\s*\[\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\]\s*,\s*"mask"\s*:\s*"(data:image\/png;base64,[^"]+)"/g;
    const results: Array<{ box: number[], mask: string }> = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
        try {
            const snippet = text.substring(match.index, match.index + 200);
            const boxMatch = snippet.match(/"box_2d"\s*:\s*(\[\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\])/);
            if (boxMatch && boxMatch[1]) {
                const box = JSON.parse(boxMatch[1]);
                const mask = match[1];
                results.push({ box, mask });
            }
        } catch (e) {
            // Skip invalid entries
        }
    }
    return results;
}

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

/**
 * 自动分割图片，返回所有可选物体
 */
export async function segmentImage(imageFile: File): Promise<SegmentObject[]> {
    const ai = createClient();
    
    // 1. 压缩图片
    const compressed = await resizeAndCompressImage(imageFile);
    const imagePart = await fileToPart(compressed);
    
    // 2. 调用 Gemini API（使用 gemini-mask.html 验证过的 prompt）
    const prompt = `Give the segmentation masks for the objects. 
Output a JSON list of segmentation masks where each entry contains the 2D bounding box in "box_2d" and the mask in "mask".`;
    
    const textPart = { text: prompt };

    // 使用支持分割的模型（与 gemini-mask.html 一致）
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
            parts: [textPart, imagePart]
        }
    });
    
    // 3. 解析返回的 JSON
    const boxes = extractBoxAndMask(response.text);
    
    if (boxes.length === 0) {
        throw new Error('No objects detected in the image. The API response may be in an unexpected format.');
    }
    
    // 4. 转换为 SegmentObject 格式
    const objects: SegmentObject[] = boxes.map((item, index) => {
        const maskFile = dataURLtoFile(item.mask, `mask_${index}.png`);
        
        // 验证掩码文件
        if (!validateMaskFile(maskFile)) {
            throw new Error(`Invalid mask file generated for object ${index}`);
        }
        
        return {
            id: `obj_${index}`,
            box: item.box as [number, number, number, number],
            mask: item.mask,
            maskFile
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
        throw new Error('无法获取原图尺寸，无法对齐掩码。');
    }

    return Promise.all(objects.map(async (obj, index) => {
        const maskDataUrl = await fileToDataURL(obj.maskFile);
        const maskImg = await loadImage(maskDataUrl);

        if (!maskImg.naturalWidth || !maskImg.naturalHeight) {
            throw new Error(`无法读取掩码尺寸：${obj.id}`);
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            throw new Error('无法创建用于缩放掩码的画布上下文。');
        }

        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
            maskImg,
            0,
            0,
            maskImg.naturalWidth,
            maskImg.naturalHeight,
            0,
            0,
            targetWidth,
            targetHeight,
        );

        const scaledDataUrl = canvas.toDataURL('image/png');
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));

        if (!blob) {
            throw new Error('无法生成对齐后的掩码文件。');
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
