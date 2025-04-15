import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  as?: keyof JSX.IntrinsicElements; // Allow specifying the element type (div, section, etc.)
}

export const Card: React.FC<CardProps> = ({ children, className = '', as = 'div' }) => {
  const Tag = as;
  // Added transition, hover transform, and hover shadow classes
  const baseStyle = "bg-jdc-card rounded-lg shadow-lg overflow-hidden transition duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-xl";

  return (
    <Tag className={`${baseStyle} ${className}`}>
      {children}
    </Tag>
  );
};

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
