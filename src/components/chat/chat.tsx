"use client"

import type React from "react"
import type { Client, IMessage } from '@stomp/stompjs'

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { apiLinks } from "@/lib/apilinks"

interface ChatComponentProps {
  roomId: string
  stompClient: Client | null
  connectionStatus: "connecting" | "connected" | "disconnected"
}

export default function ChatComponent({ roomId, stompClient, connectionStatus }: ChatComponentProps) {
  const [chatMessages, setChatMessages] = useState<any[]>([])
  const [messageInput, setMessageInput] = useState("")
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const usernameRef = useRef<string>("")
  const sendingRef = useRef<boolean>(false)
  const subscriptionRef = useRef<any>(null)
  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const response = await fetch(`${apiLinks}/api/messages/${roomId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` ,          "ngrok-skip-browser-warning": "true",
        },
        })

        if (response.ok) {
          const messages = await response.json()
          setChatMessages(messages) // Set tin nhắn cũ vào state
        } else {
          console.error("Failed to load chat history:", response.statusText)
        }
      } catch (error) {
        console.error("Error loading chat history:", error)
      }
    }

    if (connectionStatus === "connected") {
      loadChatHistory()
    }
  }, [roomId, connectionStatus])
  useEffect(() => {
    // Get username from localStorage
    usernameRef.current = localStorage.getItem("username") || ""

    // Subscribe to chat messages when stompClient is available
    if (stompClient && connectionStatus === "connected") {
      subscribeToChat()
    }

    return () => {
      // Unsubscribe when component unmounts
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe()
      }
    }
  }, [roomId, stompClient, connectionStatus])

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [chatMessages])

  const subscribeToChat = () => {
    if (!stompClient) return

    // Subscribe to chat messages
    subscriptionRef.current = stompClient.subscribe(`/topic/chat/${roomId}`, onChatMessageReceived)
  }

  // Handle chat messages
  const onChatMessageReceived = (message: IMessage) => {
    const receivedMessage = JSON.parse(message.body)
    console.log("Received chat message:", receivedMessage)

    // Add to chat messages
    setChatMessages((prev) => [...prev, receivedMessage])
  }

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault()

    if (!messageInput.trim() || !stompClient || connectionStatus !== "connected" || sendingRef.current) return

    // Set sending flag to prevent duplicate sends
    sendingRef.current = true

    const username = usernameRef.current

    stompClient.publish({
      destination: `/app/chat.send/${roomId}`,
      body: JSON.stringify({
        sender: username,
        content: messageInput,
        timestamp: new Date().toISOString(),
      }),
    })

    setMessageInput("")

    // Reset sending flag after a short delay
    setTimeout(() => {
      sendingRef.current = false
    }, 500)
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="py-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Chat</span>
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
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex h-[300px] flex-col overflow-hidden p-4">
        {/* Chat messages */}
        <div className="h-[500px] overflow-y-auto  mb-4 p-2 bg-gray-50 rounded-md" ref={chatContainerRef}>
          {chatMessages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">No messages yet. Start the conversation!</div>
          ) : (
            chatMessages.map((message, index) => (
              <div
                key={index}
                className={`message ${message.sender === usernameRef.current ? "message-user" : "message-other"}`}
              >
                <div className="text-xs text-gray-500 mb-1">
                  {message.sender === usernameRef.current ? "You" : message.sender}
                </div>
                <div>{message.content}</div>
                {message.timestamp && (
                  <div className="text-xs text-gray-400 mt-1">{new Date(message.timestamp).toLocaleTimeString()}</div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Message input */}
        <form onSubmit={sendMessage} className="flex gap-2">
          <Input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            placeholder="Type a message..."
            disabled={connectionStatus !== "connected"}
          />
          <Button type="submit" disabled={connectionStatus !== "connected" || !messageInput.trim()}>
            Send
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
