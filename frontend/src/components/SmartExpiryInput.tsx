import React, { useRef, useState, useEffect } from 'react';

interface SmartExpiryInputProps {
  month: number | '' | undefined;
  year: number | '' | undefined; // Can be 2027 or 27
  onChange: (month: number, year: number) => void;
  onNext?: () => void;
  monthId?: string;
  yearId?: string;
  className?: string;
  disabled?: boolean;
}

export const SmartExpiryInput: React.FC<SmartExpiryInputProps> = ({
  month,
  year,
  onChange,
  onNext,
  monthId,
  yearId,
  className = '',
  disabled = false,
}) => {
  const monthInputRef = useRef<HTMLInputElement>(null);
  const yearInputRef = useRef<HTMLInputElement>(null);

  const defaultYear = new Date().getFullYear() + 2; // e.g. 2028

  // Helper to format props to string
  const formatPropMonth = (m?: number | ''): string => {
    if (m === undefined || m === '' || Number(m) <= 0) return '';
    const num = Number(m);
    return num > 12 ? '12' : String(num);
  };

  const formatPropYear = (y?: number | ''): string => {
    if (y === undefined || y === '' || Number(y) <= 2000) return '';
    const num = Number(y);
    if (num < 100) return String(2000 + num);
    return String(num);
  };

  const [localMonth, setLocalMonth] = useState<string>(formatPropMonth(month));
  const [localYear, setLocalYear] = useState<string>(formatPropYear(year));

  // Sync state when props update externally
  useEffect(() => {
    setLocalMonth(formatPropMonth(month));
  }, [month]);

  useEffect(() => {
    setLocalYear(formatPropYear(year));
  }, [year]);

  const commitValues = (mStr: string, yStr: string) => {
    let m = parseInt(mStr.replace(/\D/g, ''), 10) || 0;
    if (m > 12) m = 12;

    const rawY = yStr.replace(/\D/g, '');
    let y = 0;
    if (rawY.length === 4) {
      y = parseInt(rawY, 10);
    } else if (rawY.length === 2) {
      y = 2000 + parseInt(rawY, 10);
    } else if (rawY.length > 0) {
      const parsed = parseInt(rawY, 10);
      if (parsed >= 2020) {
        y = parsed;
      } else if (parsed < 100) {
        y = 2000 + parsed;
      }
    }

    if (y <= 2000) {
      y = defaultYear;
    }

    onChange(m, y);
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (raw === '') {
      setLocalMonth('');
      commitValues('', localYear);
      return;
    }

    let val = parseInt(raw, 10);
    if (val > 12) val = 12;
    const strVal = String(val);
    setLocalMonth(strVal);
    commitValues(strVal, localYear);

    // Auto-advance to Year field if 2 digits entered (e.g. 10, 11, 12) or single digit > 1 (e.g. 2..9)
    if (raw.length >= 2 || (raw.length === 1 && val >= 2 && val <= 9)) {
      yearInputRef.current?.focus();
      yearInputRef.current?.select();
    }
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 4); // allow up to 4 digits (e.g. 2028 or 28)
    setLocalYear(raw);

    if (raw.length === 2 || raw.length === 4) {
      commitValues(localMonth, raw);
    }
  };

  const handleYearBlur = () => {
    if (localYear.length > 0) {
      commitValues(localMonth, localYear);
      // Format display nicely to 4 digits on blur
      const rawY = localYear.replace(/\D/g, '');
      if (rawY.length === 2) {
        setLocalYear(String(2000 + parseInt(rawY, 10)));
      }
    }
  };

  const handleMonthKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      yearInputRef.current?.focus();
      yearInputRef.current?.select();
    }
  };

  const handleYearKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitValues(localMonth, localYear);
      if (onNext) {
        onNext();
      }
    } else if (e.key === 'Backspace' && localYear === '') {
      monthInputRef.current?.focus();
    }
  };

  return (
    <div
      dir="ltr"
      className={`inline-flex items-center gap-1 bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs transition-all focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 ${
        disabled ? 'opacity-50 pointer-events-none' : ''
      } ${className}`}
    >
      {/* Month input (1-12) */}
      <input
        ref={monthInputRef}
        id={monthId}
        type="text"
        inputMode="numeric"
        disabled={disabled}
        placeholder="MM"
        maxLength={2}
        value={localMonth}
        onChange={handleMonthChange}
        onKeyDown={handleMonthKeyDown}
        className="w-7 text-center font-mono font-bold text-slate-900 bg-transparent outline-hidden placeholder:text-slate-300 select-all"
        title="شهر الصلاحية (1 إلى 12)"
      />

      <span className="text-slate-400 font-bold select-none">/</span>

      {/* Year input (Full 4-digit YYYY e.g. 2028 or 2-digit 28) */}
      <input
        ref={yearInputRef}
        id={yearId}
        type="text"
        inputMode="numeric"
        disabled={disabled}
        placeholder={String(defaultYear)}
        maxLength={4}
        value={localYear}
        onChange={handleYearChange}
        onBlur={handleYearBlur}
        onKeyDown={handleYearKeyDown}
        className="w-12 text-center font-mono font-bold text-slate-900 bg-transparent outline-hidden placeholder:text-slate-300 select-all"
        title="سنة الصلاحية (مثل 2028 أو 28)"
      />
    </div>
  );
};
