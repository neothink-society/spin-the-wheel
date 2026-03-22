"use client"

import { useState } from "react"
import { useMountEffect } from "@/hooks/use-mount-effect"

interface ConfettiParticle {
  id: number
  x: number
  rotation: number
  color: string
  delay: number
  drift: number
  size: number
  shape: "square" | "circle" | "rect"
}

const COLORS = [
  "#FF0080",
  "#00D9FF",
  "#FFD700",
  "#FF6B9D",
  "#4ECDC4",
  "#9D4EDD",
  "#F72585",
  "#06FFA5",
]
const SHAPES: Array<"square" | "circle" | "rect"> = [
  "square",
  "circle",
  "rect",
]

function generateParticles(): ConfettiParticle[] {
  return Array.from({ length: 100 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    rotation: Math.random() * 360,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    delay: Math.random() * 0.3,
    drift: (Math.random() - 0.5) * 2,
    size: Math.random() * 8 + 6,
    shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
  }))
}

/**
 * Renders confetti particles and auto-cleans up after animation.
 * Mounted conditionally by parent — no useEffect needed for activation.
 */
function ConfettiParticles({ onComplete }: { onComplete?: () => void }) {
  // Generate once on mount — useState initializer only runs once
  const [particles] = useState(generateParticles)

  useMountEffect(() => {
    const timer = setTimeout(() => onComplete?.(), 4500)
    return () => clearTimeout(timer)
  })

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute animate-confetti"
          style={{
            left: `${particle.x}%`,
            top: "-10%",
            width: `${particle.size}px`,
            height:
              particle.shape === "rect"
                ? `${particle.size * 1.5}px`
                : `${particle.size}px`,
            backgroundColor: particle.color,
            transform: `rotate(${particle.rotation}deg)`,
            animationDelay: `${particle.delay}s`,
            borderRadius:
              particle.shape === "circle"
                ? "50%"
                : particle.shape === "rect"
                  ? "2px"
                  : "0",
            boxShadow: `0 0 ${particle.size}px ${particle.color}`,
            // CSS variable for drift in animation
            "--confetti-drift": particle.drift,
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
}

/**
 * Confetti wrapper — conditional mounting pattern instead of useEffect.
 * When active=true, ConfettiParticles mounts and runs.
 * When active=false, nothing renders.
 */
export function Confetti({
  active,
  onComplete,
}: {
  active: boolean
  onComplete?: () => void
}) {
  if (!active) return null
  return <ConfettiParticles onComplete={onComplete} />
}
