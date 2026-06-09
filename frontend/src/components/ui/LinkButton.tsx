import { Link } from "react-router-dom";
import { cn } from "../../lib/utils";

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

// in Button.tsx — match px-6 py-2.5 across both
const baseStyles =
  "inline-flex items-center justify-center text-sm font-medium px-6 py-2.5 rounded-lg transition-colors duration-150 bg-neutral-900 hover:bg-neutral-700 active:opacity-80 text-white cursor-pointer";

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
        "disabled:opacity-40 disabled:cursor-not-allowed",
        className
      )}
    >
      {props.icon && props.icon}
      {props.loading ? props.loadingLabel ?? "Loading…" : label}
    </button>
  );
}