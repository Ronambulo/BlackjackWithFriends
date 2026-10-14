import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

/** Fill for shapes that hide what is behind them; set --icon-cutout to the background underneath */
const CUTOUT = { fill: 'var(--icon-cutout, var(--bg))' }

export function HomeIcon(props: IconProps) {
  return (
    <Icon strokeWidth="1.8" {...props}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
      <path d="M12 11.6c-1.5 1.5-2.8 2.4-2.8 3.7a1.5 1.5 0 0 0 2.8.7 1.5 1.5 0 0 0 2.8-.7c0-1.3-1.3-2.2-2.8-3.7Z" />
      <path d="M12 16.2v2.3" />
    </Icon>
  )
}

export function PodiumIcon(props: IconProps) {
  return (
    <Icon strokeWidth="1.8" {...props}>
      <path d="M4 21v-6h5v6M9 21V11h6v10M15 21v-8h5v8M2.5 21h19" />
      <path d="m12 3 1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2L8.8 5.3 11 5Z" />
    </Icon>
  )
}

export function CardsIcon(props: IconProps) {
  return (
    <Icon strokeWidth="1.8" {...props}>
      <rect x="2.8" y="6" width="10.5" height="14.5" rx="2" transform="rotate(-14 8 13.2)" />
      <g transform="rotate(6 15 10.75)">
        <rect x="9.5" y="3" width="11" height="15.5" rx="2" style={CUTOUT} />
        <path d="M15 7.8c-1.5 1.5-2.8 2.4-2.8 3.7a1.5 1.5 0 0 0 2.8.7 1.5 1.5 0 0 0 2.8-.7c0-1.3-1.3-2.2-2.8-3.7Z" />
        <path d="M15 12.4v2.1" />
      </g>
    </Icon>
  )
}

export function ChatIcon(props: IconProps) {
  return (
    <Icon strokeWidth="1.8" {...props}>
      <path d="M17 9h2a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1v3l-4-3h-3a2 2 0 0 1-2-2v-1" />
      <path
        d="M13 3H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h1v3l4-3h3a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Z"
        style={CUTOUT}
      />
      <path d="M6.5 8h.01M9 8h.01M11.5 8h.01" strokeWidth="2.4" />
    </Icon>
  )
}

/** The player inside a poker chip */
export function UserIcon(props: IconProps) {
  return (
    <Icon strokeWidth="1.8" {...props}>
      <circle cx="12" cy="12" r="9.2" />
      <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4" />
      <circle cx="12" cy="10.2" r="2.4" />
      <path d="M8 16.3a4.6 4.6 0 0 1 8 0" />
    </Icon>
  )
}

export function GearIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </Icon>
  )
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m15 18-6-6 6-6" />
    </Icon>
  )
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  )
}

export function ShareIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
    </Icon>
  )
}

export function MailIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </Icon>
  )
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  )
}

export function MinusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12h14" />
    </Icon>
  )
}

export function SplitIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 20v-7M12 13 6 5M12 13l6-8M6 5v4M6 5h4M18 5v4M18 5h-4" />
    </Icon>
  )
}
