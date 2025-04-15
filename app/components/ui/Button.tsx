import React from 'react';
import { Link, type LinkProps } from '@remix-run/react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonBaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  disabled?: boolean;
  leftIcon?: React.ReactElement;
  rightIcon?: React.ReactElement;
  children: React.ReactNode;
  className?: string;
}

// Props for a standard button element
// Omit 'children' from ButtonHTMLAttributes to resolve conflict with ButtonBaseProps
interface ButtonElementProps extends ButtonBaseProps, Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  as?: 'button';
  to?: never; // Ensure 'to' is not passed for 'button'
}

// Props for a link element styled as a button
interface LinkElementProps extends ButtonBaseProps, Omit<LinkProps, 'children' | 'className'> {
  as: 'link';
  to: LinkProps['to']; // 'to' is required for 'link'
}

type ButtonProps = ButtonElementProps | LinkElementProps;

// Added active:scale-95 and transition-transform for click animation
const baseStyles = "inline-flex items-center justify-center font-semibold rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-jdc-black transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed transition-transform duration-100 ease-in-out active:scale-95";

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-jdc-yellow text-jdc-black hover:bg-yellow-300 focus:ring-jdc-yellow",
  secondary: "bg-jdc-card text-jdc-gray-300 border border-jdc-gray-800 hover:bg-jdc-gray-800 focus:ring-jdc-gray-400",
  danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
  ghost: "bg-transparent text-jdc-gray-300 hover:bg-jdc-gray-800 focus:ring-jdc-gray-400",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-base",
  lg: "px-6 py-3 text-lg",
};

export const Button: React.FC<ButtonProps> = ({
  as = 'button',
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  children,
  className = '',
  ...props
}) => {
  const combinedClassName = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`;

  const content = (
    <>
      {isLoading ? (
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : (
        leftIcon && <span className="mr-2 -ml-1">{React.cloneElement(leftIcon, { className: 'h-5 w-5' })}</span>
      )}
      {children}
      {!isLoading && rightIcon && <span className="ml-2 -mr-1">{React.cloneElement(rightIcon, { className: 'h-5 w-5' })}</span>}
    </>
  );

  if (as === 'link') {
    // Destructure LinkProps specifically for the Link component
    const { to, reloadDocument, replace, state, preventScrollReset, relative, ...restLinkProps } = props as Omit<LinkElementProps, 'as' | 'children' | 'className' | 'variant' | 'size' | 'isLoading' | 'disabled' | 'leftIcon' | 'rightIcon'>;

    // We cannot pass button-specific HTML attributes like 'type' or 'onClick' directly to Remix's Link
    // Filter out any remaining non-Link props if necessary, though TS should help here.

    return (
      <Link
        to={to}
        reloadDocument={reloadDocument}
        replace={replace}
        state={state}
        preventScrollReset={preventScrollReset}
        relative={relative}
        className={combinedClassName}
        aria-disabled={disabled || isLoading}
        // onClick={(e) => (disabled || isLoading) && e.preventDefault()} // Prevent navigation if disabled
        {...restLinkProps} // Pass remaining valid LinkProps
      >
        {content}
      </Link>
    );
  }

  // Handle 'button' element props
  const { type = 'button', onClick, ...restButtonProps } = props as Omit<ButtonElementProps, 'as' | 'children' | 'className' | 'variant' | 'size' | 'isLoading' | 'disabled' | 'leftIcon' | 'rightIcon'>;

  return (
    <button
      type={type}
      className={combinedClassName}
      disabled={disabled || isLoading}
      onClick={onClick}
      {...restButtonProps} // Pass remaining valid button attributes
    >
      {content}
    </button>
  );
};
