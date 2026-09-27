import React from 'react';

interface AkseleraLogoProps {
  theme?: 'light' | 'dark';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const heights = {
  sm: 'h-6',
  md: 'h-8',
  lg: 'h-11',
};

// Rasio banner 1426x383 (versi hitam) & 1476x394 (versi putih).
// Dipakai hanya untuk mencegah layout shift sebelum gambar dimuat.
const NATIVE = { width: 1426, height: 383 };

export const AkseleraLogo: React.FC<AkseleraLogoProps> = ({
  theme = 'light',
  className = '',
  size = 'md',
}) => {
  const src = theme === 'dark' ? '/brand/logo-white.png' : '/brand/logo-black.png';

  return (
    <div className={`inline-flex items-center select-none ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Akselera.Tech"
        width={NATIVE.width}
        height={NATIVE.height}
        className={`${heights[size]} w-auto object-contain`}
        draggable={false}
      />
    </div>
  );
};
