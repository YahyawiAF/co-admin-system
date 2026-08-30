"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export function TagInput({
  value,
  onChange,
  placeholder,
  suggestions,
  maxTags = 24,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  maxTags?: number;
}) {
  const [draft, setDraft] = useState("");

  const add = (raw: string) => {
    const tag = raw.trim();
    if (!tag) return;
    if (value.some((v) => v.toLowerCase() === tag.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...value, tag].slice(0, maxTags));
    setDraft("");
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  const available = (suggestions || []).filter(
    (s) => !value.some((v) => v.toLowerCase() === s.toLowerCase())
  );

  return (
    <div className="space-y-2">
      <div className="rounded-md border bg-white px-2 py-1.5">
        <div className="flex flex-wrap gap-1">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1">
              {tag}
              <button
                type="button"
                aria-label={`Retirer ${tag}`}
                onClick={() => onChange(value.filter((t) => t !== tag))}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Input
            className="h-8 min-w-[8rem] flex-1 border-0 px-1 shadow-none focus-visible:ring-0"
            value={draft}
            placeholder={placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            onBlur={() => add(draft)}
          />
        </div>
      </div>
      {available.length ? (
        <div className="flex flex-wrap gap-1">
          {available.slice(0, 16).map((s) => (
            <button
              key={s}
              type="button"
              className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] text-slate-600"
              onClick={() => add(s)}
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
