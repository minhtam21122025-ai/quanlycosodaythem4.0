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
          <stop offset="0%" stopColor="#00A3FF" />
          <stop offset="100%" stopColor="#0047BB" />
        </linearGradient>
      </defs>

      {/* Simplified Stylized HG */}
      <circle cx="50" cy="50" r="45" stroke="url(#logoGradient)" strokeWidth="8" />
      <path 
        d="M35 30 L35 70 M35 50 L50 50 M50 30 L50 70 M50 30 C65 30 70 40 70 50 C70 60 65 70 50 70" 
        stroke="url(#logoGradient)" 
        strokeWidth="8" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default Logo;
