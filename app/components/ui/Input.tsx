import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactElement;
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, id, name, type = 'text', error, icon, className = '', wrapperClassName = '', ...props }, ref) => {
    const inputId = id || name; // Use name as fallback for id if not provided
    const hasIcon = !!icon;

    const baseInputStyle = "block w-full rounded-md bg-jdc-gray-800 border-transparent focus:border-jdc-yellow focus:ring focus:ring-jdc-yellow focus:ring-opacity-50 placeholder-jdc-gray-400 text-white disabled:opacity-50 disabled:cursor-not-allowed"; // Added disabled styles
    const iconPadding = hasIcon ? "pl-10" : "pl-3"; // Adjust padding based on icon presence
    const errorStyle = error ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "border-transparent";

    return (
      <div className={`mb-4 ${wrapperClassName}`}>
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-jdc-gray-300 mb-1">
            {label}
          </label>
        )}
        <div className="relative rounded-md shadow-sm">
          {hasIcon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              {/* Ensure icon color changes when input is disabled */}
              {React.cloneElement(icon, { className: `h-5 w-5 ${props.disabled ? 'text-jdc-gray-500' : 'text-jdc-gray-400'}` })}
            </div>
          )}
          <input
            ref={ref}
            type={type}
            id={inputId}
            name={name}
            className={`${baseInputStyle} ${iconPadding} pr-3 py-2 ${errorStyle} ${className}`}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? `${inputId}-error` : undefined}
            {...props} // Pass disabled prop here
          />
        </div>
        {/* Don't show validation error message if input is disabled */}
        {error && !props.disabled && (
          <p className="mt-1 text-sm text-red-500" id={`${inputId}-error`}>
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input'; // Add display name for DevTools
