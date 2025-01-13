import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Layers, Sliders, Settings, Rocket } from "lucide-react";

interface CollectionNavProps {
  collectionId: string;
}

export function CollectionNav({ collectionId }: CollectionNavProps) {
  const pathname = usePathname();

  const items = [
    {
      title: "Tokens",
      href: `/collections/${collectionId}/tokens`,
      icon: Layers,
    },
    {
      title: "Manage",
      href: `/collections/${collectionId}/manage`,
      icon: Sliders,
    },
    {
      title: "Settings",
      href: `/collections/${collectionId}/settings`,
      icon: Settings,
    },
    {
      title: "Launch",
      href: `/collections/${collectionId}/launch`,
      icon: Rocket,
    },
  ];

  return (
    <div className="flex items-center gap-2 border-b px-4 h-14">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = pathname.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href}>
            <Button
              variant={isActive ? "secondary" : "ghost"}
              className="gap-2"
              size="sm"
            >
              <Icon className="h-4 w-4" />
              {item.title}
            </Button>
          </Link>
        );
      })}
    </div>
  );
}
