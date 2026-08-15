import { useEffect, useState } from 'react'
import type React from 'react'

/**
 * Numeric input that tolerates in-progress typing ("-", "1e", "0.")
 * by keeping local text state and committing only finite parses.
 */
export function NumField({
  value,
  onChange,
  label,
  suffix,
  width = 90,
  step,
  min,
  max,
  title,
}: {
  value: number
  onChange: (v: number) => void
  label?: string
  suffix?: string
  width?: number
  step?: number
  min?: number
  max?: number
  title?: string
}) {
  const [text, setText] = useState(String(value))
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused) setText(String(value))
  }, [value, focused])

  const field = (
    <span className="numfield" title={title}>
      <input
        type="number"
        inputMode="decimal"
        value={text}
        step={step}
        min={min}
        max={max}
        style={{ width }}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false)
          setText(String(value))
        }}
        onChange={(e) => {
          setText(e.target.value)
          const n = Number(e.target.value)
          if (e.target.value.trim() !== '' && Number.isFinite(n)) {
            let v = n
            if (min !== undefined) v = Math.max(min, v)
            if (max !== undefined) v = Math.min(max, v)
            onChange(v)
          }
        }}
        aria-label={label}
      />
      {suffix && <span className="numfield-suffix">{suffix}</span>}
    </span>
  )
  if (!label) return field
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {field}
    </label>
  )
}

export function TextField({
  value,
  onChange,
  label,
  placeholder,
  width,
  className,
}: {
  value: string
  onChange: (v: string) => void
  label?: string
  placeholder?: string
  width?: number | string
  className?: string
}) {
  const input = (
    <input
      type="text"
      className={className}
      value={value}
      placeholder={placeholder}
      style={width !== undefined ? { width } : undefined}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label ?? placeholder}
    />
  )
  if (!label) return input
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {input}
    </label>
  )
}

/** Segmented control. */
export function Seg<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: React.ReactNode; disabled?: boolean; title?: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          className={value === o.value ? 'seg-btn seg-on' : 'seg-btn'}
          disabled={o.disabled}
          title={o.title}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Inline statistical notation, set like the book does. */
export function M({ children }: { children: React.ReactNode }) {
  return <span className="math">{children}</span>
}

export function WarnList({ issues }: { issues: string[] }) {
  if (issues.length === 0) return null
  return (
    <ul className="warn-list" role="alert">
      {issues.map((s, i) => (
        <li key={i}>{s}</li>
      ))}
    </ul>
  )
}
