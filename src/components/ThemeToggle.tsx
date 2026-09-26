import React from 'react';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  theme: 'light' | 'dark';
  onToggle: () => void;
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, onToggle, className = '' }) => {
  const isDark = theme === 'dark';

  return (
    <button
      onClick={onToggle}
      aria-label={isDark ? 'Ganti ke Light Mode' : 'Ganti ke Dark Mode'}
      title={isDark ? 'Ganti ke Light Mode' : 'Ganti ke Dark Mode'}
      className={`relative inline-flex items-center justify-between w-14 h-7 p-1 rounded-full transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 ${
        isDark
          ? 'bg-zinc-800 border border-zinc-700 focus:ring-zinc-400 focus:ring-offset-zinc-950'
          : 'bg-zinc-200 border border-zinc-300 focus:ring-black focus:ring-offset-white'
      } ${className}`}
    >
      {/* Track icons */}
      <span className="flex items-center justify-center w-5 h-5 text-zinc-400">
        <Sun className="w-3.5 h-3.5" />
      </span>
      <span className="flex items-center justify-center w-5 h-5 text-zinc-400">
        <Moon className="w-3.5 h-3.5" />
      </span>

      {/* Thumb slider */}
      <span
        className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full flex items-center justify-center shadow-md transition-transform duration-200 ${
          isDark
            ? 'translate-x-7 bg-white text-black'
            : 'translate-x-0 bg-black text-white'
        }`}
      >
        {isDark ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
      </span>
    </button>
  );
};
