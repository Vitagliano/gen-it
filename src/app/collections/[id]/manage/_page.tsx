"use client"

import Link from "next/link"
import { Shapes, Layout, ScrollText } from "lucide-react"

export default function ManageTemplate({ params }: { params: { id: string } }) {

  const managementLinks = [
    {
      title: "Attributes",
      description: "Manage your collection's attributes and their traits.",
      href: `/collections/${params.id}/manage/attributes`,
      icon: Shapes
    },
    {
      title: "Templates",
      description: "Create and manage templates for your collection.",
      href: `/collections/${params.id}/manage/templates`,
      icon: Layout
    },
    {
      title: "Rules",
      description: "Set up rules and constraints for your collection.",
      href: `/collections/${params.id}/manage/rules`,
      icon: ScrollText
    }
  ]

  return (
    <div className="flex flex-col flex-1 p-4">
      {/* <div className="flex items-center gap-4 mb-8">
        <Button
          variant="ghost"
          onClick={() => router.push(`/collections/`)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <h1 className="text-3xl font-bold">Manage Collection</h1>
      </div> */}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {managementLinks.map((link) => {
          const Icon = link.icon
          return (
            <Link
              key={link.href}
              href={link.href}
              className="border rounded-lg p-6 hover:border-primary transition-colors group"
            >
              <div className="flex items-center gap-2 mb-4">
                <Icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                <h2 className="text-lg font-semibold">{link.title}</h2>
              </div>
              <p className="text-muted-foreground">
                {link.description}
              </p>
            </Link>
          )
        })}
      </div>
    </div>
  )
} 