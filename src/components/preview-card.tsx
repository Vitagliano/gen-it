import { Card } from "@/components/ui/card";
import { Attribute, Token } from "@/types/index";
import { getTraitImageUrl } from "@/lib/utils";
import Image from "next/image";
import { useEffect, useState } from "react";

interface PreviewCardProps {
  token?: Token;
  attributes: Attribute[];
  pixelated: boolean;
  name?: string;
  tokenAmount?: number;
  showFooter?: boolean;
}

export function PreviewCard({
  token,
  attributes,
  pixelated,
  name,
  tokenAmount,
  showFooter = true,
}: PreviewCardProps) {
  const sortedAttributes = [...attributes].sort((a, b) => a.order - b.order);
  const [traitUrls, setTraitUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadTraitUrls = async () => {
      const urls: Record<string, string> = {};
      for (const trait of token?.traits || []) {
        urls[trait.imagePath] = await getTraitImageUrl(trait.imagePath);
      }
      for (const attr of sortedAttributes) {
        if (attr.traits?.[0]) {
          urls[attr.traits[0].imagePath] = await getTraitImageUrl(attr.traits[0].imagePath);
        }
      }
      setTraitUrls(urls);
    };
    loadTraitUrls();
  }, [token, sortedAttributes]);

  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-square bg-[#f5f5f5] bg-[linear-gradient(45deg,#eee_25%,transparent_25%,transparent_75%,#eee_75%,#eee),linear-gradient(45deg,#eee_25%,transparent_25%,transparent_75%,#eee_75%,#eee)] bg-[length:16px_16px] bg-[position:0_0,8px_8px]">
        {token ? (
          token.traits
            .sort((a, b) => {
              const attrA = attributes.find((attr) => attr.id === a.attributeId);
              const attrB = attributes.find((attr) => attr.id === b.attributeId);
              return (attrA?.order || 0) - (attrB?.order || 0);
            })
            .map((trait) => (
              <div key={trait.id} className="absolute inset-0">
                <div className="relative w-full h-full">
                  <Image
                    src={traitUrls[trait.imagePath] || ''}
                    alt={trait.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className={
                      pixelated
                        ? "object-contain image-rendering-pixelated"
                        : "object-contain"
                    }
                  />
                </div>
              </div>
            ))
        ) : sortedAttributes.length > 0 ? (
          sortedAttributes.map(
            (attribute) =>
              attribute.traits?.[0] && (
                <div key={attribute.id} className="absolute inset-0">
                  <div className="relative w-full h-full">
                    <Image
                      src={traitUrls[attribute.traits[0].imagePath]}
                      alt={attribute.traits[0].name}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className={
                        pixelated
                          ? "object-contain image-rendering-pixelated"
                          : "object-contain"
                      }
                    />
                  </div>
                </div>
              )
          )
        ) : (
          <div className="flex items-center justify-center h-full">
            <span className="text-muted-foreground">No preview available</span>
          </div>
        )}
      </div>
      {showFooter && (
        <div className="p-3 border-t">
          <div className="flex items-center justify-between">
            <span className="font-medium">{name || "Collection Name"}</span>
            <span className="text-muted-foreground">{tokenAmount || 0}</span>
          </div>
        </div>
      )}
    </Card>
  );
}
