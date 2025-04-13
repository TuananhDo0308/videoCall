"use client"

import type { Room } from "@/types/room"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

interface RoomListProps {
  rooms: Room[]
  onJoinRoom: (roomId: string) => void
}

export default function RoomList({ rooms, onJoinRoom }: RoomListProps) {
  const router = useRouter()

  const handleLogout = () => {
    // Clear localStorage
    localStorage.removeItem("token")
    localStorage.removeItem("username")

    // Clear cookies
    document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT"
    document.cookie = "username=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT"

    router.push("/")
  }

  if (rooms.length === 0) {
    return (
      <div>
        <div className="text-center py-4">No rooms available. Create one to get started!</div>
        <Button variant="outline" className="w-full mt-4" onClick={handleLogout}>
          Logout
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {rooms.map((room) => (
        <div key={room.roomId} className="room-item">
          <span className="font-medium">{room.name}</span>
          <Button size="sm" onClick={() => onJoinRoom(room.roomId)}>
            Join
          </Button>
        </div>
      ))}
    </div>
  )
}
