"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function LaunchPage({ params }: { params: { id: string } }) {
  const router = useRouter()

  return (
    <div className="flex flex-col flex-1 p-4">
      <div className="flex items-center gap-4 mb-8">
        <Button
          variant="ghost"
          onClick={() => router.push(`/collections/`)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <h1 className="text-3xl font-bold">Launch Collection</h1>
      </div>

      <div className="border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Launch Configuration</h2>
        <p className="text-muted-foreground">
          Configure your collection's launch settings, pricing, and deployment options.
        </p>
      </div>
    </div>
  )
} 