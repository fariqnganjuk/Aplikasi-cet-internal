import React from 'react';

interface AkseleraLogoProps {
  theme?: 'light' | 'dark';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const AkseleraLogo: React.FC<AkseleraLogoProps> = ({
  theme = 'light',
  className = '',
  size = 'md',
}) => {
  const isDark = theme === 'dark';
  const color = isDark ? '#FFFFFF' : '#000000';

  const heights = {
    sm: 'h-6',
    md: 'h-8',
    lg: 'h-11',
  };

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <svg
        viewBox="0 0 420 160"
        className={`${heights[size]} w-auto aspect-[420/160]`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Stylized 'A' Icon with Sprout Cutout */}
        <g>
          {/* Main A body silhouette with cutout */}
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M5 145 C 28 132, 58 100, 80 50 C 95 18, 108 5, 128 5 L 140 5 C 148 5, 152 9, 152 17 L 152 135 C 152 142, 147 145, 140 145 L 98 145 C 92 145, 88 135, 88 128 C 88 116, 92 104, 98 94 C 98 94, 94 92, 90 95 C 75 106, 60 125, 45 137 C 32 147, 18 148, 5 145 Z
               M 98 88 C 96 70, 91 58, 88 50 C 95 62, 102 70, 108 76 C 114 82, 126 84, 134 82 C 122 88, 110 88, 102 96 C 100 98, 98 96, 98 88 Z"
            fill={color}
          />
          {/* Sprout detail in negative space */}
          <path
            d="M 98 92 C 90 70, 85 52, 90 44 C 96 52, 98 68, 98 92 Z"
            fill={isDark ? '#000000' : '#FFFFFF'}
          />
          <path
            d="M 100 88 C 112 80, 128 78, 134 82 C 128 88, 112 92, 100 88 Z"
            fill={isDark ? '#000000' : '#FFFFFF'}
          />
          {/* Accent icon overlay for high-definition render */}
        </g>

        {/* Text Part: KSELERA TECH */}
        <g fill={color}>
          <text
            x="162"
            y="78"
            fontFamily="'Nunito', -apple-system, BlinkMacSystemFont, sans-serif"
            fontWeight="900"
            fontSize="74"
            letterSpacing="-1px"
          >
            KSELERA
          </text>
          <text
            x="164"
            y="142"
            fontFamily="'Nunito', -apple-system, BlinkMacSystemFont, sans-serif"
            fontWeight="400"
            fontSize="64"
            letterSpacing="2px"
          >
            TECH
          </text>
        </g>
      </svg>
    </div>
  );
};
