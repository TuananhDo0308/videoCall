"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import RoomList from "@/components/rooms/room-list";
import type { Room } from "@/types/room";
import { apiLinks } from "@/lib/apilinks";

export default function RoomsPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomName, setRoomName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token === null) {
      router.push("/");
      return;
    }
    loadRooms();
  }, [router]);

  const loadRooms = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${apiLinks}/api/rooms`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "ngrok-skip-browser-warning": "true",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load rooms");
      }

      const data = await response.json();
      setRooms(data);
    } catch (error) {
      console.error("Error loading rooms:", error);
      setError("Failed to load rooms");
    } finally {
      setIsLoading(false);
    }
  };

  const createRoom = async () => {
    if (!roomName.trim()) return;

    try {
      const response = await fetch(`${apiLinks}/api/rooms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ name: roomName }),
      });

      if (!response.ok) {
        throw new Error("Failed to create room");
      }

      await loadRooms();
      setRoomName("");
    } catch (error) {
      console.error("Error creating room:", error);
      setError("Failed to create room");
    }
  };

  const handleJoinRoom = (roomId: string) => {
    router.push(`/chat/${roomId}`);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");

    // Clear cookies
    document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie =
      "username=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";

    router.push("/");
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Chat Rooms</CardTitle>
          <Button variant="outline" onClick={handleLogout}>
            Logout
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-6">
            <Input
              placeholder="Room Name"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && createRoom()}
            />
            <Button onClick={createRoom}>Create Room</Button>
          </div>

          {isLoading ? (
            <div className="text-center py-4">Loading rooms...</div>
          ) : error ? (
            <div className="text-center text-red-500 py-4">{error}</div>
          ) : (
            <RoomList rooms={rooms} onJoinRoom={handleJoinRoom} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
