"use client"

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Search, X, MoreVertical } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [newTemplateName, setNewTemplateName] = useState("");

  useEffect(() => {
    if (isConnected && address) {
      fetchCollection();
      fetchAttributes();
      fetchTemplates();
    }
  }, [address, isConnected, params.id]);

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

  const handleCreateTemplate = async () => {
    if (!newTemplateName) return;

    try {
      const response = await fetch(
        `/api/collections/${params.id}/templates?address=${address}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: newTemplateName,
            rarity: 100,
            attributes: attributes.map(attr => ({
              id: attr.id,
              enabled: true,
            })),
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to create template");

      const newTemplate = await response.json();
      setTemplates(prev => [...prev, newTemplate]);
      setIsCreating(false);
      setNewTemplateName("");

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

  const handleUpdateTemplate = async (template: Template) => {
    try {
      const response = await fetch(
        `/api/collections/${params.id}/templates/${template.id}?address=${address}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(template),
        }
      );

      if (!response.ok) throw new Error("Failed to update template");

      setTemplates(prev =>
        prev.map(t => (t.id === template.id ? template : t))
      );

      toast({
        title: "Success",
        description: "Template updated successfully",
      });
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Failed to update template",
        variant: "destructive",
      });
    }
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

      setTemplates(prev => prev.filter(t => t.id !== template.id));

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

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isConnected || !address) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Templates</h1>
          <p className="text-gray-600">
            Control the layering and visibility of the Attributes for your Tokens.{" "}
            <a href="#" className="text-primary hover:underline">
              Learn more
            </a>
          </p>
        </div>
      </div>

      <div className="flex justify-between items-center mb-6">
        <div className="relative w-96">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search by template..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-4">
          <Select defaultValue="name-asc">
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name-asc">Trait (A-Z)</SelectItem>
              <SelectItem value="name-desc">Trait (Z-A)</SelectItem>
              <SelectItem value="rarity-asc">Rarity (Low-High)</SelectItem>
              <SelectItem value="rarity-desc">Rarity (High-Low)</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setIsCreating(true)}>+ New</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template) => (
          <div
            key={template.id}
            className="border rounded-lg p-6 hover:border-primary transition-colors cursor-pointer"
            onClick={() => {
              setSelectedTemplate(template);
              setIsEditing(true);
            }}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-semibold">{template.name}</h2>
                <div className="text-sm text-gray-500">
                  {template.attributes.filter(a => a.enabled).length} traits
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTemplate(template);
                  }}>
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="relative aspect-square border rounded-lg overflow-hidden bg-[#f5f5f5]">
              {attributes
                .filter(attr => {
                  const templateAttribute = template.attributes.find(
                    a => a.id === attr.id
                  );
                  return templateAttribute?.enabled;
                })
                .sort((a, b) => a.order - b.order)
                .map((attribute) => (
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
                ))}
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>Estimated</span>
                <span>{template.rarity}%</span>
              </div>
              <div className="w-full h-1 bg-gray-200 rounded-full mt-2">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${template.rarity}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Template</DialogTitle>
            <DialogDescription>
              Create a new template to control layer visibility and order.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Name</label>
              <Input
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="Enter template name"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setIsCreating(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTemplate}>Create Template</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-between mb-6">
            <DialogTitle className="text-2xl">CREATE TEMPLATE</DialogTitle>
            <Button variant="ghost" size="icon" onClick={() => setIsEditing(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {selectedTemplate && (
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <label className="text-sm font-medium mb-2 block">Name</label>
                  <Input
                    value={selectedTemplate.name}
                    onChange={(e) => {
                      setSelectedTemplate({
                        ...selectedTemplate,
                        name: e.target.value,
                      });
                    }}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Attributes</label>
                  <div className="space-y-2">
                    {attributes.map((attribute) => {
                      const templateAttribute = selectedTemplate.attributes.find(
                        a => a.id === attribute.id
                      );
                      return (
                        <div
                          key={attribute.id}
                          className="flex items-center justify-between py-2 px-4 border rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600">::</span>
                            <span>{attribute.name}</span>
                          </div>
                          <Switch
                            checked={templateAttribute?.enabled ?? false}
                            onCheckedChange={(checked) => {
                              setSelectedTemplate({
                                ...selectedTemplate,
                                attributes: selectedTemplate.attributes.map(a =>
                                  a.id === attribute.id
                                    ? { ...a, enabled: checked }
                                    : a
                                ),
                              });
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div>
                <div className="relative aspect-square border rounded-lg overflow-hidden bg-[#f5f5f5]">
                  {attributes
                    .filter(attr => {
                      const templateAttribute = selectedTemplate.attributes.find(
                        a => a.id === attr.id
                      );
                      return templateAttribute?.enabled;
                    })
                    .sort((a, b) => a.order - b.order)
                    .map((attribute) => (
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
                    ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end mt-6">
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white px-8"
              onClick={() => {
                if (selectedTemplate) {
                  handleUpdateTemplate(selectedTemplate);
                  setIsEditing(false);
                }
              }}
            >
              Save Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 