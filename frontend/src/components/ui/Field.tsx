// components/ui/Field.tsx

interface FieldProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
}

export function Field({ label, hint, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-neutral-700">
        {label}
        {hint && <span className="ml-1.5 text-neutral-400 font-normal">{hint}</span>}
      </label>
      {children}
    </div>
  );
}