import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface BaseProps {
  label: string;
  className?: string;
}

interface ButtonProps extends BaseProps {
  as?: "button";
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}

interface LinkProps extends BaseProps {
  as: "link";
  to: string;
  exact?: boolean;
}

type Props = ButtonProps | LinkProps;

const baseStyles =
  "inline-flex items-center justify-center text-sm font-semibold tracking-tight px-6 py-2.5 rounded-lg bg-[#F2F0EC] hover:bg-white active:scale-[0.97] text-[#1B1A19] cursor-pointer transition-all duration-150 ease-out shadow-sm hover:shadow-md";

export function LinkButton(props: Props) {
  const { label, className } = props;

  if (props.as === "link") {
    return (
      <Link
        to={props.to}
        className={cn(
          baseStyles,
          className
        )}
      >
        {label}
      </Link>
    );
  }

  return (
    <button
      type={props.type ?? "button"}
      disabled={props.disabled}
      onClick={props.onClick}
      className={cn(
        baseStyles,
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100",
        className
      )}
    >
      {props.icon && props.icon}
      {props.loading ? props.loadingLabel ?? "Loading…" : label}
    </button>
  );
}