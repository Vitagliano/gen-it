import { Card } from "@/components/ui/card";
import { Attribute, Token } from "@/types/index";

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
                <img
                  src={`/${trait.imagePath}`}
                  alt={trait.name}
                  className={
                    pixelated
                      ? "object-contain w-full h-full image-rendering-pixelated"
                      : "object-contain w-full h-full"
                  }
                />
              </div>
            ))
        ) : (
          sortedAttributes.length > 0 ? (
            sortedAttributes.map((attribute) => 
              (attribute.traits || []).length > 0 && (
                <div key={attribute.id} className="absolute inset-0">
                  <img
                    src={`/${(attribute.traits || [])[0].imagePath}`}
                    alt={`${(attribute.traits || [])[0].name}`}
                    className={pixelated ? "object-contain w-full h-full image-rendering-pixelated" : "object-contain w-full h-full"}
                  />
                </div>
              )
            )
          ) : (
            <div className="flex items-center justify-center h-full">
              <span className="text-muted-foreground">No preview available</span>
            </div>
          )
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
