import React from 'react';

interface SelectOption {
  value: string | number;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
  containerClassName?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  id,
  name,
  options,
  value,
  onChange,
  disabled,
  required,
  error,
  className = '',
  containerClassName = '',
  ...props
}) => {
  const baseStyle = "block w-full px-3 py-2 bg-jdc-gray-800 border border-jdc-gray-700 rounded-md shadow-sm placeholder-jdc-gray-500 focus:outline-none focus:ring-jdc-yellow focus:border-jdc-yellow sm:text-sm text-white disabled:opacity-50";
  const errorStyle = error ? "border-red-500 ring-red-500" : "border-jdc-gray-700";

  return (
    <div className={`mb-4 ${containerClassName}`}>
      {label && (
        <label htmlFor={id || name} className="block text-sm font-medium text-jdc-gray-300 mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <select
        id={id || name}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        className={`${baseStyle} ${errorStyle} ${className}`}
        {...props}
      >
        {/* Optional: Add a default placeholder option if needed */}
        {/* <option value="" disabled>Select...</option> */}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
    </div>
  );
};
