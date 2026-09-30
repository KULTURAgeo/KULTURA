export function Field({
  label,
  name,
  defaultValue = "",
  type = "text",
  required = false,
  maxLength,
  min,
  max,
  step,
  autoComplete,
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
  type?: string;
  required?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  step?: string;
  autoComplete?: string;
}) {
  return (
    <label className="k-field">
      <span>{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        type={type}
        required={required}
        maxLength={maxLength}
        min={min}
        max={max}
        step={step}
        autoComplete={autoComplete}
      />
    </label>
  );
}
