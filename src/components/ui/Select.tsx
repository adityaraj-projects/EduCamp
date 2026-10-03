import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  options,
  placeholder = 'Select',
  error,
  id,
  className = '',
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const selectId = id || props.name || Math.random().toString(36).substring(7);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
      {label && (
        <label
          htmlFor={selectId}
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: '#FFFFFF',
            letterSpacing: '0.2px',
          }}
        >
          {label}
        </label>
      )}

      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          background: '#211A45',
          borderRadius: '12px',
          border: isFocused
            ? '1.5px solid #EC4899'
            : error
            ? '1.5px solid #EF4444'
            : '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: isFocused
            ? '0 0 0 3px rgba(236, 72, 153, 0.25)'
            : 'none',
          transition: 'all 0.2s ease',
          height: '50px',
          padding: '0 14px',
          boxSizing: 'border-box',
        }}
      >
        <select
          id={selectId}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            color: '#FFFFFF',
            fontSize: '13px',
            outline: 'none',
            width: '100%',
            appearance: 'none',
            WebkitAppearance: 'none',
            cursor: 'pointer',
            paddingRight: '24px',
          }}
          className={className}
          {...props}
        >
          <option value="" style={{ background: '#16113A', color: '#9CA3AF' }}>
            {placeholder}
          </option>
          {options.map((opt) => (
            <option
              key={opt.value}
              value={opt.value}
              style={{ background: '#16113A', color: '#FFFFFF' }}
            >
              {opt.label}
            </option>
          ))}
        </select>

        <div
          style={{
            position: 'absolute',
            right: '14px',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            color: '#9CA3AF',
          }}
        >
          <ChevronDown size={18} />
        </div>
      </div>

      {error && (
        <span style={{ fontSize: '11px', color: '#F87171', marginTop: '2px', fontWeight: 500 }}>
          {error}
        </span>
      )}
    </div>
  );
};
