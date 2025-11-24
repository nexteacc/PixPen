/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from 'react';

export type ReferenceImageItem = {
  id: string;
  previewUrl: string;
  name: string;
};

interface ReferenceGalleryProps {
  images: ReferenceImageItem[];
  activeImageId: string | null;
  onSelect: (id: string) => void;
  onUpload: (files: FileList | null) => void;
  onRemove: (id: string) => void;
  onClearAll: () => void;
  errorMessage?: string | null;
}

const ReferenceGallery: React.FC<ReferenceGalleryProps> = ({
  images,
  activeImageId,
  onSelect,
  onUpload,
  onRemove,
  onClearAll,
  errorMessage,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasImages = images.length > 0;

  const handleUploadClick = () => {
    inputRef.current?.click();
  };

  return (
    <section className="w-full bg-white border border-gray-200 rounded-xl shadow-sm p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Reference Images</h3>
          <p className="text-xs text-gray-500">Upload up to 4 images and pick one to guide replacements.</p>
        </div>
        {hasImages && (
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs font-semibold text-rose-600 hover:text-rose-700"
          >
            Clear all
          </button>
        )}
      </div>

      <div
        className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-center text-sm text-gray-600 cursor-pointer hover:border-blue-400 hover:text-blue-600 transition"
        onClick={handleUploadClick}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          onUpload(event.dataTransfer.files);
        }}
      >
        <p className="font-semibold">Click or drop to upload reference images</p>
        <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 10MB.</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            onUpload(event.target.files);
            event.target.value = '';
          }}
        />
      </div>
      {errorMessage && (
        <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-2">
          {errorMessage}
        </div>
      )}

      {hasImages ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {images.map(image => {
            const isActive = image.id === activeImageId;
            return (
              <div
                key={image.id}
                className={`relative rounded-lg overflow-hidden border-2 transition cursor-pointer ${
                  isActive ? 'border-blue-500 ring-2 ring-blue-200' : 'border-transparent hover:border-gray-200'
                }`}
                onClick={() => onSelect(image.id)}
              >
                <img
                  src={image.previewUrl}
                  alt={image.name}
                  className="w-full h-28 object-cover"
                />
                <div className="absolute top-1 right-1 flex gap-1">
                  {isActive && (
                    <span className="px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-semibold">
                      Active
                    </span>
                  )}
                  <button
                    type="button"
                    className="px-1 py-0.5 rounded-full bg-white/80 text-gray-700 text-[10px] font-semibold hover:bg-white"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemove(image.id);
                    }}
                  >
                    ✕
                  </button>
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[11px] px-2 py-1 truncate">
                  {image.name}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center text-sm text-gray-500 py-6 border border-gray-100 rounded-lg">
          No reference images yet. Upload one to guide replacements.
        </div>
      )}
    </section>
  );
};

export default ReferenceGallery;

