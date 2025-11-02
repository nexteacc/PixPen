/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import Spinner from '../../components/Spinner';

interface LoadingOverlayProps {
  message: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message }) => {
  return (
    <div className="absolute inset-0 bg-black/70 z-30 flex flex-col items-center justify-center gap-4 animate-fade-in">
      <Spinner />
      <p className="text-gray-300">{message}</p>
    </div>
  );
};

export default LoadingOverlay;
