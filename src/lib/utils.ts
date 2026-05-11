import clsx, { type ClassValue } from "clsx";

/**
 * 类名拼接
 * 用法:cn("base", isActive && "active", { hidden: !visible })
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
