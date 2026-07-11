import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getPasswordVisibilityConfig, togglePasswordVisibility } from "@/lib/password-visibility";

export interface PasswordInputProps
  extends Omit<React.ComponentProps<"input">, "type"> {}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    const visibility = getPasswordVisibilityConfig(visible);
    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visibility.type}
          className={cn("pr-11", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible(togglePasswordVisibility)}
          aria-label={visibility.ariaLabel}
          aria-pressed={visible}
          tabIndex={0}
          className="absolute right-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-md"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
