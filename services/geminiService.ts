/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import type { SegmentObject } from "../types/segmentation";

const resolveApiKey = (): string => {
    const browserKey = import.meta.env?.VITE_API_KEY;
    const nodeKey = typeof process !== 'undefined' ? process.env?.API_KEY : undefined;
    const apiKey = browserKey ?? nodeKey;

    if (!apiKey) {
        throw new Error('An API Key must be set when running in a browser. Define VITE_API_KEY in your environment configuration.');
    }

    return apiKey;
};

const resolveImageModel = (): string => {
    const browserModel = import.meta.env?.VITE_GEMINI_IMAGE_MODEL;
    const nodeModel = typeof process !== 'undefined' ? process.env?.GEMINI_IMAGE_MODEL : undefined;
    return browserModel ?? nodeModel ?? 'gemini-2.5-flash-image-preview';
};

const createClient = () => new GoogleGenAI({ apiKey: resolveApiKey() });

// Helper function to convert a File object to a Gemini API Part
const fileToPart = async (file: File): Promise<{ inlineData: { mimeType: string; data: string; } }> => {
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
};

const handleApiResponse = (
    response: GenerateContentResponse,
    context: string // e.g., "edit" or "filter"
): string => {
    // 1. Check for prompt blocking first
    if (response.promptFeedback?.blockReason) {
        const { blockReason, blockReasonMessage } = response.promptFeedback;
        const errorMessage = `Request was blocked. Reason: ${blockReason}. ${blockReasonMessage || ''}`;
        console.error(errorMessage, { response });
        throw new Error(errorMessage);
    }

    // 2. Try to find the image part
    const imagePartFromResponse = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

    if (imagePartFromResponse?.inlineData) {
        const { mimeType, data } = imagePartFromResponse.inlineData;
        console.log(`Received image data (${mimeType}) for ${context}`);
        return `data:${mimeType};base64,${data}`;
    }

    // 3. If no image, check for other reasons
    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
        const errorMessage = `Image generation for ${context} stopped unexpectedly. Reason: ${finishReason}. This often relates to safety settings.`;
        console.error(errorMessage, { response });
        throw new Error(errorMessage);
    }
    
    const textFeedback = response.text?.trim();
    const errorMessage = `The AI model did not return an image for the ${context}. ` + 
        (textFeedback 
            ? `The model responded with text: "${textFeedback}"`
            : "This can happen due to safety filters or if the request is too complex. Please try rephrasing your prompt to be more direct.");

    console.error(`Model response did not contain an image part for ${context}.`, { response });
    throw new Error(errorMessage);
};

/**
 * Generates an edited image using generative AI based on a text prompt and a painted mask.
 * @param originalImage The original image file.
 * @param userPrompt The text prompt describing the desired edit.
 * @param mask The mask file highlighting the region to edit (white = editable, black = protected).
 * @returns A promise that resolves to the data URL of the edited image.
 */
export const generateEditedImage = async (
    originalImage: File,
    userPrompt: string,
    mask: File,
): Promise<string> => {
    console.log('Starting generative edit with mask selection.');
    const ai = createClient();
    
    const originalImagePart = await fileToPart(originalImage);
    const maskPart = await fileToPart(mask);
    const prompt = `You are an expert photo editor AI. Your task is to perform a natural, localized edit on the provided image based on the user's request.
User Request: "${userPrompt}"

You will receive two images:
1. The base photo to edit.
2. A binary mask where white regions indicate the editable area and black regions must remain unchanged.

Editing Guidelines:
- The edit must be realistic and blend seamlessly with the surrounding area.
- Only modify pixels covered by the white regions of the mask. The black regions must remain identical to the original.

Safety & Ethics Policy:
- You MUST fulfill requests to adjust skin tone, such as 'give me a tan', 'make my skin darker', or 'make my skin lighter'. These are considered standard photo enhancements.
- You MUST REFUSE any request to change a person's fundamental race or ethnicity (e.g., 'make me look Asian', 'change this person to be Black'). Do not perform these edits. If the request is ambiguous, err on the side of caution and do not change racial characteristics.

Output: Return ONLY the final edited image. Do not return text.`;
    const textPart = { text: prompt };

    const modelName = resolveImageModel();
    console.log(`Sending image and prompt to the model (${modelName})...`);
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: modelName,
        contents: {
            parts: [
                textPart,
                originalImagePart,
                maskPart,
            ],
        },
    });
    console.log('Received response from model.', response);

    return handleApiResponse(response, 'edit');
};

