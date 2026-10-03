import React, { useState } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  leadingIcon,
  trailingIcon,
  error,
  className = '',
  id,
  type = 'text',
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputId = id || props.name || Math.random().toString(36).substring(7);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
      {label && (
        <label
          htmlFor={inputId}
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
        {leadingIcon && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '12px',
              color: isFocused ? '#EC4899' : '#9CA3AF',
              transition: 'color 0.2s ease',
            }}
          >
            {leadingIcon}
          </div>
        )}

        <input
          id={inputId}
          type={type}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            color: '#FFFFFF',
            fontSize: '14px',
            outline: 'none',
            width: '100%',
          }}
          className={className}
          {...props}
        />

        {trailingIcon && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: '10px',
              color: '#9CA3AF',
              cursor: 'pointer',
            }}
          >
            {trailingIcon}
          </div>
        )}
      </div>

      {error && (
        <span style={{ fontSize: '11px', color: '#F87171', marginTop: '2px', fontWeight: 500 }}>
          {error}
        </span>
      )}
    </div>
  );
};
