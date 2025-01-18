"use client"

import { usePathname } from "next/navigation"
import { CollectionNav } from "@/components/collection-nav"

export default function CollectionLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { id: string }
}) {
  const pathname = usePathname()
  const isLayersPage = pathname.endsWith('/layers')

  return (
    <div className="flex flex-col h-full">
      {!isLayersPage && <CollectionNav collectionId={params.id} />}
      {children}
    </div>
  )
} 