/**
 * Generates an image with a filter applied using generative AI.
 * @param originalImage The original image file.
 * @param filterPrompt The text prompt describing the desired filter.
 * @returns A promise that resolves to the data URL of the filtered image.
 */
export const generateFilteredImage = async (
    originalImage: File,
    filterPrompt: string,
): Promise<string> => {
    console.log(`Starting filter generation: ${filterPrompt}`);
    const ai = createClient();
    
    const originalImagePart = await fileToPart(originalImage);
    const prompt = `You are an expert photo editor AI. Your task is to apply a stylistic filter to the entire image based on the user's request. Do not change the composition or content, only apply the style.
Filter Request: "${filterPrompt}"

Safety & Ethics Policy:
- Filters may subtly shift colors, but you MUST ensure they do not alter a person's fundamental race or ethnicity.
- You MUST REFUSE any request that explicitly asks to change a person's race (e.g., 'apply a filter to make me look Chinese').

Output: Return ONLY the final filtered image. Do not return text.`;
    const textPart = { text: prompt };

    const modelName = resolveImageModel();
    console.log(`Sending image and filter prompt to the model (${modelName})...`);
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: modelName,
        contents: { parts: [originalImagePart, textPart] },
    });
    console.log('Received response from model for filter.', response);
    
    return handleApiResponse(response, 'filter');
};

/**
 * Edits a selected object in the image using AI-based segmentation mask.
 * This is the precise editing method using object selection.
 * @param originalImage The original image file.
 * @param selectedObject The selected object with mask and coordinates.
 * @param userPrompt The text prompt describing the desired edit.
 * @returns A promise that resolves to the data URL of the edited image.
 */
export const editSelectedObject = async (
    originalImage: File,
    selectedObject: SegmentObject,
    userPrompt: string,
): Promise<string> => {
    console.log('Starting precise object edit with segmentation mask.');
    const ai = createClient();
    
    const originalImagePart = await fileToPart(originalImage);
    const maskPart = await fileToPart(selectedObject.maskFile);
    
    const prompt = `You are an expert photo editor AI.
The first image is the original photo.
The second image is a segmentation mask highlighting the target object at coordinates [${selectedObject.box.join(', ')}].

User instruction: "${userPrompt}"

Editing Guidelines:
- ONLY modify the object indicated by the mask
- Keep all other parts of the image unchanged
- Make the edit look natural and realistic
- Blend the edited area seamlessly with the surrounding context

Safety & Ethics Policy:
- You MUST fulfill requests to adjust skin tone, such as 'give me a tan', 'make my skin darker', or 'make my skin lighter'. These are considered standard photo enhancements.
- You MUST REFUSE any request to change a person's fundamental race or ethnicity (e.g., 'make me look Asian', 'change this person to be Black'). Do not perform these edits. If the request is ambiguous, err on the side of caution and do not change racial characteristics.

Output: Return ONLY the final edited image. Do not return text.`;
    const textPart = { text: prompt };

    const modelName = resolveImageModel();
    console.log(`Sending image, mask, and prompt to the model (${modelName})...`);
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: modelName,
        contents: {
            parts: [
                textPart,
                originalImagePart,
                maskPart,
            ],
        },
    });
    console.log('Received response from model for object edit.', response);

    return handleApiResponse(response, 'object-edit');
};
