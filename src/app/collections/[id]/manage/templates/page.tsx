"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Search, MoreVertical, GripVertical } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Collection {
  id: string;
  name: string;
  pixelated: boolean;
}

interface Trait {
  id: string;
  name: string;
  imagePath: string;
}

interface Attribute {
  id: string;
  name: string;
  order: number;
  traits: Trait[];
}

interface Template {
  id: string;
  name: string;
  rarity: number;
  attributes: {
    id: string;
    enabled: boolean;
  }[];
}

export default function TemplatesPage({ params }: { params: { id: string } }) {
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [editedTemplates, setEditedTemplates] = useState<Template[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  // const [isEditing, setIsEditing] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null
  );
  const [newTemplateName, setNewTemplateName] = useState("");
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [rarityMode, setRarityMode] = useState<"percentage" | "weight">(
    "percentage"
  );
  const [newTemplateAttributes, setNewTemplateAttributes] = useState<
    {
      id: string;
      enabled: boolean;
      order: number;
    }[]
  >([]);
  const [draggedItem, setDraggedItem] = useState<number | null>(null);

  useEffect(() => {
    if (isConnected && address) {
      fetchCollection();
      fetchAttributes();
      fetchTemplates();
    }
  }, [address, isConnected, params.id]);

  useEffect(() => {
    if (templates.length > 0) {
      setEditedTemplates(JSON.parse(JSON.stringify(templates)));
    }
  }, [templates]);

  useEffect(() => {
    if (templates.length > 0 && editedTemplates.length > 0) {
      const hasChanges =
        JSON.stringify(templates) !== JSON.stringify(editedTemplates);
      setHasChanges(hasChanges);
    }
  }, [templates, editedTemplates]);

  useEffect(() => {
    if (isCreating && attributes.length > 0) {
      setNewTemplateAttributes(
        attributes.map((attr, index) => ({
          id: attr.id,
          enabled: true,
          order: index,
        }))
      );
    }
  }, [isCreating, attributes]);

  const fetchCollection = async () => {
    try {
      const response = await fetch(
        `/api/collections/${params.id}?address=${address}`
      );
      if (!response.ok) throw new Error("Failed to fetch collection");
      const data = await response.json();
      setCollection(data);
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Failed to fetch collection",
        variant: "destructive",
      });
    }
  };

  const fetchAttributes = async () => {
    try {
      const response = await fetch(
        `/api/collections/${params.id}/attributes?address=${address}`
      );
      if (!response.ok) throw new Error("Failed to fetch attributes");
      const data = await response.json();
      setAttributes(data);
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Failed to fetch attributes",
        variant: "destructive",
      });
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await fetch(
        `/api/collections/${params.id}/templates?address=${address}`
      );
      if (!response.ok) throw new Error("Failed to fetch templates");
      const data = await response.json();
      setTemplates(data);
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Failed to fetch templates",
        variant: "destructive",
      });
    }
  };

  const updateTemplateRarities = (templateId: string, newRarity: number) => {
    setEditedTemplates((prev) => {
      // Get all templates except the current one
      const otherTemplates = prev.filter((t) => t.id !== templateId);

      if (otherTemplates.length === 0) {
        // If this is the only template, it should have 100% rarity
        return prev.map((t) =>
          t.id === templateId ? { ...t, rarity: 100 } : t
        );
      }

      // Calculate remaining rarity to distribute
      const remainingRarity = Math.max(0, 100 - newRarity);

      // Calculate current total of other templates
      const currentTotal = otherTemplates.reduce((sum, t) => sum + t.rarity, 0);

      // If current total is 0, distribute remaining rarity equally
      const shouldDistributeEqually = currentTotal === 0;

      return prev.map((template) => {
        if (template.id === templateId) {
          return { ...template, rarity: newRarity };
        }
        if (shouldDistributeEqually) {
          return {
            ...template,
            rarity: remainingRarity / otherTemplates.length,
          };
        }
        // Adjust proportionally based on current ratios
        const proportion = template.rarity / currentTotal;
        return {
          ...template,
          rarity: remainingRarity * proportion,
        };
      });
    });
  };

  const handleUpdateTemplateRarity = (templateId: string, newValue: number) => {
    const newRarity = Math.min(100, Math.max(0, newValue));
    updateTemplateRarities(templateId, newRarity);
  };

  const handleCreateTemplate = async () => {
    if (!newTemplateName) return;

    try {
      // Calculate initial rarity for the new template
      const equalRarity = 100 / (templates.length + 1);

      const response = await fetch(
        `/api/collections/${params.id}/templates?address=${address}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: newTemplateName,
            rarity: equalRarity,
            attributes: newTemplateAttributes.map((attr) => ({
              id: attr.id,
              enabled: attr.enabled,
            })),
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to create template");

      const newTemplate = await response.json();

      // Update all templates with adjusted rarities
      const updatedTemplates = [...templates, newTemplate].map((t) => ({
        ...t,
        rarity: equalRarity,
      }));

      setTemplates(updatedTemplates);
      setEditedTemplates(updatedTemplates);
      setIsCreating(false);
      setNewTemplateName("");
      setNewTemplateAttributes([]);
      setShowRegenerateDialog(true);

      toast({
        title: "Success",
        description: "Template created successfully",
      });
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Failed to create template",
        variant: "destructive",
      });
    }
  };

  const handleSaveChanges = async () => {
    try {
      // Update each changed template
      for (const template of editedTemplates) {
        const originalTemplate = templates.find((t) => t.id === template.id);
        if (JSON.stringify(originalTemplate) !== JSON.stringify(template)) {
          await fetch(
            `/api/collections/${params.id}/templates/${template.id}?address=${address}`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(template),
            }
          );
        }
      }

      setTemplates(editedTemplates);
      setHasChanges(false);
      setShowRegenerateDialog(true);

      toast({
        title: "Success",
        description: "Templates updated successfully",
      });
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Failed to update templates",
        variant: "destructive",
      });
    }
  };

  const handleRegenerateTokens = async () => {
    try {
      const response = await fetch(
        `/api/collections/${params.id}/tokens?address=${address}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            address,
            attributes: attributes.map((attr) => ({
              id: attr.id,
              order: attr.order,
              isEnabled: true,
            })),
            templates: editedTemplates,
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to regenerate tokens");

      setShowRegenerateDialog(false);
      toast({
        title: "Success",
        description: "Tokens regenerated successfully",
      });
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Failed to regenerate tokens",
        variant: "destructive",
      });
    }
  };

  const handleDiscard = () => {
    setEditedTemplates(JSON.parse(JSON.stringify(templates)));
    setHasChanges(false);
  };

  const handleDeleteTemplate = async (template: Template) => {
    try {
      const response = await fetch(
        `/api/collections/${params.id}/templates/${template.id}?address=${address}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) throw new Error("Failed to delete template");

      // Remove the template from state
      const updatedTemplates = templates.filter((t) => t.id !== template.id);

      // Recalculate rarities for remaining templates
      const equalRarity = 100 / updatedTemplates.length;
      const templatesWithUpdatedRarities = updatedTemplates.map((t) => ({
        ...t,
        rarity: equalRarity,
      }));

      // Update all remaining templates with new rarities
      await Promise.all(
        templatesWithUpdatedRarities.map((template) =>
          fetch(
            `/api/collections/${params.id}/templates/${template.id}?address=${address}`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(template),
            }
          )
        )
      );

      setTemplates(templatesWithUpdatedRarities);
      setEditedTemplates(templatesWithUpdatedRarities);
      setShowRegenerateDialog(true);

      toast({
        title: "Success",
        description: "Template deleted successfully",
      });
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Failed to delete template",
        variant: "destructive",
      });
    }
  };

  const filteredTemplates = editedTemplates.filter((template) =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    index: number
  ) => {
    setDraggedItem(index);
    e.currentTarget.classList.add("opacity-50");
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove("opacity-50");
    setDraggedItem(null);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (
    e: React.DragEvent<HTMLDivElement>,
    index: number
  ) => {
    e.preventDefault();

    if (draggedItem === null) return;

    if (isCreating) {
      const items = Array.from(newTemplateAttributes);
      const [reorderedItem] = items.splice(draggedItem, 1);
      items.splice(index, 0, reorderedItem);

      // Update order values
      const updatedItems = items.map((item, index) => ({
        ...item,
        order: index,
      }));

      setNewTemplateAttributes(updatedItems);
    } else if (selectedTemplate) {
      const orderedAttributes = attributes
        .sort((a, b) => a.order - b.order)
        .map((attr) => ({
          ...attr,
          enabled:
            selectedTemplate.attributes.find((ta) => ta.id === attr.id)
              ?.enabled ?? false,
        }));

      const items = Array.from(orderedAttributes);
      const [reorderedItem] = items.splice(draggedItem, 1);
      items.splice(index, 0, reorderedItem);

      // Update order values
      const updatedItems = items.map((item, index) => ({
        ...item,
        order: index,
      }));

      // Update the attributes order in the database
      try {
        await Promise.all(
          updatedItems.map(async (attr) => {
            const response = await fetch(
              `/api/collections/${params.id}/attributes/${attr.id}?address=${address}`,
              {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  order: attr.order,
                }),
              }
            );
            if (!response.ok)
              throw new Error("Failed to update attribute order");
          })
        );

        setAttributes(updatedItems);

        // Update the template attributes to maintain enabled states
        if (selectedTemplate) {
          setEditedTemplates((prev) =>
            prev.map((t) =>
              t.id === selectedTemplate.id
                ? {
                    ...t,
                    attributes: updatedItems.map((attr) => ({
                      id: attr.id,
                      enabled:
                        t.attributes.find((ta) => ta.id === attr.id)?.enabled ??
                        false,
                    })),
                  }
                : t
            )
          );
        }
      } catch (error) {
        console.error("Error:", error);
        toast({
          title: "Error",
          description: "Failed to update layer order",
          variant: "destructive",
        });
      }
    }

    setDraggedItem(null);
  };

  if (!isConnected || !address) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Templates</h1>
          <p className="text-gray-600">
            Create and manage templates for your collection.{" "}
            <a href="#" className="text-primary hover:underline">
              Learn more
            </a>
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* <Button
            variant="outline"
            onClick={() =>
              setRarityMode((mode) =>
                mode === "percentage" ? "weight" : "percentage"
              )
            }
          >
            {rarityMode === "percentage"
              ? "Using Percentages (%)"
              : "Using Weights (#)"}
          </Button> */}
          <Button onClick={() => setIsCreating(true)}>Create Template</Button>
        </div>
      </div>

      <div className="flex justify-between items-center mb-6">
        <div className="relative w-96">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template) => (
          <div key={template.id} className="border rounded-lg overflow-hidden">
            <div className="relative aspect-square bg-[#f5f5f5] bg-[linear-gradient(45deg,#eee_25%,transparent_25%,transparent_75%,#eee_75%,#eee),linear-gradient(45deg,#eee_25%,transparent_25%,transparent_75%,#eee_75%,#eee)] bg-[length:16px_16px] bg-[position:0_0,8px_8px]">
              {attributes
                .filter((attr) => {
                  const templateAttribute = template.attributes.find(
                    (a) => a.id === attr.id
                  );
                  return templateAttribute?.enabled;
                })
                .sort((a, b) => a.order - b.order)
                .map(
                  (attribute) =>
                    attribute.traits[0] && (
                      <div key={attribute.id} className="absolute inset-0">
                        <img
                          src={`/${attribute.traits[0].imagePath}`}
                          alt={attribute.name}
                          className={
                            collection?.pixelated
                              ? "object-contain w-full h-full image-rendering-pixelated"
                              : "object-contain w-full h-full"
                          }
                        />
                      </div>
                    )
                )}
              <div className="absolute top-2 right-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 bg-white/80 hover:bg-white"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => setSelectedTemplate(template)}
                    >
                      Edit attributes
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => handleDeleteTemplate(template)}
                    >
                      Delete template
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="font-medium">{template.name}</span>
              </div>

              <div className="space-y-4">
                {rarityMode === "percentage" ? (
                  <>
                    <Slider
                      value={[template.rarity]}
                      onValueChange={([value]) =>
                        handleUpdateTemplateRarity(template.id, value)
                      }
                      min={0}
                      max={100}
                      step={0.1}
                      className="w-full"
                    />
                    <div className="text-sm text-gray-500">
                      Estimated {template.rarity.toFixed(1)}%
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() =>
                        handleUpdateTemplateRarity(
                          template.id,
                          Math.max(0, template.rarity - 1)
                        )
                      }
                    >
                      #
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() =>
                        handleUpdateTemplateRarity(
                          template.id,
                          Math.min(100, template.rarity + 1)
                        )
                      }
                    >
                      %
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Create Template</DialogTitle>
            <DialogDescription>
              Create a new template for your collection.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">
                  Name
                </label>
                <Input
                  id="name"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="Enter template name"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Attributes</label>
                <div className="space-y-2">
                  {newTemplateAttributes
                    .sort((a, b) => a.order - b.order)
                    .map((templateAttr, index) => {
                      const attribute = attributes.find(
                        (a) => a.id === templateAttr.id
                      );
                      if (!attribute) return null;

                      return (
                        <div
                          key={attribute.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragEnd={handleDragEnd}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, index)}
                          className="flex items-center justify-between p-2 bg-background border rounded-md cursor-move transition-opacity duration-200"
                        >
                          <div className="flex items-center gap-4">
                            <GripVertical className="w-4 h-4 text-muted-foreground" />
                            <div className="relative w-8 h-8 bg-[#f5f5f5] bg-[linear-gradient(45deg,#eee_25%,transparent_25%,transparent_75%,#eee_75%,#eee),linear-gradient(45deg,#eee_25%,transparent_25%,transparent_75%,#eee_75%,#eee)] bg-[length:8px_8px] bg-[position:0_0,4px_4px] rounded-md overflow-hidden">
                              {attribute.traits[0] && (
                                <img
                                  src={`/${attribute.traits[0].imagePath}`}
                                  alt={attribute.name}
                                  className={
                                    collection?.pixelated
                                      ? "w-full h-full object-contain image-rendering-pixelated"
                                      : "w-full h-full object-contain"
                                  }
                                />
                              )}
                            </div>
                            <span className="font-medium">
                              {attribute.name}
                            </span>
                          </div>
                          <Switch
                            checked={templateAttr.enabled}
                            onCheckedChange={(checked) => {
                              setNewTemplateAttributes((prev) =>
                                prev.map((a) =>
                                  a.id === templateAttr.id
                                    ? { ...a, enabled: checked }
                                    : a
                                )
                              );
                            }}
                          />
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            <div>
              <div className="relative aspect-square bg-[#f5f5f5] bg-[linear-gradient(45deg,#eee_25%,transparent_25%,transparent_75%,#eee_75%,#eee),linear-gradient(45deg,#eee_25%,transparent_25%,transparent_75%,#eee_75%,#eee)] bg-[length:16px_16px] bg-[position:0_0,8px_8px] rounded-lg overflow-hidden">
                {newTemplateAttributes
                  .filter((templateAttr) => templateAttr.enabled)
                  .sort((a, b) => a.order - b.order)
                  .map((templateAttr) => {
                    const attribute = attributes.find(
                      (a) => a.id === templateAttr.id
                    );
                    if (!attribute?.traits[0]) return null;

                    return (
                      <div
                        key={attribute.id}
                        className="absolute inset-0 w-full h-full"
                      >
                        <img
                          src={`/${attribute.traits[0].imagePath}`}
                          alt={attribute.name}
                          className={`w-full h-full ${
                            collection?.pixelated
                              ? "object-contain image-rendering-pixelated"
                              : "object-contain"
                          }`}
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                          }}
                        />
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreating(false);
                setNewTemplateName("");
                setNewTemplateAttributes([]);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateTemplate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!selectedTemplate}
        onOpenChange={(open) => !open && setSelectedTemplate(null)}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
            <DialogDescription>
              Edit template attributes and preview changes.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">
                  Name
                </label>
                <Input
                  id="name"
                  value={selectedTemplate?.name || ""}
                  onChange={(e) => {
                    if (!selectedTemplate) return;
                    setEditedTemplates((prev) =>
                      prev.map((t) =>
                        t.id === selectedTemplate.id
                          ? { ...t, name: e.target.value }
                          : t
                      )
                    );
                  }}
                  placeholder="Enter template name"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Attributes</label>
                <div className="space-y-2">
                  {attributes
                    .sort((a, b) => a.order - b.order)
                    .map((attribute, index) => {
                      const templateAttribute =
                        selectedTemplate?.attributes.find(
                          (ta) => ta.id === attribute.id
                        );
                      return (
                        <div
                          key={attribute.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragEnd={handleDragEnd}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, index)}
                          className="flex items-center justify-between p-2 bg-background border rounded-md cursor-move transition-opacity duration-200"
                        >
                          <div className="flex items-center gap-4">
                            <GripVertical className="w-4 h-4 text-muted-foreground" />
                            <div className="relative w-8 h-8 bg-[#f5f5f5] bg-[linear-gradient(45deg,#eee_25%,transparent_25%,transparent_75%,#eee_75%,#eee),linear-gradient(45deg,#eee_25%,transparent_25%,transparent_75%,#eee_75%,#eee)] bg-[length:8px_8px] bg-[position:0_0,4px_4px] rounded-md overflow-hidden">
                              {attribute.traits[0] && (
                                <img
                                  src={`/${attribute.traits[0].imagePath}`}
                                  alt={attribute.name}
                                  className={
                                    collection?.pixelated
                                      ? "w-full h-full object-contain image-rendering-pixelated"
                                      : "w-full h-full object-contain"
                                  }
                                />
                              )}
                            </div>
                            <span className="font-medium">
                              {attribute.name}
                            </span>
                          </div>
                          <Switch
                            checked={templateAttribute?.enabled ?? false}
                            onCheckedChange={(checked) => {
                              if (!selectedTemplate) return;
                              setEditedTemplates((prev) =>
                                prev.map((t) =>
                                  t.id === selectedTemplate.id
                                    ? {
                                        ...t,
                                        attributes: t.attributes.map((a) =>
                                          a.id === attribute.id
                                            ? { ...a, enabled: checked }
                                            : a
                                        ),
                                      }
                                    : t
                                )
                              );
                            }}
                          />
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            <div>
              <div className="relative aspect-square bg-[#f5f5f5] bg-[linear-gradient(45deg,#eee_25%,transparent_25%,transparent_75%,#eee_75%,#eee),linear-gradient(45deg,#eee_25%,transparent_25%,transparent_75%,#eee_75%,#eee)] bg-[length:16px_16px] bg-[position:0_0,8px_8px] rounded-lg overflow-hidden">
                {selectedTemplate &&
                  attributes
                    .filter((attr) => {
                      const templateAttribute =
                        selectedTemplate.attributes.find(
                          (ta) => ta.id === attr.id
                        );
                      return templateAttribute?.enabled;
                    })
                    .sort((a, b) => a.order - b.order)
                    .map((attribute) => {
                      if (!attribute.traits[0]) return null;
                      return (
                        <div
                          key={attribute.id}
                          className="absolute inset-0 w-full h-full"
                        >
                          <img
                            src={`/${attribute.traits[0].imagePath}`}
                            alt={attribute.name}
                            className={`w-full h-full ${
                              collection?.pixelated
                                ? "object-contain image-rendering-pixelated"
                                : "object-contain"
                            }`}
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                            }}
                          />
                        </div>
                      );
                    })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setSelectedTemplate(null);
                setHasChanges(true);
              }}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showRegenerateDialog}
        onOpenChange={setShowRegenerateDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate Tokens</DialogTitle>
            <DialogDescription>
              The template settings have changed. Would you like to regenerate
              the collection tokens with the updated templates?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRegenerateDialog(false)}
            >
              Later
            </Button>
            <Button onClick={handleRegenerateTokens}>Regenerate Now</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            You have unsaved changes
          </p>
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={handleDiscard}>
              Discard Changes
            </Button>
            <Button onClick={handleSaveChanges}>Save Changes</Button>
          </div>
        </div>
      )}
    </div>
  );
}
