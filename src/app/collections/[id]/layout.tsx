"use client"

import { CollectionNav } from "@/components/collection-nav"

export default function CollectionLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { id: string }
}) {
  return (
    <div className="flex flex-col h-full">
      <CollectionNav collectionId={params.id} />
      {children}
    </div>
  )
} 