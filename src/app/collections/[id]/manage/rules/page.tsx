"use client"

export default function RulesPage({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Rules</h1>
        <p className="text-muted-foreground">
          Define rules and constraints for trait combinations in your collection.
        </p>
      </div>

      <div className="border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Collection Rules</h2>
        <p className="text-muted-foreground">
          Define rules and constraints for trait combinations in your collection.
        </p>
      </div>
    </div>
  )
} 