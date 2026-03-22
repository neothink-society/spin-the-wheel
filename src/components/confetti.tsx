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
  "#dc2626",
  "#ef4444",
  "#f87171",
  "#a1a1aa",
  "#71717a",
  "#d4d4d8",
  "#fecaca",
  "#52525b",
]
const SHAPES: Array<"square" | "circle" | "rect"> = [
  "square",
  "circle",
  "rect",
]

function generateParticles(): ConfettiParticle[] {
  return Array.from({ length: 80 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    rotation: Math.random() * 360,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    delay: Math.random() * 0.3,
    drift: (Math.random() - 0.5) * 2,
    size: Math.random() * 6 + 4,
    shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
  }))
}

function ConfettiParticles({ onComplete }: { onComplete?: () => void }) {
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
                  ? "1px"
                  : "0",
            "--confetti-drift": particle.drift,
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
}

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
