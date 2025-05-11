import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className = '', header, footer, noPadding = false }) => {
  // Si le glassmorphisme fonctionne, on utilise bg-white/10 et backdrop-blur.
  // Sinon, on pourrait utiliser bg-ui-surface ou bg-ui-background.
  // L'utilisateur a indiqué que le problème de transparence est réglé, donc on tente le glassmorphisme.
  const baseCardStyle = `bg-white/5 backdrop-blur-lg rounded-lg shadow-lg border border-white/10`;
  
  return (
    <div
      className={`${baseCardStyle} ${noPadding ? '' : 'p-4 sm:p-6'} ${className}`} // Padding ajusté, style inline de boxShadow retiré
    >
      {header && <div className="pb-4 border-b border-white/10 mb-4">{header}</div>} {/* Header avec bordure subtile */}
      {children}
      {footer && <div className="pt-4 border-t border-white/10 mt-4">{footer}</div>} {/* Footer avec bordure subtile */}
    </div>
  );
};

export default Card;

// Optional: Card Header, Body, Footer components for structure
interface CardSectionProps {
  children: React.ReactNode;
  className?: string;
}

export const CardHeader: React.FC<CardSectionProps> = ({ children, className = '' }) => {
  // Ces composants ne sont pas directement utilisés dans dashboard.tsx pour l'instant,
  // mais nous les mettons à jour pour la cohérence.
  const baseStyle = "px-4 py-3 sm:px-6 border-b border-ui-border"; 
  return <div className={`${baseStyle} ${className}`}>{children}</div>;
};

export const CardBody: React.FC<CardSectionProps> = ({ children, className = '' }) => {
  const baseStyle = "px-4 py-4 sm:p-6";
  return <div className={`${baseStyle} ${className}`}>{children}</div>;
};

export const CardFooter: React.FC<CardSectionProps> = ({ children, className = '' }) => {
  const baseStyle = "px-4 py-3 sm:px-6 bg-ui-background border-t border-ui-border"; // Fond et bordure cohérents
  return <div className={`${baseStyle} ${className}`}>{children}</div>;
};
