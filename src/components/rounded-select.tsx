"use client";
import { Children, isValidElement, useEffect, useId, useRef, useState, type ReactNode, type SelectHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

type Option = { value: string; label: string; disabled: boolean };
type Position = { left: number; top: number; width: number; maxHeight: number };

function labelText(children: ReactNode): string {
  return Children.toArray(children).map((child) => isValidElement<{ children?: ReactNode }>(child) ? labelText(child.props.children) : String(child)).join("");
}

export function RoundedSelect({ children, className, displayValue, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { displayValue?: ReactNode }) {
  const options: Option[] = Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ children?: ReactNode; value?: string | number; disabled?: boolean }>(child) || child.type !== "option") return [];
    const label = labelText(child.props.children);
    return [{ value: String(child.props.value ?? label), label, disabled: !!child.props.disabled }];
  });
  const id = useId();
  const nativeRef = useRef<HTMLSelectElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [focused, setFocused] = useState(-1);
  const [uncontrolledValue, setUncontrolledValue] = useState(String(props.defaultValue ?? options[0]?.value ?? ""));
  const value = props.value === undefined ? uncontrolledValue : String(props.value);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = options[selectedIndex] ?? options[0];

  function close() { setOpen(false); triggerRef.current?.focus(); }
  function choose(index: number) {
    const option = options[index];
    if (!option || option.disabled || props.disabled || !nativeRef.current) return;
    setUncontrolledValue(option.value);
    nativeRef.current.value = option.value;
    nativeRef.current.dispatchEvent(new Event("change", { bubbles: true }));
    close();
  }
  function show() {
    if (props.disabled || !options.length) return;
    setPortalRoot(triggerRef.current?.closest("dialog") ?? document.body);
    setFocused(selectedIndex >= 0 && !options[selectedIndex].disabled ? selectedIndex : options.findIndex((option) => !option.disabled));
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function measure() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const height = Math.min(320, options.length * 48 + 16);
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const upward = below < Math.min(height, 180) && above > below;
      const maxHeight = Math.min(height, Math.max(80, upward ? above : below));
      const width = Math.min(Math.max(rect.width, 208), window.innerWidth - 16);
      setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), top: upward ? rect.top - maxHeight - 6 : rect.bottom + 6, width, maxHeight });
    }
    function outside(event: PointerEvent) {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !listRef.current?.contains(target)) setOpen(false);
    }
    measure();
    const timer = window.setTimeout(() => listRef.current?.focus(), 0);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    document.addEventListener("pointerdown", outside);
    return () => { window.clearTimeout(timer); window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); document.removeEventListener("pointerdown", outside); };
  }, [open, options.length]);

  useEffect(() => {
    if (open && focused >= 0) document.getElementById(`${id}-option-${focused}`)?.scrollIntoView({ block: "nearest" });
  }, [open, focused, id]);

  return <div className="rounded-select">
    <select {...props} className="rounded-select-native" tabIndex={-1} aria-hidden="true" ref={nativeRef} onChange={(event) => { setUncontrolledValue(event.target.value); props.onChange?.(event); }}>{children}</select>
    <button type="button" className={`rounded-select-trigger ${className ?? "auth-input"}`} ref={triggerRef} disabled={props.disabled} role="combobox" aria-expanded={open} aria-haspopup="listbox" aria-controls={`${id}-list`} aria-label={props["aria-label"]} aria-labelledby={props["aria-labelledby"]} onClick={() => open ? close() : show()} onKeyDown={(event) => {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) { event.preventDefault(); show(); }
    }}><span>{displayValue ?? selected?.label ?? ""}</span><ChevronDown size={16} aria-hidden="true" /></button>
    {open && position && createPortal(<div className="rounded-select-menu" ref={listRef} role="listbox" id={`${id}-list`} tabIndex={-1} aria-label={props["aria-label"] ?? selected?.label} aria-activedescendant={focused >= 0 ? `${id}-option-${focused}` : undefined} style={position} onKeyDown={(event) => {
      if (event.key === "Escape") { event.preventDefault(); close(); return; }
      if (event.key === "Tab") { setOpen(false); triggerRef.current?.focus(); return; }
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(focused); return; }
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        const available = options.map((option, index) => option.disabled ? -1 : index).filter((index) => index >= 0);
        const current = available.indexOf(focused);
        const next = event.key === "Home" ? 0 : event.key === "End" ? available.length - 1 : (current + (event.key === "ArrowUp" ? -1 : 1) + available.length) % available.length;
        setFocused(available[next] ?? -1);
      } else if (event.key.length === 1) {
        const next = options.findIndex((option) => !option.disabled && option.label.toLocaleLowerCase().startsWith(event.key.toLocaleLowerCase()));
        if (next >= 0) setFocused(next);
      }
    }}>{options.map((option, index) => <button type="button" role="option" tabIndex={-1} id={`${id}-option-${index}`} key={option.value} aria-selected={value === option.value} aria-disabled={option.disabled} disabled={option.disabled} className={`rounded-select-option ${focused === index ? "focused" : ""}`} onPointerMove={() => !option.disabled && setFocused(index)} onClick={() => choose(index)}><span>{option.label}</span>{value === option.value && <Check size={16} aria-hidden="true" />}</button>)}</div>, portalRoot ?? document.body)}
  </div>;
}
