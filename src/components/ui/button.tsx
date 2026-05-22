'use client'

import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-control border border-transparent bg-clip-padding type-ui-md font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-icon-md",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/80',
        outline:
          'border-border hover:bg-input/50 hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:bg-input/30',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground',
        ghost:
          'hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50',
        destructive:
          'bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default:
          'h-control-md gap-1.5 px-control-x-md has-data-[icon=inline-end]:pr-control-x-sm has-data-[icon=inline-start]:pl-control-x-sm',
        xs: "h-control-xs gap-1 rounded-control px-control-x-sm type-ui-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-icon-sm",
        sm: "h-control-sm gap-1.5 px-control-x-sm type-ui-sm has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-icon-sm",
        lg: "h-control-lg gap-2 px-control-x-lg type-ui-lg has-data-[icon=inline-end]:pr-control-x-md has-data-[icon=inline-start]:pl-control-x-md [&_svg:not([class*='size-'])]:size-icon-lg",
        icon: "size-control-md [&_svg:not([class*='size-'])]:size-icon-md",
        'icon-xs':
          "size-control-xs rounded-control [&_svg:not([class*='size-'])]:size-icon-sm",
        'icon-sm': "size-control-sm [&_svg:not([class*='size-'])]:size-icon-sm",
        'icon-lg': "size-control-lg [&_svg:not([class*='size-'])]:size-icon-lg",
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot='button'
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
