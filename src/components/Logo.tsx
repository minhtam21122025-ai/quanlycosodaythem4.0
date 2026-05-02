import React from 'react';

const Logo = ({ className, src }: { className?: string, src?: string }) => {
  if (src) {
    return <img src={src} alt="Logo" className={className} referrerPolicy="no-referrer" />;
  }

  return (
    <svg 
      viewBox="0 0 100 100" 
      className={className}
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
          <feOffset dx="1" dy="1" result="offsetblur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.3" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Decorative Outer Ring */}
      <circle cx="50" cy="50" r="46" stroke="url(#logoGradient)" strokeWidth="1.5" strokeDasharray="4 4" className="opacity-40" />
      <circle cx="50" cy="50" r="42" stroke="url(#logoGradient)" strokeWidth="0.5" className="opacity-20" />

      {/* Intertwined HG Logo */}
      <g filter="url(#shadow)">
        {/* The 'H' - sturdy structure */}
        <path 
          d="M32 25 L32 75 M68 25 L68 75 M32 50 L68 50" 
          stroke="url(#logoGradient)" 
          strokeWidth="10" 
          strokeLinecap="round"
        />
        {/* The 'G' - intertwining through the H */}
        <path 
          d="M75 35 C75 22 62 18 50 18 C32 18 20 32 20 50 C20 68 32 82 50 82 C65 82 75 72 75 55 L75 50 L50 50" 
          stroke="#FFFFFF" 
          strokeWidth="6" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          className="drop-shadow-md"
        />
        {/* Accent connection point */}
        <circle cx="50" cy="50" r="4" fill="url(#logoGradient)" />
      </g>
    </svg>
  );
};

export default Logo;
