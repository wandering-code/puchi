import * as React from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { cn } from '@/lib/utils'

const Popover = PopoverPrimitive.Root
const PopoverTrigger = PopoverPrimitive.Trigger
const PopoverAnchor = PopoverPrimitive.Anchor

// `container` — dónde monta el Portal (por defecto document.body). Los
// tokens de color de shadcn viven escopados dentro de .luniteca3-root (ver
// index.css), así que sin pasar el propio nodo raíz como contenedor, el
// menú se renderiza fuera de ese scope y sale sin fondo/color (transparente,
// bordes en negro por defecto del navegador).
const PopoverContent = React.forwardRef(({ className, align = 'center', sideOffset = 8, container, ...props }, ref) => (
  <PopoverPrimitive.Portal container={container}>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'z-50 w-72 rounded-md border border-border bg-card p-4 text-card-foreground shadow-md outline-none',
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor }
