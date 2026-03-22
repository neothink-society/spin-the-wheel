"use client"

import { useRef, useState } from "react"
import { Users } from "lucide-react"
import { useMountEffect } from "@/hooks/use-mount-effect"

export interface Participant {
  id: string
  name: string
  color: string
  isWinner: boolean
}

interface SpinWheelProps {
  participants: Participant[]
  onSpinComplete?: (winnerId: string) => void
  spinTarget: { winnerId: string; spinKey: number } | null
}

/**
 * Wheel slice colors — alternating warm/cool grays with red accent.
 * Designed for high contrast text readability on a dark background.
 */
const SLICE_PALETTE = [
  "#dc2626", // red-600
  "#3f3f46", // zinc-700
  "#a1a1aa", // zinc-400
  "#52525b", // zinc-600
  "#ef4444", // red-500
  "#71717a", // zinc-500
  "#27272a", // zinc-800
  "#d4d4d8", // zinc-300
  "#b91c1c", // red-700
  "#a1a1aa", // zinc-400
]

/**
 * Pure function: draws the wheel state to a canvas.
 */
function drawWheel(
  canvas: HTMLCanvasElement,
  participants: Participant[],
  rotationDeg: number
) {
  const ctx = canvas.getContext("2d")
  if (!ctx || participants.length === 0) return

  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1
  const size = Math.min(canvas.clientWidth, 600)
  canvas.width = size * dpr
  canvas.height = size * dpr
  ctx.scale(dpr, dpr)

  const centerX = size / 2
  const centerY = size / 2
  const radius = Math.min(centerX, centerY) - 20

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Subtle outer ring
  ctx.beginPath()
  ctx.arc(centerX, centerY, radius + 6, 0, 2 * Math.PI)
  ctx.strokeStyle = "rgba(255, 255, 255, 0.06)"
  ctx.lineWidth = 12
  ctx.stroke()

  // Draw slices
  ctx.save()
  ctx.translate(centerX, centerY)
  ctx.rotate((rotationDeg * Math.PI) / 180)

  const sliceAngle = (2 * Math.PI) / participants.length

  for (let index = 0; index < participants.length; index++) {
    const participant = participants[index]
    const startAngle = index * sliceAngle
    const endAngle = startAngle + sliceAngle

    // Slice fill
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.arc(0, 0, radius, startAngle, endAngle)
    ctx.closePath()
    ctx.fillStyle = participant.color
    ctx.fill()

    // Slice border
    ctx.strokeStyle = "rgba(0, 0, 0, 0.4)"
    ctx.lineWidth = 2
    ctx.stroke()

    // Name label
    ctx.save()
    ctx.rotate(startAngle + sliceAngle / 2)
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"

    // Determine text color based on slice brightness
    const isLightSlice = ["#a1a1aa", "#d4d4d8"].includes(participant.color)
    ctx.fillStyle = isLightSlice ? "#18181b" : "#fafafa"

    const fontSize = Math.max(13, Math.min(18, radius / 16))
    ctx.font = `600 ${fontSize}px Inter, system-ui, -apple-system, sans-serif`
    ctx.shadowColor = isLightSlice
      ? "rgba(255, 255, 255, 0.5)"
      : "rgba(0, 0, 0, 0.7)"
    ctx.shadowBlur = 4
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0

    const maxLength = Math.max(10, Math.floor(radius / 25))
    const displayName =
      participant.name.length > maxLength
        ? participant.name.substring(0, maxLength - 1) + "\u2026"
        : participant.name

    ctx.fillText(displayName, radius * 0.6, 0)
    ctx.restore()
  }

  ctx.restore()

  // Center hub — dark with subtle ring
  ctx.beginPath()
  ctx.arc(centerX, centerY, 24, 0, 2 * Math.PI)
  ctx.fillStyle = "#18181b"
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)"
  ctx.shadowBlur = 12
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)"
  ctx.lineWidth = 2
  ctx.stroke()

  // Inner dot
  ctx.beginPath()
  ctx.arc(centerX, centerY, 6, 0, 2 * Math.PI)
  ctx.fillStyle = "#dc2626"
  ctx.fill()

  // Pointer triangle (right side) — red
  ctx.beginPath()
  ctx.moveTo(centerX + radius + 8, centerY)
  ctx.lineTo(centerX + radius - 28, centerY - 16)
  ctx.lineTo(centerX + radius - 28, centerY + 16)
  ctx.closePath()
  ctx.fillStyle = "#dc2626"
  ctx.shadowColor = "rgba(220, 38, 38, 0.4)"
  ctx.shadowBlur = 10
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.strokeStyle = "#18181b"
  ctx.lineWidth = 2
  ctx.stroke()
}

