"use client"

import { useState, useCallback, useRef } from "react"
import { SpinWheel, SLICE_PALETTE, type Participant } from "@/components/spin-wheel"
import { Confetti } from "@/components/confetti"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Users,
  Trash2,
  RotateCcw,
  Trophy,
  Plus,
  Zap,
  Dices,
  X,
} from "lucide-react"

export default function WheelContent() {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [name, setName] = useState("")
  const [spinTarget, setSpinTarget] = useState<{
    winnerId: string
    spinKey: number
  } | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [currentWinner, setCurrentWinner] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const spinKeyRef = useRef(0)

  const isSpinning = spinTarget !== null
  const nonWinners = participants.filter((p) => !p.isWinner)

  const handleAddParticipant = useCallback(() => {
    const trimmed = name.trim()
    if (!trimmed) return

    if (trimmed.length < 2) {
      setError("Name must be at least 2 characters.")
      return
    }
    if (trimmed.length > 20) {
      setError("Name must be 20 characters or less.")
      return
    }
    if (
      participants.some(
        (p) => p.name.toLowerCase() === trimmed.toLowerCase()
      )
    ) {
      setError("This name is already taken.")
      return
    }

    setError(null)
    const newParticipant: Participant = {
      id: crypto.randomUUID(),
      name: trimmed,
      color: SLICE_PALETTE[participants.length % SLICE_PALETTE.length],
      isWinner: false,
    }
    setParticipants((prev) => [...prev, newParticipant])
    setName("")
  }, [name, participants])

  function handleSpin() {
    if (participants.length === 0 || isSpinning) return
    if (nonWinners.length === 0) {
      setError("Everyone has won. Reset winners first.")
      return
    }

    setError(null)
    setCurrentWinner(null)
    setShowConfetti(false)

    const winner = nonWinners[Math.floor(Math.random() * nonWinners.length)]
    spinKeyRef.current += 1
    setSpinTarget({ winnerId: winner.id, spinKey: spinKeyRef.current })
  }

  function handleSpinComplete(winnerId: string) {
    setSpinTarget(null)
    setShowConfetti(true)
    const winner = participants.find((p) => p.id === winnerId)
    if (winner) {
      setCurrentWinner(winner.name)
      setParticipants((prev) =>
        prev.map((p) => (p.id === winnerId ? { ...p, isWinner: true } : p))
      )
    }
  }

  function handleManualPick() {
    if (participants.length === 0) return
    if (nonWinners.length === 0) {
      setError("Everyone has won. Reset winners first.")
      return
    }

    setError(null)
    const winner = nonWinners[Math.floor(Math.random() * nonWinners.length)]
    setParticipants((prev) =>
      prev.map((p) => (p.id === winner.id ? { ...p, isWinner: true } : p))
    )
    setCurrentWinner(winner.name)
    setShowConfetti(true)
  }

  function handleReset() {
    setParticipants((prev) => prev.map((p) => ({ ...p, isWinner: false })))
    setCurrentWinner(null)
    setShowConfetti(false)
    setSpinTarget(null)
  }

  function handleClearAll() {
    setParticipants([])
    setCurrentWinner(null)
    setShowConfetti(false)
    setSpinTarget(null)
    setError(null)
  }

  function handleRemoveParticipant(id: string) {
    setParticipants((prev) => prev.filter((p) => p.id !== id))
    const removed = participants.find((p) => p.id === id)
    if (removed?.name === currentWinner) {
      setCurrentWinner(null)
      setShowConfetti(false)
    }
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />

      {/* Header */}
      <header className="border-b border-border/50 px-4 py-4 md:py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-red-600 flex items-center justify-center">
              <Zap className="w-4 h-4 md:w-5 md:h-5 text-white" />
            </div>
            <h1 className="text-lg md:text-xl font-semibold tracking-tight">
              Spin the Wheel
            </h1>
          </div>
          <span className="text-xs text-muted-foreground hidden sm:block">
            {participants.length} participant{participants.length !== 1 ? "s" : ""}
            {nonWinners.length < participants.length &&
              ` \u00b7 ${participants.length - nonWinners.length} winner${
                participants.length - nonWinners.length !== 1 ? "s" : ""
              }`}
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-4 md:py-8">
        {error && (
          <Alert variant="destructive" className="mb-4 md:mb-6 max-w-2xl mx-auto">
            <AlertDescription className="text-sm">{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 md:gap-6">
          {/* Wheel area */}
          <div className="order-2 lg:order-1">
            <Card>
              <CardContent className="p-3 md:p-6">
                <SpinWheel
                  participants={participants}
                  spinTarget={spinTarget}
                  onSpinComplete={handleSpinComplete}
                />

                {/* Winner announcement */}
                {currentWinner && (
                  <div className="mt-4 md:mt-6 text-center animate-in fade-in zoom-in-95 duration-300">
                    <div className="inline-flex items-center gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 px-5 py-3 animate-pulse-glow">
                      <Trophy className="w-5 h-5 text-red-500 shrink-0" />
                      <span className="text-lg md:text-2xl font-bold text-foreground tracking-tight">
                        {currentWinner}
                      </span>
                    </div>
                  </div>
                )}

                {/* Spin button — prominent, below wheel */}
                <div className="mt-4 md:mt-6 flex gap-2 max-w-sm mx-auto">
                  <Button
                    onClick={handleSpin}
                    disabled={isSpinning || participants.length === 0}
                    size="lg"
                    className="flex-1 h-11 md:h-12 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm md:text-base transition-colors disabled:opacity-40"
                  >
                    {isSpinning ? "Spinning\u2026" : "Spin"}
                  </Button>
                  <Button
                    onClick={handleManualPick}
                    disabled={participants.length === 0 || isSpinning}
                    size="lg"
                    variant="outline"
                    className="h-11 md:h-12 px-3"
                    title="Random pick (no animation)"
                  >
                    <Dices className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={handleReset}
                    size="lg"
                    variant="outline"
                    className="h-11 md:h-12 px-3"
                    title="Reset all winners"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4 order-1 lg:order-2">
            {/* Add participant */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  <Plus className="w-3.5 h-3.5" />
                  Add Participant
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                <Input
                  placeholder="Enter a name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddParticipant()}
                  className="h-10 text-sm"
                  maxLength={20}
                  autoComplete="off"
                />
                <Button
                  onClick={handleAddParticipant}
                  className="w-full h-9 bg-red-600 hover:bg-red-700 text-white font-medium text-sm transition-colors"
                  disabled={!name.trim()}
                >
                  Add
                </Button>
              </CardContent>
            </Card>

            {/* Participant list */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    <Users className="w-3.5 h-3.5" />
                    Participants
                    {participants.length > 0 && (
                      <span className="text-foreground/60 tabular-nums">
                        ({participants.length})
                      </span>
                    )}
                  </CardTitle>
                  {participants.length > 0 && (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={handleClearAll}
                      className="text-muted-foreground hover:text-red-500 -mr-1"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Clear
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 max-h-[40vh] md:max-h-[50vh] overflow-y-auto -mx-1 px-1">
                  {participants.map((participant) => (
                    <div
                      key={participant.id}
                      className="flex items-center justify-between py-2 px-2.5 -mx-0.5 rounded-md hover:bg-muted/50 transition-colors group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: participant.color }}
                        />
                        <span
                          className={`truncate text-sm ${
                            participant.isWinner
                              ? "text-muted-foreground line-through"
                              : "text-foreground"
                          }`}
                        >
                          {participant.name}
                        </span>
                        {participant.isWinner && (
                          <Trophy className="w-3 h-3 text-red-500 shrink-0" />
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveParticipant(participant.id)}
                        className="text-muted-foreground/50 hover:text-red-500 shrink-0 ml-1 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity md:opacity-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {participants.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground/60">
                      <p className="text-sm">No participants yet</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
