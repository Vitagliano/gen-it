"use client"

export default function TemplatesPage({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Templates</h1>
        <p className="text-muted-foreground">
          Create and manage templates to control how your NFTs are generated.
        </p>
      </div>

      <div className="border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Collection Templates</h2>
        <p className="text-muted-foreground">
          Create and manage templates to control how your NFTs are generated.
        </p>
      </div>
    </div>
  )
} 