function StaticWheel({
  participants,
  rotation,
}: {
  participants: Participant[]
  rotation: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useMountEffect(() => {
    if (canvasRef.current) {
      drawWheel(canvasRef.current, participants, rotation)
    }
  })

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={600}
      className="max-w-full h-auto w-full"
      style={{ maxHeight: "600px", maxWidth: "600px" }}
    />
  )
}

function AnimatedWheel({
  participants,
  winnerId,
  startRotation,
  onComplete,
}: {
  participants: Participant[]
  winnerId: string
  startRotation: number
  onComplete: (winnerId: string, finalRotation: number) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useMountEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const winnerIndex = participants.findIndex((p) => p.id === winnerId)
    if (winnerIndex === -1) return

    const sliceAngle = 360 / participants.length
    const targetAngle = 360 - (winnerIndex * sliceAngle + sliceAngle / 2)
    const spinRotations = 5 * 360
    const finalRotation = startRotation + spinRotations + targetAngle

    const duration = 4500
    const startTime = Date.now()
    let animationId: number

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const easeOut = 1 - Math.pow(1 - progress, 4)
      const currentRotation =
        startRotation + (finalRotation - startRotation) * easeOut

      drawWheel(canvas, participants, currentRotation % 360)

      if (progress < 1) {
        animationId = requestAnimationFrame(animate)
      } else {
        onComplete(winnerId, currentRotation)
      }
    }

    animationId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationId)
  })

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={600}
      className="max-w-full h-auto w-full"
      style={{ maxHeight: "600px", maxWidth: "600px" }}
    />
  )
}

export { SLICE_PALETTE }

export function SpinWheel({
  participants,
  spinTarget,
  onSpinComplete,
}: SpinWheelProps) {
  const lastRotationRef = useRef(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const lastSpinKeyRef = useRef<number | null>(null)

  const shouldAnimate =
    spinTarget !== null && spinTarget.spinKey !== lastSpinKeyRef.current

  if (shouldAnimate && !isAnimating) {
    lastSpinKeyRef.current = spinTarget.spinKey
    setIsAnimating(true)
  }

  function handleAnimationComplete(winnerId: string, finalRotation: number) {
    lastRotationRef.current = finalRotation % 360
    setIsAnimating(false)
    onSpinComplete?.(winnerId)
  }

  if (participants.length === 0) {
    return (
      <div className="flex items-center justify-center w-full min-h-[300px] md:min-h-[500px]">
        <div className="text-center space-y-3 max-w-xs px-6">
          <Users className="w-12 h-12 mx-auto text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">
            Add some names to get started
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center w-full">
      {isAnimating && spinTarget ? (
        <AnimatedWheel
          key={spinTarget.spinKey}
          participants={participants}
          winnerId={spinTarget.winnerId}
          startRotation={lastRotationRef.current}
          onComplete={handleAnimationComplete}
        />
      ) : (
        <StaticWheel
          key={`static-${participants.length}-${lastRotationRef.current}`}
          participants={participants}
          rotation={lastRotationRef.current}
        />
      )}
    </div>
  )
}
