"use client"

import { useState, useCallback, useRef } from "react"
import { SpinWheel, type Participant } from "@/components/spin-wheel"
import { Confetti } from "@/components/confetti"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Sparkles,
  Users,
  Trash2,
  RotateCcw,
  Crown,
} from "lucide-react"

const COLORS = [
  "#FF0080",
  "#00D9FF",
  "#FFD700",
  "#FF6B9D",
  "#4ECDC4",
  "#9D4EDD",
  "#F72585",
  "#06FFA5",
  "#FF5400",
  "#00BBF9",
]

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

  // Derived state: non-winner participants for next spin
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
    if (participants.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      setError("This name is already taken.")
      return
    }

    setError(null)
    const newParticipant: Participant = {
      id: crypto.randomUUID(),
      name: trimmed,
      color: COLORS[participants.length % COLORS.length],
      isWinner: false,
    }
    setParticipants((prev) => [...prev, newParticipant])
    setName("")
  }, [name, participants])

  function handleSpin() {
    if (participants.length === 0 || isSpinning) return

    if (nonWinners.length === 0) {
      setError("All participants have already won! Reset the wheel first.")
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
      setError("All participants have already won! Reset the wheel first.")
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
    if (currentWinner) {
      const removed = participants.find((p) => p.id === id)
      if (removed?.name === currentWinner) {
        setCurrentWinner(null)
        setShowConfetti(false)
      }
    }
  }

  return (
    <div className="min-h-dvh bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-foreground p-4 md:p-8">
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6 md:mb-12 space-y-2 md:space-y-3">
          <div className="flex items-center justify-center gap-2 md:gap-4">
            <Sparkles className="w-6 h-6 md:w-10 md:h-10 text-pink-500 animate-pulse" />
            <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-extrabold bg-gradient-to-r from-pink-500 via-blue-400 to-yellow-400 bg-clip-text text-transparent text-balance leading-tight">
              Spin the Wheel
            </h1>
            <Sparkles
              className="w-6 h-6 md:w-10 md:h-10 text-blue-400 animate-pulse"
              style={{ animationDelay: "0.5s" }}
            />
          </div>
          <p className="text-sm md:text-lg text-muted-foreground font-medium max-w-2xl mx-auto">
            Add participants and spin to pick a random winner
          </p>
        </div>

        {error && (
          <Alert
            variant="destructive"
            className="mb-4 md:mb-6 max-w-2xl mx-auto border-2 bg-destructive/10"
          >
            <AlertDescription className="text-sm md:text-base font-medium">
              {error}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
          {/* Wheel — full width on mobile, 2/3 on desktop */}
          <div className="lg:col-span-2 order-2 lg:order-1">
            <Card className="bg-zinc-900/70 border-2 border-zinc-800 backdrop-blur-sm shadow-2xl">
              <CardContent className="p-4 md:p-8">
                <SpinWheel
                  participants={participants}
                  spinTarget={spinTarget}
                  onSpinComplete={handleSpinComplete}
                />

                {currentWinner && (
                  <div className="mt-4 md:mt-8 text-center animate-in fade-in zoom-in duration-500">
                    <div className="inline-flex items-center gap-2 md:gap-3 bg-gradient-to-r from-yellow-400/20 via-yellow-300/20 to-yellow-400/20 border-4 border-yellow-400 rounded-2xl px-4 md:px-10 py-3 md:py-5 shadow-lg animate-pulse-glow">
                      <Crown className="w-6 h-6 md:w-9 md:h-9 text-yellow-400 shrink-0 drop-shadow-lg" />
                      <span className="text-xl md:text-4xl font-black text-yellow-400 drop-shadow-lg tracking-wide">
                        {currentWinner}
                      </span>
                      <Crown className="w-6 h-6 md:w-9 md:h-9 text-yellow-400 shrink-0 drop-shadow-lg" />
                    </div>
                    <p className="mt-3 md:mt-4 text-base md:text-xl text-foreground font-semibold">
                      Winner!
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar — stacks above wheel on mobile */}
          <div className="space-y-4 md:space-y-6 order-1 lg:order-2">
            {/* Add participant */}
            <Card className="bg-zinc-900/70 border-2 border-zinc-800 backdrop-blur-sm shadow-xl">
              <CardHeader className="pb-3 md:pb-4 space-y-1 md:space-y-2">
                <CardTitle className="flex items-center gap-2 text-lg md:text-2xl text-foreground">
                  <Users className="w-5 h-5 md:w-6 md:h-6 text-blue-400 shrink-0" />
                  <span className="font-bold">Add Participant</span>
                </CardTitle>
                <CardDescription className="text-xs md:text-base text-muted-foreground font-medium">
                  Enter a name to add to the wheel
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 md:space-y-4">
                <Input
                  placeholder="Name (2-20 characters)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddParticipant()}
                  className="bg-zinc-800/80 border-2 border-zinc-700 text-foreground placeholder:text-muted-foreground/70 text-sm md:text-base h-10 md:h-12 focus-visible:ring-2 focus-visible:ring-pink-500"
                  maxLength={20}
                />
                <Button
                  onClick={handleAddParticipant}
                  className="w-full bg-gradient-to-r from-pink-500 to-blue-500 hover:from-pink-600 hover:to-blue-600 text-white font-bold text-sm md:text-base h-10 md:h-12 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02]"
                  disabled={!name.trim()}
                >
                  Add to Wheel
                </Button>
              </CardContent>
            </Card>

            {/* Participant list */}
            <Card className="bg-zinc-900/70 border-2 border-zinc-800 backdrop-blur-sm shadow-xl">
              <CardHeader className="pb-3 md:pb-4">
                <CardTitle className="flex items-center justify-between text-lg md:text-2xl text-foreground">
                  <span className="font-bold">
                    Participants ({participants.length})
                  </span>
                  {participants.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearAll}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/20 h-8 md:h-9 px-2 md:px-3 font-semibold text-xs md:text-sm"
                    >
                      <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1" />
                      Clear
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-48 md:max-h-72 overflow-y-auto pr-1 md:pr-2">
                  {participants.map((participant) => (
                    <div
                      key={participant.id}
                      className="flex items-center justify-between p-2.5 md:p-3.5 rounded-xl bg-zinc-800/60 hover:bg-zinc-800/80 transition-all duration-200 border border-zinc-700/50 group"
                    >
                      <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                        <div
                          className="w-3.5 h-3.5 md:w-5 md:h-5 rounded-full shrink-0 shadow-lg ring-2 ring-zinc-900"
                          style={{ backgroundColor: participant.color }}
                        />
                        <span className="truncate text-sm md:text-base font-semibold text-foreground">
                          {participant.name}
                        </span>
                        {participant.isWinner && (
                          <Crown className="w-4 h-4 md:w-5 md:h-5 text-yellow-400 shrink-0 drop-shadow" />
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleRemoveParticipant(participant.id)
                        }
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/20 h-7 w-7 md:h-8 md:w-8 p-0 shrink-0 ml-1 md:ml-2 opacity-60 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      </Button>
                    </div>
                  ))}
                  {participants.length === 0 && (
                    <div className="text-center text-muted-foreground py-6 md:py-10 space-y-2 md:space-y-3">
                      <Users className="w-12 h-12 md:w-16 md:h-16 mx-auto opacity-30" />
                      <p className="text-sm md:text-base font-semibold text-foreground/80">
                        No participants yet
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Controls */}
            <Card className="bg-gradient-to-br from-pink-900/30 to-blue-900/30 border-2 border-pink-500/40 backdrop-blur-sm shadow-xl">
              <CardHeader className="pb-3 md:pb-4 space-y-1 md:space-y-2">
                <CardTitle className="flex items-center gap-2 text-lg md:text-2xl text-foreground">
                  <Crown className="w-5 h-5 md:w-6 md:h-6 text-yellow-400 shrink-0" />
                  <span className="font-bold">Controls</span>
                </CardTitle>
                <CardDescription className="text-xs md:text-base text-muted-foreground font-medium">
                  Spin the wheel or pick a winner manually
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 md:space-y-3">
                <Button
                  onClick={handleSpin}
                  disabled={isSpinning || participants.length === 0}
                  className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-bold text-sm md:text-base h-10 md:h-12 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {isSpinning ? "Spinning..." : "Start Spin"}
                </Button>
                <Button
                  onClick={handleManualPick}
                  disabled={participants.length === 0 || isSpinning}
                  variant="outline"
                  className="w-full border-2 border-blue-500/60 hover:bg-blue-500/20 bg-zinc-800/50 text-foreground font-semibold text-sm md:text-base h-10 md:h-12 transition-all duration-200 hover:scale-[1.02] disabled:opacity-50"
                >
                  Manual Pick (No Animation)
                </Button>
                <Button
                  onClick={handleReset}
                  variant="outline"
                  className="w-full border-2 border-zinc-700 hover:bg-zinc-800/80 bg-zinc-800/50 text-foreground font-semibold text-sm md:text-base h-10 md:h-12 transition-all duration-200 hover:scale-[1.02]"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset All Winners
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
