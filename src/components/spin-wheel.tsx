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
 * Pure function: draws the wheel state to a canvas.
 * No React hooks, no side effects — just canvas drawing.
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

  // Outer glow
  ctx.beginPath()
  ctx.arc(centerX, centerY, radius + 10, 0, 2 * Math.PI)
  const glowGradient = ctx.createRadialGradient(
    centerX, centerY, radius,
    centerX, centerY, radius + 10
  )
  glowGradient.addColorStop(0, "rgba(255, 0, 128, 0.5)")
  glowGradient.addColorStop(1, "rgba(0, 217, 255, 0)")
  ctx.fillStyle = glowGradient
  ctx.fill()

  // Draw slices
  ctx.save()
  ctx.translate(centerX, centerY)
  ctx.rotate((rotationDeg * Math.PI) / 180)

  const sliceAngle = (2 * Math.PI) / participants.length

  for (let index = 0; index < participants.length; index++) {
    const participant = participants[index]
    const startAngle = index * sliceAngle
    const endAngle = startAngle + sliceAngle

    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.arc(0, 0, radius, startAngle, endAngle)
    ctx.closePath()

    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius)
    gradient.addColorStop(0, participant.color)
    gradient.addColorStop(1, participant.color + "dd")
    ctx.fillStyle = gradient
    ctx.fill()

    ctx.strokeStyle = "#000000"
    ctx.lineWidth = 4
    ctx.stroke()

    // Name label
    ctx.save()
    ctx.rotate(startAngle + sliceAngle / 2)
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillStyle = "#ffffff"
    const fontSize = Math.max(14, Math.min(20, radius / 15))
    ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`
    ctx.shadowColor = "rgba(0, 0, 0, 1)"
    ctx.shadowBlur = 6
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0

    const maxLength = Math.max(10, Math.floor(radius / 25))
    const displayName =
      participant.name.length > maxLength
        ? participant.name.substring(0, maxLength - 1) + "\u2026"
        : participant.name

    // Triple-draw for strong shadow
    for (let i = 0; i < 3; i++) {
      ctx.fillText(displayName, radius * 0.6, 0)
    }
    ctx.restore()
  }

  ctx.restore()

  // Center button
  const centerGradient = ctx.createRadialGradient(
    centerX, centerY, 0,
    centerX, centerY, 30
  )
  centerGradient.addColorStop(0, "#FFD700")
  centerGradient.addColorStop(1, "#FFA500")

  ctx.beginPath()
  ctx.arc(centerX, centerY, 30, 0, 2 * Math.PI)
  ctx.fillStyle = centerGradient
  ctx.shadowColor = "rgba(255, 215, 0, 0.8)"
  ctx.shadowBlur = 20
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.strokeStyle = "#000000"
  ctx.lineWidth = 4
  ctx.stroke()

  // Pointer triangle (right side)
  ctx.beginPath()
  ctx.moveTo(centerX + radius + 10, centerY)
  ctx.lineTo(centerX + radius - 35, centerY - 20)
  ctx.lineTo(centerX + radius - 35, centerY + 20)
  ctx.closePath()

  const pointerGradient = ctx.createLinearGradient(
    centerX + radius - 35, 0,
    centerX + radius + 10, 0
  )
  pointerGradient.addColorStop(0, "#FF0080")
  pointerGradient.addColorStop(1, "#FF6B9D")
  ctx.fillStyle = pointerGradient
  ctx.shadowColor = "rgba(255, 0, 128, 0.8)"
  ctx.shadowBlur = 15
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.strokeStyle = "#000000"
  ctx.lineWidth = 4
  ctx.stroke()
}

/**
 * Renders the wheel at a fixed rotation. Draws once on mount.
 * Parent uses key={...} to force remount when participants change.
 */
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
      className="max-w-full h-auto w-full drop-shadow-2xl"
      style={{ maxHeight: "600px", maxWidth: "600px" }}
    />
  )
}

/**
 * Animates the wheel from startRotation to the winner's slice.
 * Runs the animation once on mount, calls onComplete when done.
 * Parent mounts this conditionally when a spin is triggered.
 */
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
      className="max-w-full h-auto w-full drop-shadow-2xl"
      style={{ maxHeight: "600px", maxWidth: "600px" }}
    />
  )
}

/**
 * Orchestrates static vs animated wheel rendering.
 * No useEffect — animation is triggered by conditional mounting.
 */
export function SpinWheel({
  participants,
  spinTarget,
  onSpinComplete,
}: SpinWheelProps) {
  const lastRotationRef = useRef(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const lastSpinKeyRef = useRef<number | null>(null)

  // Detect new spin target via derived comparison (not useEffect)
  const shouldAnimate =
    spinTarget !== null &&
    spinTarget.spinKey !== lastSpinKeyRef.current

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
      <div className="flex items-center justify-center w-full min-h-[400px] md:min-h-[600px]">
        <div className="text-center space-y-4 max-w-md px-6">
          <Users className="w-20 h-20 mx-auto text-muted-foreground/30" />
          <div className="space-y-2">
            <p className="text-foreground text-lg md:text-xl font-semibold">
              No participants yet
            </p>
            <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
              Add some names to get started!
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center w-full p-4">
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
