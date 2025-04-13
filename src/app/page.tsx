"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import LoginForm from "@/components/auth/login-form"

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem("token") 
    if (token) {
      router.push("/rooms")
    }
  }, [router])


  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center mb-6">Chat Application</h1>
        <LoginForm />
      </div>
    </main>
  )
}
