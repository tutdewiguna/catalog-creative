"use client";

import { useRef, useState } from "react";
import { CalendarDays } from "lucide-react";

export default function DatePicker() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dateValue, setDateValue] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const handleIconClick = () => {
    if (inputRef.current) {
      setIsEditing(true);
      setTimeout(() => {
        inputRef.current?.showPicker();
      }, 0);
    }
  };

  const handleFocus = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDateValue(e.target.value);
  };

  const getDisplayValue = () => {
    if (!dateValue) return "";
    const [y, m, d] = dateValue.split("-");
    if (y && m && d) {
      return `${d}/${m}/${y}`;
    }
    return "";
  };

  return (
    <div className="relative flex items-center">
      <input
        ref={inputRef}
        type={isEditing ? "date" : "text"}
        value={isEditing ? dateValue : getDisplayValue()}
        placeholder="Select Date"
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className="
          form-input !py-2 !pl-3 !pr-8 !text-sm !w-40 
          relative appearance-none bg-light border-accent/15  
          hover:border-accent/25 focus:bg-white focus:border-primary
          text-muted
        "
      />
      <div
        onClick={handleIconClick}
        className="absolute right-3 cursor-pointer text-muted/80"
      >
        <CalendarDays size={16} />
      </div>
    </div>
  );
}