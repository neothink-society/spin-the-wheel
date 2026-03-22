"use client"

import { useState, useCallback, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
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
  Copy,
  Check,
  Link2,
  Loader2,
} from "lucide-react"
import { useMountEffect } from "@/hooks/use-mount-effect"

interface Room {
  id: string
  name: string
  admin_code: string
  is_active: boolean
}

interface DbParticipant {
  id: string
  room_id: string
  name: string
  color: string
  is_winner: boolean
}

function toParticipant(p: DbParticipant): Participant {
  return { id: p.id, name: p.name, color: p.color, isWinner: p.is_winner }
}

/**
 * Loading screen shown while room initializes.
 */
function LoadingScreen() {
  return (
    <div className="min-h-dvh bg-background flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  )
}

/**
 * Creates a new room and redirects to admin URL.
 * Uses useMountEffect — runs once on mount, no useEffect.
 */
function RoomCreator() {
  const router = useRouter()
  const supabase = createClient()
  const [error, setError] = useState<string | null>(null)

  useMountEffect(() => {
    async function create() {
      const adminCode = Math.random().toString(36).substring(2, 10).toUpperCase()
      const { data, error } = await supabase
        .from("rooms")
        .insert({ name: "Spin the Wheel", admin_code: adminCode, is_active: true })
        .select()
        .single()

      if (error || !data) {
        setError("Failed to create room. Please refresh.")
        return
      }

      router.replace(`/?room=${data.id}&admin=${adminCode}`)
    }
    create()
  })

  if (error) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-sm">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return <LoadingScreen />
}

/**
 * Main room view — handles admin vs participant roles, real-time sync.
 * Key={roomId} ensures clean mount per room.
 */
function RoomView({ roomId, adminParam }: { roomId: string; adminParam: string | null }) {
  const supabase = createClient()

  const [room, setRoom] = useState<Room | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [name, setName] = useState("")
  const [isJoining, setIsJoining] = useState(false)
  const [spinTarget, setSpinTarget] = useState<{ winnerId: string; spinKey: number } | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [currentWinner, setCurrentWinner] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [copiedParticipant, setCopiedParticipant] = useState(false)
  const [copiedAdmin, setCopiedAdmin] = useState(false)
  const spinKeyRef = useRef(0)

  const isSpinning = spinTarget !== null
  const nonWinners = participants.filter((p) => !p.isWinner)

  // Load room + participants + subscribe to realtime — one-time mount sync
  useMountEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function init() {
      // Load room
      const { data: roomData, error: roomError } = await supabase
        .from("rooms")
        .select("*")
        .eq("id", roomId)
        .single()

      if (roomError || !roomData) {
        setError("Room not found. Please check your link.")
        setIsLoading(false)
        return
      }

      setRoom(roomData)
      if (adminParam === roomData.admin_code) {
        setIsAdmin(true)
      }

      // Load participants
      const loadParticipants = async () => {
        const { data } = await supabase
          .from("participants")
          .select("*")
          .eq("room_id", roomId)
          .order("created_at", { ascending: true })

        if (data) {
          setParticipants(data.map(toParticipant))
        }
      }

      await loadParticipants()

      // Subscribe to real-time changes
      channel = supabase
        .channel(`room:${roomId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "participants",
            filter: `room_id=eq.${roomId}`,
          },
          () => {
            loadParticipants()
          }
        )
        .subscribe()

      setIsLoading(false)
    }

    init()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  })

  const handleJoin = useCallback(async () => {
    const trimmed = name.trim()
    if (!trimmed || !roomId || isJoining) return

    if (trimmed.length < 2) {
      setError("Name must be at least 2 characters.")
      return
    }
    if (trimmed.length > 20) {
      setError("Name must be 20 characters or less.")
      return
    }

    setIsJoining(true)
    setError(null)

    // Check for duplicate name
    const { data: existing } = await supabase
      .from("participants")
      .select("id")
      .eq("room_id", roomId)
      .eq("name", trimmed)
      .single()

    if (existing) {
      setError("This name is already taken.")
      setIsJoining(false)
      return
    }

    const color = SLICE_PALETTE[participants.length % SLICE_PALETTE.length]

    const { error: insertError } = await supabase.from("participants").insert({
      room_id: roomId,
      name: trimmed,
      color,
      is_winner: false,
    })

    if (insertError) {
      setError("Failed to join. Please try again.")
      setIsJoining(false)
      return
    }

    setName("")
    setIsJoining(false)
  }, [name, roomId, isJoining, participants.length, supabase])

  async function handleSpin() {
    if (!roomId || participants.length === 0 || isSpinning) return
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

    // Record spin and mark winner in DB
    await supabase.from("spins").insert({
      room_id: roomId,
      winner_id: winner.id,
      winner_name: winner.name,
    })
    await supabase.from("participants").update({ is_winner: true }).eq("id", winner.id)
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

  async function handleManualPick() {
    if (!roomId || participants.length === 0) return
    if (nonWinners.length === 0) {
      setError("Everyone has won. Reset winners first.")
      return
    }

    setError(null)
    const winner = nonWinners[Math.floor(Math.random() * nonWinners.length)]

    await supabase.from("participants").update({ is_winner: true }).eq("id", winner.id)
    await supabase.from("spins").insert({
      room_id: roomId,
      winner_id: winner.id,
      winner_name: winner.name,
    })

    setParticipants((prev) =>
      prev.map((p) => (p.id === winner.id ? { ...p, isWinner: true } : p))
    )
    setCurrentWinner(winner.name)
    setShowConfetti(true)
  }

  async function handleReset() {
    if (!roomId) return
    await supabase.from("participants").update({ is_winner: false }).eq("room_id", roomId)
    setParticipants((prev) => prev.map((p) => ({ ...p, isWinner: false })))
    setCurrentWinner(null)
    setShowConfetti(false)
    setSpinTarget(null)
  }

  async function handleClearAll() {
    if (!roomId) return
    await supabase.from("participants").delete().eq("room_id", roomId)
    setParticipants([])
    setCurrentWinner(null)
    setShowConfetti(false)
    setSpinTarget(null)
    setError(null)
  }

  async function handleRemoveParticipant(id: string) {
    await supabase.from("participants").delete().eq("id", id)
    const removed = participants.find((p) => p.id === id)
    setParticipants((prev) => prev.filter((p) => p.id !== id))
    if (removed?.name === currentWinner) {
      setCurrentWinner(null)
      setShowConfetti(false)
    }
  }

  function copyToClipboard(text: string, type: "participant" | "admin") {
    navigator.clipboard.writeText(text)
    if (type === "participant") {
      setCopiedParticipant(true)
      setTimeout(() => setCopiedParticipant(false), 2000)
    } else {
      setCopiedAdmin(true)
      setTimeout(() => setCopiedAdmin(false), 2000)
    }
  }

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/?room=${roomId}` : ""
  const adminUrl =
    typeof window !== "undefined" && room
      ? `${window.location.origin}/?room=${roomId}&admin=${room.admin_code}`
      : ""

  if (isLoading) return <LoadingScreen />

  if (error && !room) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-sm">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
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
            {isAdmin && (
              <span className="text-[10px] uppercase tracking-widest text-red-500 font-semibold bg-red-500/10 px-1.5 py-0.5 rounded">
                Admin
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground hidden sm:block tabular-nums">
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

                {/* Admin controls — only visible to admin */}
                {isAdmin && (
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
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4 order-1 lg:order-2">
            {/* Add participant — visible to everyone */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  <Plus className="w-3.5 h-3.5" />
                  Join the Wheel
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                <Input
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  className="h-10 text-sm"
                  maxLength={20}
                  autoComplete="off"
                  disabled={isJoining}
                />
                <Button
                  onClick={handleJoin}
                  className="w-full h-9 bg-red-600 hover:bg-red-700 text-white font-medium text-sm transition-colors"
                  disabled={!name.trim() || isJoining}
                >
                  {isJoining ? "Joining\u2026" : "Join"}
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
                  {isAdmin && participants.length > 0 && (
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
                      {isAdmin && (
                        <button
                          onClick={() => handleRemoveParticipant(participant.id)}
                          className="text-muted-foreground/50 hover:text-red-500 shrink-0 ml-1 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  {participants.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground/60">
                      <p className="text-sm">Waiting for participants\u2026</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Share links — admin sees both, participants see participant link */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  <Link2 className="w-3.5 h-3.5" />
                  Share
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-medium">
                    Participant link
                  </label>
                  <div className="flex gap-1.5">
                    <Input
                      value={shareUrl}
                      readOnly
                      className="h-8 text-xs flex-1 min-w-0"
                      onClick={(e) => e.currentTarget.select()}
                    />
                    <Button
                      variant="outline"
                      size="icon-xs"
                      onClick={() => copyToClipboard(shareUrl, "participant")}
                      className="shrink-0"
                    >
                      {copiedParticipant ? (
                        <Check className="w-3 h-3 text-green-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                </div>
                {isAdmin && (
                  <div className="space-y-1.5">
                    <label className="text-xs text-red-500 font-medium">
                      Admin link (keep private)
                    </label>
                    <div className="flex gap-1.5">
                      <Input
                        value={adminUrl}
                        readOnly
                        className="h-8 text-xs flex-1 min-w-0 border-red-500/20"
                        onClick={(e) => e.currentTarget.select()}
                      />
                      <Button
                        variant="outline"
                        size="icon-xs"
                        onClick={() => copyToClipboard(adminUrl, "admin")}
                        className="shrink-0"
                      >
                        {copiedAdmin ? (
                          <Check className="w-3 h-3 text-green-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}

/**
 * Router: no roomId → create room. Has roomId → load room view.
 * Conditional mounting eliminates useEffect for room init logic.
 */
function WheelRouter() {
  const searchParams = useSearchParams()
  const roomId = searchParams.get("room")
  const adminParam = searchParams.get("admin")

  if (!roomId) {
    return <RoomCreator />
  }

  return <RoomView key={roomId} roomId={roomId} adminParam={adminParam} />
}

export default function WheelContentWrapper() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <WheelRouter />
    </Suspense>
  )
}
