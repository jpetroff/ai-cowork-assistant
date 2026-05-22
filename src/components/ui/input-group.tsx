'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

function InputGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='input-group'
      role='group'
      className={cn(
        'group/input-group relative flex h-control-md w-full min-w-0 items-center rounded-control border border-input bg-input/20 transition-colors outline-none in-data-[slot=combobox-content]:focus-within:border-inherit in-data-[slot=combobox-content]:focus-within:ring-0 has-data-[align=block-end]:rounded-control has-data-[align=block-start]:rounded-control has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-2 has-[[data-slot=input-group-control]:focus-visible]:ring-ring/30 has-[[data-slot][aria-invalid=true]]:border-destructive has-[[data-slot][aria-invalid=true]]:ring-2 has-[[data-slot][aria-invalid=true]]:ring-destructive/20 has-[textarea]:rounded-control has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>textarea]:h-auto dark:bg-input/30 dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40 has-[>[data-align=block-end]]:[&>input]:pt-3 has-[>[data-align=block-start]]:[&>input]:pb-3 has-[>[data-align=inline-end]]:[&>input]:pr-2 has-[>[data-align=inline-start]]:[&>input]:pl-2',
        className
      )}
      {...props}
    />
  )
}

const inputGroupAddonVariants = cva(
  "flex h-auto cursor-text items-center justify-center gap-1 py-control-y-md type-ui-sm font-medium text-muted-foreground select-none group-data-[disabled=true]/input-group:opacity-50 **:data-[slot=kbd]:rounded-control **:data-[slot=kbd]:bg-muted-foreground/10 **:data-[slot=kbd]:px-1 **:data-[slot=kbd]:type-ui-xs [&>svg:not([class*='size-'])]:size-icon-sm",
  {
    variants: {
      align: {
        'inline-start':
          'order-first pl-control-x-sm has-[>button]:ml-[-0.275rem] has-[>kbd]:ml-[-0.275rem]',
        'inline-end':
          'order-last pr-control-x-sm has-[>button]:mr-[-0.275rem] has-[>kbd]:mr-[-0.275rem]',
        'block-start':
          'order-first w-full justify-start px-control-x-sm pt-control-y-md group-has-[>input]/input-group:pt-control-y-md [.border-b]:pb-control-y-md',
        'block-end':
          'order-last w-full justify-start px-control-x-sm pb-control-y-md group-has-[>input]/input-group:pb-control-y-md [.border-t]:pt-control-y-md',
      },
    },
    defaultVariants: {
      align: 'inline-start',
    },
  }
)

function InputGroupAddon({
  className,
  align = 'inline-start',
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    <div
      role='group'
      data-slot='input-group-addon'
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) {
          return
        }
        e.currentTarget.parentElement?.querySelector('input')?.focus()
      }}
      {...props}
    />
  )
}

const inputGroupButtonVariants = cva(
  'flex items-center gap-2 rounded-control type-ui-sm shadow-none',
  {
    variants: {
      size: {
        xs: "h-control-xs gap-1 px-2 type-ui-xs [&>svg:not([class*='size-'])]:size-icon-sm",
        sm: 'gap-1',
        'icon-xs': 'size-control-xs p-0 has-[>svg]:p-0',
        'icon-sm': 'size-control-sm p-0 has-[>svg]:p-0',
      },
    },
    defaultVariants: {
      size: 'xs',
    },
  }
)

function InputGroupButton({
  className,
  type = 'button',
  variant = 'ghost',
  size = 'xs',
  ...props
}: Omit<React.ComponentProps<typeof Button>, 'size' | 'type'> &
  VariantProps<typeof inputGroupButtonVariants> & {
    type?: 'button' | 'submit' | 'reset'
  }) {
  return (
    <Button
      type={type}
      data-size={size}
      variant={variant}
      className={cn(inputGroupButtonVariants({ size }), className)}
      {...props}
    />
  )
}

function InputGroupText({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        "flex items-center gap-2 type-ui-sm text-muted-foreground [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-icon-md",
        className
      )}
      {...props}
    />
  )
}

function InputGroupInput({
  className,
  ...props
}: React.ComponentProps<'input'>) {
  return (
    <Input
      data-slot='input-group-control'
      className={cn(
        'flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 aria-invalid:ring-0 dark:bg-transparent',
        className
      )}
      {...props}
    />
  )
}

function InputGroupTextarea({
  className,
  ...props
}: React.ComponentProps<'textarea'>) {
  return (
    <Textarea
      data-slot='input-group-control'
      className={cn(
        'flex-1 resize-none rounded-none border-0 bg-transparent py-control-y-md shadow-none ring-0 focus-visible:ring-0 aria-invalid:ring-0 dark:bg-transparent',
        className
      )}
      {...props}
    />
  )
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
}
