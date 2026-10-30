// src/components/common/EcoLoopLogo.tsx
import React from 'react';

export const EcoLoopLogo: React.FC<{ size?: number; className?: string }> = ({
  size = 38,
  className = 'w-9 h-9',
}) => (
  <img
    src="/ecoloop-logo.svg"
    alt="EcoLoop Logo"
    width={size}
    height={size}
    style={{ width: `${size}px`, height: `${size}px` }}
    className={`${className} rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.3)] select-none shrink-0`}
  />
);