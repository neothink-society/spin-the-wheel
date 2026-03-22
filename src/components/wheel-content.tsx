"use client"

import { useState, useCallback, useRef, Suspense } from "react"
import { useSearchParams } from "next/navigation"
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

function LoadingScreen() {
  return (
    <div className="min-h-dvh bg-background flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  )
}

function LandingPage() {
  const supabase = createClient()
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    if (isCreating) return
    setIsCreating(true)
    setError(null)

    const array = new Uint8Array(6)
    crypto.getRandomValues(array)
    const adminCode = Array.from(array, (b) => b.toString(36).padStart(2, "0"))
      .join("")
      .toUpperCase()
      .slice(0, 8)

    const { data, error: createError } = await supabase
      .from("rooms")
      .insert({ name: "Spin the Wheel", admin_code: adminCode, is_active: true })
      .select("id")
      .single()

    if (createError || !data) {
      setError("Failed to create room. Please try again.")
      setIsCreating(false)
      return
    }

    window.location.href = `${window.location.origin}/?room=${data.id}&admin=${adminCode}`
  }

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col">
      <header className="border-b border-border/50 px-4 py-4 md:py-5">
        <div className="max-w-6xl mx-auto flex items-center gap-2.5">
          <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-red-600 flex items-center justify-center">
            <Zap className="w-4 h-4 md:w-5 md:h-5 text-white" />
          </div>
          <h1 className="text-lg md:text-xl font-semibold tracking-tight">
            Spin the Wheel
          </h1>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="text-center max-w-md space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              Pick a random winner
            </h2>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              Create a room, share the link with participants, and spin the
              wheel to choose a winner.
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleCreate}
            disabled={isCreating}
            size="lg"
            className="h-12 px-8 bg-red-600 hover:bg-red-700 text-white font-semibold text-base transition-colors"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Creating...
              </>
            ) : (
              "Create a Room"
            )}
          </Button>

          <p className="text-xs text-muted-foreground/60">
            You'll get an admin link to control the wheel and a participant
            link to share.
          </p>
        </div>
      </main>
    </div>
  )
}

