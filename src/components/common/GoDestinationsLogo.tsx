import React from 'react';
import logoImg from '../../assets/go_destinations_logo_1787243700153.jpg';

interface GoDestinationsLogoProps {
  variant?: 'icon-only' | 'horizontal' | 'stacked';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  darkBackground?: boolean;
}

export const GoDestinationsLogo: React.FC<GoDestinationsLogoProps> = ({
  variant = 'horizontal',
  size = 'md',
  className = '',
  darkBackground = false,
}) => {
  // Size mapping
  const sizeMap = {
    sm: {
      img: 'w-7 h-7',
      textMain: 'text-sm',
      textSub: 'text-[9px]',
      gap: 'space-x-2',
      stackedImg: 'w-12 h-12',
    },
    md: {
      img: 'w-9 h-9',
      textMain: 'text-base',
      textSub: 'text-[10px]',
      gap: 'space-x-2.5',
      stackedImg: 'w-16 h-16',
    },
    lg: {
      img: 'w-12 h-12',
      textMain: 'text-lg',
      textSub: 'text-xs',
      gap: 'space-x-3',
      stackedImg: 'w-20 h-20',
    },
    xl: {
      img: 'w-16 h-16',
      textMain: 'text-2xl',
      textSub: 'text-sm',
      gap: 'space-x-4',
      stackedImg: 'w-24 h-24',
    },
  };

  const { img, textMain, textSub, gap, stackedImg } = sizeMap[size];

  // The authentic uploaded GO Destinations logo image
  const LogoImageElement = (
    <img
      src={logoImg}
      alt="GO Destinations"
      className={`${img} rounded-full object-cover shrink-0 select-none shadow-2xs border border-slate-200/40`}
      referrerPolicy="no-referrer"
    />
  );

  if (variant === 'icon-only') {
    return <div className={`inline-flex items-center justify-center ${className}`}>{LogoImageElement}</div>;
  }

  if (variant === 'stacked') {
    return (
      <div className={`flex flex-col items-center justify-center text-center ${className}`}>
        <div className="relative mb-2">
          <img
            src={logoImg}
            alt="GO Destinations Logo"
            className={`${stackedImg} rounded-full object-cover shadow-xs select-none border border-slate-200/60`}
            referrerPolicy="no-referrer"
          />
        </div>
        <div
          className={`font-extrabold tracking-tight select-none ${
            darkBackground ? 'text-white' : 'text-[#365c84]'
          } ${size === 'xl' ? 'text-2xl' : size === 'lg' ? 'text-xl' : 'text-lg'}`}
          style={{ letterSpacing: '0.02em' }}
        >
          GO Destinations
        </div>
      </div>
    );
  }

  // Default 'horizontal' variant
  return (
    <div className={`flex items-center ${gap} ${className}`}>
      {LogoImageElement}
      <div className="flex flex-col leading-tight">
        <div className="flex items-center space-x-1.5">
          <span
            className={`font-bold tracking-tight ${
              darkBackground ? 'text-white' : 'text-slate-900'
            } ${textMain}`}
          >
            GO Destinations
          </span>
        </div>
        <span
          className={`font-semibold tracking-wider uppercase ${
            darkBackground ? 'text-slate-400' : 'text-[#365c84]'
          } ${textSub}`}
        >
          HR Hub & Leave Portal
        </span>
      </div>
    </div>
  );
};
