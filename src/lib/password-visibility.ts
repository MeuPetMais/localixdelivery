export type PasswordInputType = "password" | "text";

export function getPasswordVisibilityConfig(visible: boolean): {
  type: PasswordInputType;
  ariaLabel: "Ocultar senha" | "Mostrar senha";
} {
  return {
    type: visible ? "text" : "password",
    ariaLabel: visible ? "Ocultar senha" : "Mostrar senha",
  };
}

export function togglePasswordVisibility(current: boolean) {
  return !current;
}