/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useEffect, useState, useCallback } from 'react';
import Spinner from './Spinner';

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onCancel: () => void;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const startCamera = async () => {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" }
          });
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
              setIsLoading(false);
            };
          }
        } else {
          throw new Error('Camera not supported by this browser.');
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        let message = 'Could not access the camera.';
        if (err instanceof Error) {
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            message = 'Camera permission denied. Please enable it in your browser settings.';
          } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            message = 'No camera found on this device.';
          }
        }
        setError(message);
        setIsLoading(false);
      }
    };

    startCamera();

    return () => {
      // Cleanup: stop camera stream when component unmounts
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleCapture = useCallback(() => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');

    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        if (blob) {
          const file = new File([blob], `capture-${Date.now()}.png`, { type: 'image/png' });
          onCapture(file);
        }
      }, 'image/png');
    }
  }, [onCapture]);

  if (error) {
    return (
      <div className="text-center animate-fade-in bg-red-50 border border-red-200 p-8 rounded-lg max-w-2xl mx-auto flex flex-col items-center gap-4">
        <h2 className="text-2xl font-bold text-red-700">Camera Error</h2>
        <p className="text-md text-red-600">{error}</p>
        <button
          onClick={onCancel}
          className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded-lg text-md transition-colors mt-4"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center gap-6 animate-fade-in">
      <div className="relative w-full shadow-2xl rounded-xl overflow-hidden bg-black/20 aspect-video">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
        />
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <Spinner />
            <p className="text-gray-600">Starting camera...</p>
          </div>
        )}
      </div>
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={onCancel}
          className="bg-gray-50 border border-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-lg transition-all hover:bg-gray-100"
        >
          Cancel
        </button>
        <button
          onClick={handleCapture}
          disabled={isLoading}
          className="w-20 h-20 bg-white rounded-full border-4 border-gray-800/50 flex items-center justify-center transition-all duration-200 ease-in-out hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Capture photo"
        >
          <div className="w-16 h-16 bg-white rounded-full ring-2 ring-inset ring-gray-800/50"></div>
        </button>
      </div>
    </div>
  );
};

export default CameraCapture;
