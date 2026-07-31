import { useState, useRef, useEffect } from 'react';
import './CustomSelect.css';

export function CustomSelect({ value, onChange, options, defaultLabel }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedLabel = value ? options.find(o => o.value === value)?.label || value : defaultLabel;

  return (
    <div className="custom-select-container" ref={containerRef}>
      <button 
        type="button" 
        className="custom-select-trigger" 
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{selectedLabel}</span>
        <span className="custom-select-arrow">▼</span>
      </button>
      
      {isOpen && (
        <div className="custom-select-dropdown">
          <div 
            className={`custom-select-option ${value === '' ? 'selected' : ''}`}
            onClick={() => { onChange(''); setIsOpen(false); }}
          >
            {defaultLabel}
          </div>
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`custom-select-option ${value === opt.value ? 'selected' : ''}`}
              onClick={() => { onChange(opt.value); setIsOpen(false); }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
