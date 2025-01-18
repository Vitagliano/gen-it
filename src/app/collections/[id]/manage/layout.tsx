"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { Shapes, Layout, ScrollText } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ManageLayoutProps {
  children: React.ReactNode
  params: { id: string }
}

export default function ManageLayout({ children, params }: ManageLayoutProps) {
  const pathname = usePathname()

  const subNavItems = [
    {
      title: "Attributes",
      href: `/collections/${params.id}/manage/attributes`,
      icon: Shapes
    },
    {
      title: "Templates",
      href: `/collections/${params.id}/manage/templates`,
      icon: Layout
    },
    {
      title: "Rules",
      href: `/collections/${params.id}/manage/rules`,
      icon: ScrollText
    }
  ]

  return (
    <div className="flex flex-col flex-1">
      <div className="border-b">
        <div className="flex h-16 items-center px-4">
         
          <div className="flex items-center space-x-2">
            {subNavItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    size="sm"
                    className="gap-2"
                  >
                    <Icon className="h-4 w-4" />
                    {item.title}
                  </Button>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
      <div className="flex-1 p-4">
        {children}
      </div>
    </div>
  )
} 