function RoomView() {
  const searchParams = useSearchParams()
  const supabase = createClient()

  const urlRoomId = searchParams.get("room")
  const urlAdminParam = searchParams.get("admin")

  const [room, setRoom] = useState<Room | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [hasJoined, setHasJoined] = useState(false)
  const [joinedName, setJoinedName] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [isJoining, setIsJoining] = useState(false)
  const [spinTarget, setSpinTarget] = useState<{
    winnerId: string
    spinKey: number
  } | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [currentWinner, setCurrentWinner] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [copiedParticipant, setCopiedParticipant] = useState(false)
  const [copiedAdmin, setCopiedAdmin] = useState(false)
  const spinKeyRef = useRef(0)

  const isSpinning = spinTarget !== null
  const nonWinners = participants.filter((p) => !p.isWinner)

  // Stable key for StaticWheel — changes when participants change
  const participantKey = participants.map((p) => p.id).join(",")

  useMountEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false
    let previousWinnerIds: Set<string> = new Set()

    async function loadParticipants(
      roomId: string,
      detectNewWinner = false
    ) {
      const { data } = await supabase
        .from("participants")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true })

      if (data && !cancelled) {
        const mapped = data.map(toParticipant)
        setParticipants(mapped)

        if (detectNewWinner) {
          const currentWinnerIds = new Set(
            mapped.filter((p) => p.isWinner).map((p) => p.id)
          )
          for (const p of mapped) {
            if (p.isWinner && !previousWinnerIds.has(p.id)) {
              setCurrentWinner(p.name)
              setShowConfetti(true)
              break
            }
          }
          previousWinnerIds = currentWinnerIds
        } else {
          previousWinnerIds = new Set(
            mapped.filter((p) => p.isWinner).map((p) => p.id)
          )
        }
      }
    }

    function subscribeToRoom(roomId: string) {
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
            if (!cancelled) {
              loadParticipants(roomId, true)
            }
          }
        )
        .subscribe()
    }

    async function initExistingRoom(
      roomId: string,
      adminCode: string | null
    ) {
      // Only select columns we need — never expose admin_code to non-admins
      const { data: roomData, error: roomError } = await supabase
        .from("rooms")
        .select("id, name, admin_code, is_active")
        .eq("id", roomId)
        .single()

      if (roomError || !roomData) {
        if (!cancelled) {
          setError("Room not found. Check your link or create a new room.")
          setIsLoading(false)
        }
        return
      }

      if (!cancelled) {
        // Only store admin_code in state if the caller is admin
        const isAdminUser = !!(adminCode && adminCode === roomData.admin_code)
        const roomForState: Room = isAdminUser
          ? roomData
          : { ...roomData, admin_code: "" }

        setRoom(roomForState)
        if (isAdminUser) {
          setIsAdmin(true)
        }

        await loadParticipants(roomId)
        subscribeToRoom(roomId)
        setIsLoading(false)
      }
    }

    if (urlRoomId) {
      const stored = localStorage.getItem(`wheel-joined-${urlRoomId}`)
      if (stored) {
        setHasJoined(true)
        setJoinedName(stored)
      }
      initExistingRoom(urlRoomId, urlAdminParam)
    }

    return () => {
      cancelled = true
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  })

  const handleJoin = useCallback(async () => {
    const trimmed = name.trim()
    if (!trimmed || !room || isJoining) return

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

    const color = SLICE_PALETTE[participants.length % SLICE_PALETTE.length]

    // Rely on DB unique constraint (room_id, name) instead of SELECT-then-INSERT
    const { error: insertError } = await supabase
      .from("participants")
      .insert({
        room_id: room.id,
        name: trimmed,
        color,
        is_winner: false,
      })

    if (insertError) {
      // 23505 = unique_violation (duplicate name)
      if (insertError.code === "23505") {
        setError("This name is already taken.")
      } else {
        setError("Failed to join. Please try again.")
      }
      setIsJoining(false)
      return
    }

    localStorage.setItem(`wheel-joined-${room.id}`, trimmed)
    setHasJoined(true)
    setJoinedName(trimmed)
    setName("")
    setIsJoining(false)
  }, [name, room, isJoining, participants.length, supabase])

  async function handleSpin() {
    if (!isAdmin || !room || participants.length === 0 || isSpinning) return
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

    await supabase.from("spins").insert({
      room_id: room.id,
      winner_id: winner.id,
      winner_name: winner.name,
    })
    await supabase
      .from("participants")
      .update({ is_winner: true })
      .eq("id", winner.id)
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
    if (!isAdmin || !room || participants.length === 0 || isSpinning) return
    if (nonWinners.length === 0) {
      setError("Everyone has won. Reset winners first.")
      return
    }

    setError(null)
    const winner = nonWinners[Math.floor(Math.random() * nonWinners.length)]

    await supabase
      .from("participants")
      .update({ is_winner: true })
      .eq("id", winner.id)
    await supabase.from("spins").insert({
      room_id: room.id,
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
    if (!isAdmin || !room || isSpinning) return
    await supabase
      .from("participants")
      .update({ is_winner: false })
      .eq("room_id", room.id)
    setParticipants((prev) => prev.map((p) => ({ ...p, isWinner: false })))
    setCurrentWinner(null)
    setShowConfetti(false)
    setSpinTarget(null)
  }

  async function handleClearAll() {
    if (!isAdmin || !room || isSpinning) return
    await supabase.from("participants").delete().eq("room_id", room.id)
    setParticipants([])
    setCurrentWinner(null)
    setShowConfetti(false)
    setSpinTarget(null)
    setError(null)
  }

  async function handleRemoveParticipant(id: string) {
    if (!isAdmin || isSpinning) return
    await supabase.from("participants").delete().eq("id", id)
    const removed = participants.find((p) => p.id === id)
    setParticipants((prev) => prev.filter((p) => p.id !== id))
    if (removed?.name === currentWinner) {
      setCurrentWinner(null)
      setShowConfetti(false)
    }
  }

  async function copyToClipboard(
    text: string,
    type: "participant" | "admin"
  ) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Fallback: select the input so user can copy manually
      return
    }
    if (type === "participant") {
      setCopiedParticipant(true)
      setTimeout(() => setCopiedParticipant(false), 2000)
    } else {
      setCopiedAdmin(true)
      setTimeout(() => setCopiedAdmin(false), 2000)
    }
  }

  const shareUrl =
    typeof window !== "undefined" && room
      ? `${window.location.origin}/?room=${room.id}`
      : ""
  const adminUrl =
    typeof window !== "undefined" && room && isAdmin
      ? `${window.location.origin}/?room=${room.id}&admin=${room.admin_code}`
      : ""

  if (isLoading) return <LoadingScreen />

  if (error && !room) {
    return (
      <div className="min-h-dvh bg-background flex flex-col items-center justify-center p-4 gap-4">
        <Alert variant="destructive" className="max-w-sm">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button
          onClick={() => {
            window.location.href = window.location.origin
          }}
          variant="outline"
          size="sm"
        >
          Create New Room
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <Confetti
        active={showConfetti}
        onComplete={() => setShowConfetti(false)}
      />

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
            {participants.length} participant
            {participants.length !== 1 ? "s" : ""}
            {nonWinners.length < participants.length &&
              ` \u00b7 ${participants.length - nonWinners.length} winner${
                participants.length - nonWinners.length !== 1 ? "s" : ""
              }`}
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-4 md:py-8">
        {error && (
          <Alert
            variant="destructive"
            className="mb-4 md:mb-6 max-w-2xl mx-auto"
          >
            <AlertDescription className="text-sm">{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 md:gap-6">
          <div className="order-2 lg:order-1">
            <Card>
              <CardContent className="p-3 md:p-6">
                <SpinWheel
                  key={participantKey}
                  participants={participants}
                  spinTarget={spinTarget}
                  onSpinComplete={handleSpinComplete}
                />

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
                      aria-label="Random pick without animation"
                    >
                      <Dices className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={handleReset}
                      disabled={isSpinning}
                      size="lg"
                      variant="outline"
                      className="h-11 md:h-12 px-3"
                      aria-label="Reset all winners"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {!isAdmin && participants.length > 0 && (
                  <p className="mt-4 text-center text-xs text-muted-foreground">
                    Waiting for the admin to spin the wheel&hellip;
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4 order-1 lg:order-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  <Plus className="w-3.5 h-3.5" />
                  {hasJoined && !isAdmin ? "You\u2019re In" : "Join the Wheel"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {hasJoined && !isAdmin ? (
                  <div className="flex items-center gap-2.5 py-2">
                    <Check className="w-4 h-4 text-green-500 shrink-0" />
                    <p className="text-sm text-foreground">
                      You joined as{" "}
                      <span className="font-semibold">{joinedName}</span>
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <Input
                      placeholder="Enter your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleJoin()
                      }
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
                  </div>
                )}
              </CardContent>
            </Card>

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
                      disabled={isSpinning}
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
                          onClick={() =>
                            handleRemoveParticipant(participant.id)
                          }
                          disabled={isSpinning}
                          aria-label={`Remove ${participant.name}`}
                          className="text-muted-foreground/50 hover:text-red-500 shrink-0 ml-1 p-1 opacity-60 md:opacity-0 md:group-hover:opacity-100 transition-opacity disabled:opacity-20"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  {participants.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground/60">
                      <p className="text-sm">
                        Waiting for participants&hellip;
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

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
                      onClick={() =>
                        copyToClipboard(shareUrl, "participant")
                      }
                      aria-label="Copy participant link"
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
                        onClick={() =>
                          copyToClipboard(adminUrl, "admin")
                        }
                        aria-label="Copy admin link"
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

function WheelRouter() {
  const searchParams = useSearchParams()
  const hasRoom = searchParams.get("room")

  if (!hasRoom) {
    return <LandingPage />
  }

  return <RoomView />
}

export default function WheelContentWrapper() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <WheelRouter />
    </Suspense>
  )
}
