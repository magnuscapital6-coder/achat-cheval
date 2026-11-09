import { motion } from 'motion/react'
import { Loader2 } from 'lucide-react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { Link } from 'react-router'

import { cx } from '../lib/cx'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'md' | 'lg' | 'sm'

const base =
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,color,transform,border-color] duration-200 active:scale-[0.985] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0'
const variants: Record<Variant, string> = {
  primary: 'bg-fg text-bg hover:bg-[#33302b]',
  secondary: 'border border-line-strong bg-transparent text-fg hover:border-fg',
  ghost: 'text-muted hover:text-fg',
}
// Heights pair with inputs: sm 40, md 48, lg 56.
const sizes: Record<Size, string> = {
  sm: 'h-10 rounded-[12px] px-4 text-[14px]',
  md: 'h-12 rounded-control px-6 text-[15px]',
  lg: 'h-14 rounded-[16px] px-7 text-[16px]',
}

type Props = { variant?: Variant; size?: Size; className?: string; children: ReactNode; loading?: boolean }

export function Button({ variant = 'primary', size = 'md', className, children, loading, ...rest }: Props & ComponentPropsWithoutRef<'button'>) {
  return (
    <button type="button" className={cx(base, variants[variant], sizes[size], className)} disabled={loading || rest.disabled} {...rest}>
      {loading ? <Loader2 className="animate-spin" /> : children}
    </button>
  )
}

export function ButtonLink({ variant = 'primary', size = 'md', className, children, to, ...rest }: Props & { to: string } & Omit<ComponentPropsWithoutRef<typeof Link>, 'to'>) {
  return (
    <Link to={to} className={cx(base, variants[variant], sizes[size], className)} {...rest}>
      {children}
    </Link>
  )
}

export function ButtonAnchor({ variant = 'primary', size = 'md', className, children, ...rest }: Props & ComponentPropsWithoutRef<'a'>) {
  return (
    <a className={cx(base, variants[variant], sizes[size], className)} {...rest}>
      {children}
    </a>
  )
}

export const inputClass =
  'h-12 w-full min-w-0 rounded-control border border-line-strong bg-surface px-4 text-[15px] text-fg placeholder:text-faint transition-colors focus:border-fg focus:outline-none'

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('mx-auto w-full max-w-[1280px] px-5 sm:px-8', className)}>{children}</div>
}

export function Reveal({ children, delay = 0, className, y = 20 }: { children: ReactNode; delay?: number; className?: string; y?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -8% 0px' }}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

export function SectionTitle({ eyebrow, title, action, className }: { eyebrow?: string; title: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex items-end justify-between gap-6', className)}>
      <div>
        {eyebrow && <p className="mb-2 text-[13px] text-muted">{eyebrow}</p>}
        <h2 className="font-display text-balance text-[36px] sm:text-[44px]">{title}</h2>
      </div>
      {action}
    </div>
  )
}

export function Stepper({ value, onChange, min = 1, className }: { value: number; onChange: (v: number) => void; min?: number; className?: string }) {
  return (
    <div className={cx('grid h-12 grid-cols-[48px_1fr_48px] items-center rounded-control border border-line-strong text-[15px]', className)}>
      <button type="button" aria-label="Diminuer" onClick={() => onChange(Math.max(min, value - 1))} className="h-full rounded-l-control text-muted transition-colors hover:text-fg">
        −
      </button>
      <span className="text-center tabular-nums">{value}</span>
      <button type="button" aria-label="Augmenter" onClick={() => onChange(value + 1)} className="h-full rounded-r-control text-muted transition-colors hover:text-fg">
        +
      </button>
    </div>
  )
}
