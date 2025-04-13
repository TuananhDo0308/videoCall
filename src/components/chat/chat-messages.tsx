"use client"

import { useEffect, useRef } from "react"
import type { Message } from "@/types/message"

interface ChatMessagesProps {
  messages: Message[]
  currentUser: string
  isLoading: boolean
  typingUsers: string[]
}

export default function ChatMessages({ messages, currentUser, isLoading, typingUsers }: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollToBottom()
  }, [messages, typingUsers])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">Loading messages...</div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2">
      {messages.length === 0 ? (
        <div className="text-center text-gray-500 py-8">No messages yet. Start the conversation!</div>
      ) : (
        messages.map((message, index) => (
          <div key={index} className={`message ${message.sender === currentUser ? "message-user" : "message-other"}`}>
            <div className="text-xs text-gray-500 mb-1">{message.sender === currentUser ? "You" : message.sender}</div>
            <div>{message.content}</div>
            {message.timestamp && (
              <div className="text-xs text-gray-400 mt-1">{new Date(message.timestamp).toLocaleTimeString()}</div>
            )}
          </div>
        ))
      )}

      {typingUsers.length > 0 && (
        <div className="text-sm text-gray-500 italic">
          {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  )
}
