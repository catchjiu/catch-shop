"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { ChevronDown } from "lucide-react";

const ACADEMIES = [
  "Catch Kaohsiung",
  "Catch Tainan",
  "Northside",
  "Ninja Brothers",
  "Other",
];

interface AcademySelectProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  otherPlaceholder?: string;
}

export function AcademySelect({
  value,
  onChange,
  label,
  placeholder = "Select your academy (optional)",
  otherPlaceholder = "Enter your academy name",
}: AcademySelectProps) {
  // Determine if current value is a custom "Other" entry
  const isKnown = (v: string) => ACADEMIES.slice(0, -1).includes(v) || v === "" || v === "Other";
  const [showOther, setShowOther] = useState(!isKnown(value) && value !== "");
  const [otherText, setOtherText] = useState(!isKnown(value) ? value : "");

  // Sync if value is externally reset (e.g. form reset)
  useEffect(() => {
    if (value === "" || ACADEMIES.slice(0, -1).includes(value)) {
      setShowOther(false);
    }
  }, [value]);

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    if (v === "Other") {
      setShowOther(true);
      onChange(otherText); // keep current custom text as value
    } else {
      setShowOther(false);
      setOtherText("");
      onChange(v);
    }
  };

  const handleOtherChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOtherText(e.target.value);
    onChange(e.target.value);
  };

  const selectDisplayValue = showOther ? "Other" : value;

  return (
    <div className="space-y-2">
      {label && <p className="text-xs text-white/50">{label}</p>}

      {/* Select wrapper */}
      <div className="relative">
        <select
          value={selectDisplayValue}
          onChange={handleSelect}
          className="w-full appearance-none rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/30 pr-9"
        >
          <option value="" className="bg-slate-900 text-white/50">{placeholder}</option>
          {ACADEMIES.map((a) => (
            <option key={a} value={a} className="bg-slate-900 text-white">{a}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
      </div>

      {/* Custom entry when "Other" is selected */}
      {showOther && (
        <Input
          value={otherText}
          onChange={handleOtherChange}
          placeholder={otherPlaceholder}
          autoFocus
          className="border-white/20 bg-white/5 text-white placeholder:text-white/20"
        />
      )}
    </div>
  );
}
