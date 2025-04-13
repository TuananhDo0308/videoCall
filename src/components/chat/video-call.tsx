"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Mic, MicOff, Video, VideoOff, Users, RefreshCw } from "lucide-react"
import type { Client, IMessage } from "@stomp/stompjs"
import Peer from "peerjs"

interface VideoCallProps {
  roomId: string
  stompClient: Client | null
  connectionStatus: "connecting" | "connected" | "disconnected"
}

export default function VideoCall({ roomId, stompClient, connectionStatus }: VideoCallProps) {
  const [videoCallActive, setVideoCallActive] = useState(false)
  const [micEnabled, setMicEnabled] = useState(true)
  const [cameraEnabled, setCameraEnabled] = useState(true)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [connectedUsers, setConnectedUsers] = useState<string[]>([])
  const [peerStatus, setPeerStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected")

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideosRef = useRef<HTMLDivElement>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const peerRef = useRef<Peer | null>(null)
  const connectionsRef = useRef<Record<string, any>>({})
  const usernameRef = useRef<string>("")
  const subscriptionRef = useRef<any>(null)

  // Media constraints
  const constraints = {
    audio: true,
    video: {
      width: { max: 300 },
      height: { max: 300 },
      facingMode: { ideal: "user" },
    },
  }

  useEffect(() => {
    // Get username from localStorage
    usernameRef.current = localStorage.getItem("username") || ""

    // Subscribe to video messages when stompClient is available
    if (connectionStatus === "connected") {
      subscribeToVideoMessages()
    }

    return () => {
      // Stop all tracks if they exist
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop())
        localStreamRef.current = null
      }

      // Close all peer connections
      if (peerRef.current) {
        peerRef.current.destroy()
      }

      // Unsubscribe when component unmounts
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe()
      }
    }
  }, [roomId, stompClient, connectionStatus])

  const setupMediaDevices = async () => {
    try {
      // Only request media access when starting a call
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      localStreamRef.current = stream

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }

      setPermissionDenied(false)
      return true
    } catch (error) {
      console.error("Error accessing media devices:", error)
      setPermissionDenied(true)
      return false
    }
  }

  const subscribeToVideoMessages = () => {
    if (!stompClient) return

    // Subscribe to broadcast messages (JOIN, LEAVE)
    subscriptionRef.current = stompClient.subscribe(`/topic/video/${roomId}`, onVideoMessageReceived)

    // Subscribe to user-specific messages
    stompClient.subscribe(`/user/queue/video`, onVideoMessageReceived)

    // Request current users in the room
    stompClient.publish({
      destination: `/app/video.users/${roomId}`,
      body: JSON.stringify({
        type: "GET_USERS",
        from: usernameRef.current,
      }),
    })
  }

  const initializePeer = () => {
    if (peerRef.current) {
      peerRef.current.destroy()
    }

    setPeerStatus("connecting")

    // Create a new Peer with the username as ID
    const peer = new Peer(usernameRef.current, {
      debug: 3, // Increase log level for debugging
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:global.stun.twilio.com:3478" },
          {
            urls: "turn:global.turn.twilio.com:3478",
            username: "dummy",
            credential: "dummy",
          },
        ],
      },
    })

    peer.on("open", (id) => {
      console.log("My peer ID is: " + id)
      setPeerStatus("connected")

      // Call existing peers once our connection is established
      connectedUsers.forEach((user) => {
        if (!connectionsRef.current[user]) {
          callPeer(user)
        }
      })
    })

    peer.on("error", (err) => {
      console.error("PeerJS error:", err)
      setPeerStatus("disconnected")
    })

    peer.on("call", (call) => {
      console.log(`Receiving call from ${call.peer}`)

      // Answer the call with our local stream
      if (localStreamRef.current) {
        call.answer(localStreamRef.current)
        console.log("Answered call with local stream")
      } else {
        console.error("Cannot answer call - no local stream")
      }

      // Handle incoming stream
      call.on("stream", (remoteStream) => {
        console.log(`Received stream from ${call.peer}`)
        addRemoteStream(call.peer, remoteStream)
      })

      call.on("close", () => {
        removeRemoteStream(call.peer)
      })

      call.on("error", (err) => {
        console.error("Call error:", err)
      })

      // Store the call
      connectionsRef.current[call.peer] = call
    })

    peerRef.current = peer
  }

  const startVideoCall = async () => {
    if (videoCallActive) {
      console.log("Video call already active")
      return
    }

    // Only initialize media devices when starting a call
    const success = await setupMediaDevices()
    if (!success) {
      console.error("Cannot start video call without camera and microphone access")
      return
    }

    if (!localStreamRef.current) {
      console.error("Local stream not available")
      return
    }

    setVideoCallActive(true)
    setMicEnabled(true)
    setCameraEnabled(true)

    // Initialize PeerJS
    initializePeer()

    if (stompClient && connectionStatus === "connected") {
      // Notify others that we're joining the video call
      stompClient.publish({
        destination: `/app/video.join/${roomId}`,
        body: JSON.stringify({
          type: "JOIN",
          from: usernameRef.current,
        }),
      })
    }
  }

  const endVideoCall = () => {
    if (peerRef.current) {
      peerRef.current.destroy()
      peerRef.current = null
    }

    // Clear connections
    connectionsRef.current = {}

    // Stop all tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop()
      })
      localStreamRef.current = null

      // Clear video source
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null
      }
    }

    // Clear remote videos
    if (remoteVideosRef.current) {
      remoteVideosRef.current.innerHTML = ""
    }

    // Notify others that we're leaving
    if (stompClient && connectionStatus === "connected") {
      stompClient.publish({
        destination: `/app/video.leave/${roomId}`,
        body: JSON.stringify({
          type: "LEAVE",
          from: usernameRef.current,
        }),
      })
    }

    setVideoCallActive(false)
    setPeerStatus("disconnected")
  }

  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setMicEnabled(audioTrack.enabled)
      }
    }
  }

  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setCameraEnabled(videoTrack.enabled)
      }
    }
  }

  const callPeer = (peerId: string) => {
    if (!peerRef.current || !localStreamRef.current) {
      console.error("Cannot call peer - no peer connection or local stream")
      return
    }

    // Check if we already have a connection to this peer
    if (connectionsRef.current[peerId]) {
      console.log(`Already connected to ${peerId}`)
      return
    }

    console.log(`Calling peer: ${peerId}`)

    try {
      // Call the peer
      const call = peerRef.current.call(peerId, localStreamRef.current)

      if (!call) {
        console.error(`Failed to create call to ${peerId}`)
        return
      }

      console.log(`Call created to ${peerId}`)

      // Handle the stream when it comes in
      call.on("stream", (remoteStream) => {
        console.log(`Received stream from ${peerId} after calling them`)
        addRemoteStream(peerId, remoteStream)
      })

      call.on("close", () => {
        console.log(`Call to ${peerId} closed`)
        removeRemoteStream(peerId)
      })

      call.on("error", (err) => {
        console.error(`Call error with ${peerId}:`, err)
      })

      // Store the call
      connectionsRef.current[peerId] = call
    } catch (error) {
      console.error(`Error calling peer ${peerId}:`, error)
    }
  }

  const addRemoteStream = (peerId: string, stream: MediaStream) => {
    console.log(`Adding remote stream from ${peerId}`)

    if (!remoteVideosRef.current) return

    // Check if video element for this user already exists
    const existingVideo = remoteVideosRef.current.querySelector(`[data-user="${peerId}"]`)
    if (existingVideo) {
      console.log(`Video for ${peerId} already exists`)
      return
    }

    const videoBox = document.createElement("div")
    videoBox.className = "video-box relative border rounded p-2 mb-2"
    videoBox.innerHTML = `<h3 class="text-sm font-medium mb-1">${peerId}</h3>`

    const video = document.createElement("video")
    video.autoplay = true
    video.playsInline = true
    video.className = "w-full h-auto rounded"
    video.dataset.user = peerId
    video.srcObject = stream

    videoBox.appendChild(video)
    remoteVideosRef.current.appendChild(videoBox)

    // Update connected users
    setConnectedUsers((prev) => {
      if (!prev.includes(peerId)) {
        return [...prev, peerId]
      }
      return prev
    })
  }

  const removeRemoteStream = (peerId: string) => {
    console.log(`Removing remote stream from ${peerId}`)

    if (!remoteVideosRef.current) return

    const videoBox = Array.from(remoteVideosRef.current.children).find((box) =>
      box.querySelector(`[data-user="${peerId}"]`),
    )

    if (videoBox) {
      remoteVideosRef.current.removeChild(videoBox)
    }

    // Update connected users
    setConnectedUsers((prev) => prev.filter((user) => user !== peerId))

    // Remove from connections
    if (connectionsRef.current[peerId]) {
      delete connectionsRef.current[peerId]
    }
  }

  const onVideoMessageReceived = (message: IMessage) => {
    const receivedMessage = JSON.parse(message.body)
    const username = usernameRef.current

    console.log("Received video message:", receivedMessage)

    if (receivedMessage.type === "JOIN" && receivedMessage.from !== username) {
      console.log("User joined:", receivedMessage.from)

      // Update connected users
      setConnectedUsers((prev) => {
        if (!prev.includes(receivedMessage.from)) {
          return [...prev, receivedMessage.from]
        }
        return prev
      })

      if (videoCallActive && peerRef.current && peerRef.current.id) {
        // Call the new peer that joined
        callPeer(receivedMessage.from)
      }
    } else if (receivedMessage.type === "USER_LIST") {
      const users = receivedMessage.data || []
      console.log("Received user list:", users)

      // Update connected users
      setConnectedUsers(users.filter((user: string) => user !== username))

      if (videoCallActive && peerRef.current && peerStatus === "connected") {
        // Call all peers in the room
        users.forEach((user: string) => {
          if (user !== username && !connectionsRef.current[user]) {
            callPeer(user)
          }
        })
      }
    } else if (receivedMessage.type === "LEAVE") {
      console.log("User left:", receivedMessage.from)

      // Update connected users
      setConnectedUsers((prev) => prev.filter((user) => user !== receivedMessage.from))

      // Close and remove the connection
      if (connectionsRef.current[receivedMessage.from]) {
        removeRemoteStream(receivedMessage.from)
      }
    }
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="py-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Video Call</span>
          <div className="text-sm flex items-center gap-2">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                connectionStatus === "connected"
                  ? "bg-green-500"
                  : connectionStatus === "connecting"
                    ? "bg-yellow-500"
                    : "bg-red-500"
              }`}
            ></span>
            <span>
              {connectionStatus === "connected"
                ? "Connected"
                : connectionStatus === "connecting"
                  ? "Connecting..."
                  : "Disconnected"}
            </span>

            {videoCallActive && (
              <>
                <span className="mx-1">|</span>
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    peerStatus === "connected"
                      ? "bg-green-500"
                      : peerStatus === "connecting"
                        ? "bg-yellow-500"
                        : "bg-red-500"
                  }`}
                ></span>
                <span>PeerJS: {peerStatus}</span>
              </>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden p-4">
        <div className="mb-4">
          <div className="video-box relative border rounded p-2">
            <h3 className="text-sm font-medium mb-1">You</h3>
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-auto rounded ${!videoCallActive ? "opacity-50" : ""}`}
            />
            {!videoCallActive && !permissionDenied && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
                <p>Camera will activate when call starts</p>
              </div>
            )}
            {permissionDenied && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
                <p>Camera access denied</p>
              </div>
            )}
          </div>

          <div className="flex justify-between mt-2">
            {!videoCallActive ? (
              <Button onClick={startVideoCall} className="w-full" disabled={connectionStatus !== "connected"}>
                Start Video Call
              </Button>
            ) : (
              <>
                <Button variant={micEnabled ? "default" : "outline"} size="icon" onClick={toggleMic}>
                  {micEnabled ? <Mic size={18} /> : <MicOff size={18} />}
                </Button>
                <Button variant={cameraEnabled ? "default" : "outline"} size="icon" onClick={toggleCamera}>
                  {cameraEnabled ? <Video size={18} /> : <VideoOff size={18} />}
                </Button>
                {peerStatus !== "connected" && (
                  <Button variant="outline" size="icon" onClick={initializePeer} title="Reconnect PeerJS">
                    <RefreshCw size={18} />
                  </Button>
                )}
                <Button variant="destructive" onClick={endVideoCall}>
                  End Call
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Users size={16} />
            <span>Users in room: {connectedUsers.length + 1}</span>
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {connectedUsers.length > 0 ? (
              <ul>
                <li>You ({usernameRef.current})</li>
                {connectedUsers.map((user) => (
                  <li key={user}>{user}</li>
                ))}
              </ul>
            ) : (
              <p>No other users in the room</p>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto" ref={remoteVideosRef} />
      </CardContent>
    </Card>
  )
}
