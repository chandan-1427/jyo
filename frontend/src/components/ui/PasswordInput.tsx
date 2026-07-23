import { useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "./Input";

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        className={cn("pr-16", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow(prev => !prev)}
        className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-medium text-subtle hover:text-foreground transition-colors select-none"
      >
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
}