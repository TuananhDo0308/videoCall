"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import VideoCall from "@/components/chat/video-call"
import ChatComponent from "@/components/chat/chat"
import { Eye, EyeOff } from 'lucide-react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import Script from 'next/script'
import { apiLinks } from "@/lib/apilinks"

export default function ChatRoom() {
  const router = useRouter()
  const params = useParams()
  const roomId = params.roomId as string
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("disconnected")
  const [showChat, setShowChat] = useState(true)
  const [showVideo, setShowVideo] = useState(true)
  const [peerJsLoaded, setPeerJsLoaded] = useState(false)

  const usernameRef = useRef<string>("")
  const stompClientRef = useRef<Client | null>(null)

  useEffect(() => {
    // Check if user has a username
    const storedUsername = localStorage.getItem("username")

    if (!storedUsername) {
      router.push("/")
      return
    }

    usernameRef.current = storedUsername

    // Connect WebSocket
    connectWebSocket()

    return () => {
      // Cleanup
      if (stompClientRef.current) {
        stompClientRef.current.deactivate()
      }
    }
  }, [roomId, router])

  const connectWebSocket = () => {
    if (typeof window === "undefined") return

    setConnectionStatus("connecting")

    try {
      // Create and configure STOMP client
      const client = new Client({
        // Use SockJS for the WebSocket connection
        webSocketFactory: () => new SockJS(`${apiLinks}/ws`),
        // Debug mode - set to false in production
        debug: function (str) {
          console.log('STOMP: ' + str);
        },
        // Reconnect delay in milliseconds
        reconnectDelay: 5000,
        // Heartbeat settings
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
        // Connection timeout
        connectionTimeout: 10000,
      });

      // Connection established handler
      client.onConnect = (frame) => {
        console.log('Connected: ' + frame);
        setConnectionStatus("connected");
        showToast("Connected", "Connected to chat server", "default");
      };

      // Error handler
      client.onStompError = (frame) => {
        console.error('STOMP error', frame);
        setConnectionStatus("disconnected");
        showToast("Connection Error", frame.headers?.message || "Unknown error", "destructive");
      };

      // Disconnection handler
      client.onDisconnect = () => {
        console.log('Disconnected');
        setConnectionStatus("disconnected");
      };

      // Activate the client (establish connection)
      client.activate();

      // Store the client reference
      stompClientRef.current = client;
    } catch (error) {
      console.error("Error connecting to WebSocket:", error);
      setConnectionStatus("disconnected");
      showToast("Connection Error", "Failed to connect to chat server", "destructive");
    }
  }

  const handleLeaveRoom = () => {
    router.push("/")
  }

  // Simple toast notification function
  const showToast = (title: string, message: string, type: "default" | "destructive") => {
    if (typeof window !== "undefined") {
      // Create toast container if it doesn't exist
      let toastContainer = document.getElementById("toast-container")
      if (!toastContainer) {
        toastContainer = document.createElement("div")
        toastContainer.id = "toast-container"
        toastContainer.className = "fixed bottom-4 right-4 flex flex-col gap-2 z-50"
        document.body.appendChild(toastContainer)
      }

      // Create toast element
      const toast = document.createElement("div")
      toast.className = `fixed bottom-4 right-4 p-4 rounded-md shadow-md transition-opacity duration-300 ${
        type === "destructive" ? "bg-red-500 text-white" : "bg-white text-gray-900 border border-gray-200"
      }`

      toast.innerHTML = `
        <div class="flex justify-between items-start">
          <div>
            <h4 class="font-medium">${title}</h4>
            <p class="text-sm">${message}</p>
          </div>
          <button class="ml-4 text-sm opacity-70 hover:opacity-100" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
      `

      toastContainer.appendChild(toast)

      // Auto-remove after 5 seconds
      setTimeout(() => {
        if (toast.parentElement) {
          toast.classList.add("opacity-0")
          setTimeout(() => toast.remove(), 300)
        }
      }, 5000)
    }
  }

  return (
    <>
      {/* Load PeerJS script */}
      <Script 
        src="https://unpkg.com/peerjs@1.5.1/dist/peerjs.min.js" 
        onLoad={() => setPeerJsLoaded(true)}
        onError={() => {
          console.error("Failed to load PeerJS");
          showToast("Error", "Failed to load PeerJS library", "destructive");
        }}
      />
      
      <div className="container mx-auto py-4 px-4 min-h-screen flex flex-col">
        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <div>
              <CardTitle>Chat Room: {roomId}</CardTitle>
              <div className="text-sm text-muted-foreground">
                <span>Logged in as: {usernameRef.current}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowChat(!showChat)}
                title={showChat ? "Hide Chat" : "Show Chat"}
              >
                {showChat ? <EyeOff size={16} /> : <Eye size={16} />} Chat
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowVideo(!showVideo)}
                title={showVideo ? "Hide Video" : "Show Video"}
              >
                {showVideo ? <EyeOff size={16} /> : <Eye size={16} />} Video
              </Button>

              <Button variant="outline" size="sm" onClick={handleLeaveRoom}>
                Leave Room
              </Button>
            </div>
          </CardHeader>

          <CardContent className="flex-1 p-4 overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
              {/* Chat Section */}
              {showChat && (
                <div className={showVideo ? "md:col-span-1" : "md:col-span-2"}>
                  <ChatComponent
                    roomId={roomId}
                    stompClient={stompClientRef.current}
                    connectionStatus={connectionStatus}
                  />
                </div>
              )}

              {/* Video Call Section */}
              {showVideo && (
                <div className={showChat ? "md:col-span-1" : "md:col-span-2"}>
                  {!peerJsLoaded ? (
                    <Card className="h-full flex flex-col items-center justify-center">
                      <CardContent>
                        <div className="text-center">
                          <div className="w-16 h-16 border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin mx-auto"></div>
                          <p className="mt-4">Loading PeerJS...</p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <VideoCall 
                      roomId={roomId} 
                      stompClient={stompClientRef.current} 
                      connectionStatus={connectionStatus} 
                    />
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
