export interface Message {
    id?: string
    sender: string
    content: string
    timestamp?: string
    isProcessed?: boolean
    hasMention?: boolean
  }
  