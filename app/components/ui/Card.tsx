import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className = '', header, footer, noPadding = false }) => {
  return (
    <div
      className={`bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 ${noPadding ? '' : 'p-6'} ${className}`}
      style={{ boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)' }}
    >
      {header && <div className="mb-4">{header}</div>}
      {children}
      {footer && <div className="mt-4">{footer}</div>}
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
  const baseStyle = "px-4 py-3 sm:px-6 border-b border-jdc-gray-800"; // Adjusted padding
  return <div className={`${baseStyle} ${className}`}>{children}</div>;
};

export const CardBody: React.FC<CardSectionProps> = ({ children, className = '' }) => {
  const baseStyle = "px-4 py-4 sm:p-6"; // Adjusted padding
  return <div className={`${baseStyle} ${className}`}>{children}</div>;
};

export const CardFooter: React.FC<CardSectionProps> = ({ children, className = '' }) => {
  const baseStyle = "px-4 py-3 sm:px-6 bg-jdc-gray-800/50"; // Slightly different bg for footer
  return <div className={`${baseStyle} ${className}`}>{children}</div>;
};
