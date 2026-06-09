import { useId } from 'react'

interface MobSecLogoProps {
  size?: number
  className?: string
}

/**
 * MobSec Studio logomark.
 *
 * A premium two-layer shield — outer body + concentric inner border — with a
 * subtle top-highlight that gives it metallic depth. Renders as inline SVG so
 * it adapts to light/dark mode via CSS variables and scales without blurring.
 */
export function MobSecLogo({ size = 24, className }: MobSecLogoProps): JSX.Element {
  const uid = useId().replace(/:/g, '')
  const bodyId  = `ms-sb-${uid}`
  const shineId = `ms-ss-${uid}`
  const clipId  = `ms-sc-${uid}`
  const innerBorderId = `ms-ib-${uid}`

  // All paths are designed in a 60×60 viewBox.
  // The shield spans x: 7–53, y: 5–57 (46×52 px inside 60×60 canvas).
  const OUTER  = 'M30,5 C38,5 53,11 53,16 L53,33 Q53,50 30,57 Q7,50 7,33 L7,16 C7,11 22,5 30,5 Z'
  // Inner border inset 5 px from outer:
  const INNER  = 'M30,10 C36,10 48,14 48,19 L48,32 Q48,46 30,52 Q12,46 12,32 L12,19 C12,14 24,10 30,10 Z'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 60 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="MobSec Studio"
      role="img"
    >
      <defs>
        {/* Shield body: primary at top, dimmer toward bottom */}
        <linearGradient id={bodyId} x1="30" y1="5" x2="30" y2="57" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="hsl(var(--primary))" stopOpacity="1"   />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
        </linearGradient>
        {/* Top highlight: white fade for metallic sheen */}
        <linearGradient id={shineId} x1="30" y1="5" x2="30" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="white" stopOpacity="0.20" />
          <stop offset="100%" stopColor="white" stopOpacity="0"    />
        </linearGradient>
        {/* Inner concentric border gradient */}
        <linearGradient id={innerBorderId} x1="30" y1="10" x2="30" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="hsl(var(--primary))" stopOpacity="0.9" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
        </linearGradient>
        {/* Clip to shield shape so shine rect stays inside */}
        <clipPath id={clipId}>
          <path d={OUTER} />
        </clipPath>
      </defs>

      {/* Shield body */}
      <path d={OUTER} fill={`url(#${bodyId})`} />

      {/* Outer edge — thin bright stroke */}
      <path d={OUTER} fill="none" stroke={`url(#${bodyId})`} strokeWidth={0.8} strokeOpacity={0.7} />

      {/* Concentric inner border — the "badge" layer that makes it premium */}
      <path d={INNER} fill="none" stroke={`url(#${innerBorderId})`} strokeWidth={1} />

      {/* Top-of-shield metallic shine (clipped) */}
      <rect x="7" y="5" width="46" height="14" fill={`url(#${shineId})`} clipPath={`url(#${clipId})`} />
    </svg>
  )
}

/**
 * Compact icon variant — identical design, isolated gradient IDs so it can
 * coexist with MobSecLogo on the same page (e.g., TitleBar + Settings).
 */
export function MobSecIcon({ size = 16, className }: MobSecLogoProps): JSX.Element {
  const uid = useId().replace(/:/g, '')
  const bodyId  = `ms-ib-${uid}`
  const shineId = `ms-is-${uid}`
  const clipId  = `ms-ic-${uid}`
  const innerBorderId = `ms-ii-${uid}`

  const OUTER = 'M30,5 C38,5 53,11 53,16 L53,33 Q53,50 30,57 Q7,50 7,33 L7,16 C7,11 22,5 30,5 Z'
  const INNER = 'M30,10 C36,10 48,14 48,19 L48,32 Q48,46 30,52 Q12,46 12,32 L12,19 C12,14 24,10 30,10 Z'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 60 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={bodyId} x1="30" y1="5" x2="30" y2="57" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="hsl(var(--primary))" stopOpacity="1"   />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.65"/>
        </linearGradient>
        <linearGradient id={shineId} x1="30" y1="5" x2="30" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="white" stopOpacity="0.22" />
          <stop offset="100%" stopColor="white" stopOpacity="0"    />
        </linearGradient>
        <linearGradient id={innerBorderId} x1="30" y1="10" x2="30" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="hsl(var(--primary))" stopOpacity="0.9" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
        </linearGradient>
        <clipPath id={clipId}>
          <path d={OUTER} />
        </clipPath>
      </defs>

      <path d={OUTER} fill={`url(#${bodyId})`} />
      <path d={OUTER} fill="none" stroke={`url(#${bodyId})`} strokeWidth={0.8} strokeOpacity={0.7} />
      <path d={INNER} fill="none" stroke={`url(#${innerBorderId})`} strokeWidth={1} />
      <rect x="7" y="5" width="46" height="14" fill={`url(#${shineId})`} clipPath={`url(#${clipId})`} />
    </svg>
  )
}
