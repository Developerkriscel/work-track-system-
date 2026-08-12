import { useState, useRef, useEffect, useMemo } from 'react';
import './CustomSelect.css';

export function CustomMultiSelect({ value = [], onChange, options = [], defaultLabel = 'Select options' }) {
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

  const safeValue = Array.isArray(value) ? value : String(value || '').split(',').map(s => s.trim()).filter(Boolean);

  const selectedLabels = useMemo(() => {
    if (!safeValue.length) return defaultLabel;
    const labels = safeValue.map(v => {
      const opt = options.find(o => String(o.value) === String(v));
      return opt ? opt.label : v;
    });
    if (labels.length <= 2) return labels.join(', ');
    return `${labels[0]}, ${labels[1]} +${labels.length - 2}`;
  }, [safeValue, options, defaultLabel]);

  const toggleOption = (optValue) => {
    const stringVal = String(optValue);
    if (safeValue.includes(stringVal)) {
      onChange(safeValue.filter(v => v !== stringVal));
    } else {
      onChange([...safeValue, stringVal]);
    }
  };

  return (
    <div className="custom-select-container custom-multi-select" ref={containerRef}>
      <button 
        type="button" 
        className="custom-select-trigger" 
        onClick={() => setIsOpen(!isOpen)}
        title={safeValue.length > 2 ? safeValue.map(v => options.find(o => String(o.value) === String(v))?.label || v).join(', ') : ''}
      >
        <span>{selectedLabels}</span>
        <span className="custom-select-arrow">▼</span>
      </button>
      
      {isOpen && (
        <div className="custom-select-dropdown">
          <div 
            className={`custom-select-option ${safeValue.length === 0 ? 'selected' : ''}`}
            onClick={() => { onChange([]); setIsOpen(false); }}
          >
            <div className="custom-checkbox">
               <div className={`checkbox-inner ${safeValue.length === 0 ? 'checked' : ''}`} />
            </div>
            <span>None</span>
          </div>
          {options.filter(opt => String(opt.value) !== '').map((opt) => {
            const isSelected = safeValue.includes(String(opt.value));
            return (
              <div
                key={opt.value}
                className={`custom-select-option ${isSelected ? 'selected' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleOption(opt.value);
                }}
              >
                <div className="custom-checkbox">
                   <div className={`checkbox-inner ${isSelected ? 'checked' : ''}`} />
                </div>
                <span>{opt.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
