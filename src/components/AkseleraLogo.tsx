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

export const AkseleraLogo: React.FC<AkseleraLogoProps> = ({
  theme = 'light',
  className = '',
  size = 'md',
}) => {
  const src = theme === 'dark' ? '/brand/logo-white.svg' : '/brand/logo-black.svg';

  return (
    <div className={`inline-flex items-center select-none ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Akselera.Tech"
        width={240}
        height={64}
        className={`${heights[size]} w-auto max-w-[220px] object-contain`}
        draggable={false}
      />
    </div>
  );
};
