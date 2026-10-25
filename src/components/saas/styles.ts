import { buttonVariants } from "@/components/ui/button";

// Client-safe button class strings (chrome.tsx is server-only).
export const bigButtonClass = buttonVariants({ className: "h-11 px-5 text-[0.95rem] rounded-md" });
export const bigButtonSecondaryClass = buttonVariants({
  variant: "secondary",
  className: "h-11 px-5 text-[0.95rem] rounded-md",
});
export const bigButtonOutlineClass = buttonVariants({
  variant: "outline",
  className: "h-11 px-5 text-[0.95rem] rounded-md",
});
