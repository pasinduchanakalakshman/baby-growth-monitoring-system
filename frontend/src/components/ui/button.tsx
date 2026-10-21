import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-btn-primary text-btn-primary-foreground shadow-control hover:bg-btn-primary-hover active:bg-btn-primary-active focus-visible:ring-btn-primary",
        prediction:
          "bg-btn-prediction text-btn-prediction-foreground shadow-control hover:bg-btn-prediction-hover active:bg-btn-prediction-active focus-visible:ring-btn-prediction",
        destructive:
          "bg-destructive text-destructive-foreground shadow-control hover:bg-destructive-hover focus-visible:ring-destructive",
        outline:
          "border border-input bg-card text-card-foreground shadow-control hover:bg-accent hover:text-accent-foreground focus-visible:ring-btn-primary",
        secondary:
          "bg-secondary text-secondary-foreground shadow-control hover:bg-secondary/80 focus-visible:ring-btn-primary",
        ghost: "hover:bg-accent hover:text-accent-foreground focus-visible:ring-btn-primary",
        link: "text-btn-primary underline-offset-4 hover:text-btn-primary-hover hover:underline focus-visible:ring-btn-primary",
        "prediction-link":
          "text-btn-prediction underline-offset-4 hover:text-btn-prediction-hover hover:underline focus-visible:ring-btn-prediction",
      },
      size: {
        default: "h-control px-4 py-2",
        sm: "h-control-sm rounded-md px-3 text-xs",
        lg: "h-control-lg rounded-md px-8",
        icon: "h-control w-control",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
