"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Attribute, Trait } from "@prisma/client";
import { Loader2, Search, MoreHorizontal } from "lucide-react";
import { useAccount } from "wagmi";
import { Input } from "@/components/ui/input";
type RuleType = "EXCLUDE" | "ONLY_TOGETHER" | "ALWAYS_TOGETHER";

interface TraitRule {
  id: string;
  ruleType: RuleType;
  traits: (Trait & { attribute: Attribute })[];
  collectionId: string;
  createdAt: string;
  updatedAt: string;
}

interface TraitsByAttribute {
  [key: string]: {
    count: number;
    traits: Trait[];
    attribute: Attribute;
  };
}

const RULE_TYPE_LABELS: Record<RuleType, string> = {
  EXCLUDE: "Doesn't mix with",
  ONLY_TOGETHER: "Only mixes with",
  ALWAYS_TOGETHER: "Always pairs with",
};

export default function RulesPage({ params }: { params: { id: string } }) {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [firstSelection, setFirstSelection] = useState<{
    type: "trait" | "attribute";
    id: string;
  } | null>(null);
  const [secondSelection, setSecondSelection] = useState<
    { type: "trait" | "attribute"; id: string }[]
  >([]);
  const [ruleType, setRuleType] = useState<RuleType>("EXCLUDE");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: attributes = [] } = useQuery<Attribute[]>({
    queryKey: ["attributes", params.id],
    queryFn: async () => {
      if (!address) throw new Error("No address available");

      const res = await fetch(
        `/api/collections/${params.id}/attributes?address=${address}`
      );
      if (!res.ok) throw new Error("Failed to fetch attributes");
      return res.json();
    },
    enabled: !!address,
  });

  const { data: traits = [], isLoading } = useQuery<Trait[]>({
    queryKey: ["traits", params.id],
    queryFn: async () => {
      if (!address) throw new Error("No address available");

      const res = await fetch(
        `/api/collections/${params.id}/attributes?address=${address}`
      );
      if (!res.ok) throw new Error("Failed to fetch traits");
      const attributes = await res.json();
      return attributes.flatMap(
        (attr: Attribute & { traits: Trait[] }) => attr.traits
      );
    },
    enabled: !!address,
  });

  const { data: rules = [] } = useQuery<TraitRule[]>({
    queryKey: ["rules", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/collections/${params.id}/rules`, {
        headers: {
          "x-address": address || "",
        },
      });
      if (!res.ok) throw new Error("Failed to fetch rules");
      return res.json();
    },
    enabled: !!address,
  });

  // Group rules by attribute
  const rulesByAttribute = rules.reduce<Record<string, TraitRule[]>>(
    (acc, rule) => {
      const firstTrait = rule.traits[0];
      if (!firstTrait) return acc;

      const attribute = attributes.find((a) => a.id === firstTrait.attributeId);
      if (!attribute) return acc;

      if (!acc[attribute.name]) {
        acc[attribute.name] = [];
      }
      acc[attribute.name].push(rule);
      return acc;
    },
    {}
  );

  const filteredRulesByAttribute = Object.entries(rulesByAttribute)
    .filter(
      ([attributeName]) =>
        attributeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rulesByAttribute[attributeName].some((rule) =>
          rule.traits.some((trait) =>
            trait.name.toLowerCase().includes(searchQuery.toLowerCase())
          )
        )
    )
    .reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {} as Record<string, TraitRule[]>);

  const traitsByAttribute = traits.reduce<TraitsByAttribute>((acc, trait) => {
    const attributeId = trait.attributeId;
    const attribute = attributes.find((a) => a.id === attributeId);
    if (!attribute) return acc;

    if (!acc[attributeId]) {
      acc[attributeId] = { count: 0, traits: [], attribute };
    }
    acc[attributeId].count++;
    acc[attributeId].traits.push(trait);
    return acc;
  }, {});

  const handleEditRule = (rule: TraitRule) => {
    setFirstSelection({ type: "trait", id: rule.traits[0].id });
    setSecondSelection(
      rule.traits.slice(1).map((trait) => ({ type: "trait", id: trait.id }))
    );
    setRuleType(rule.ruleType);
    setIsCreateOpen(true);
  };

  const handleCreateRule = async () => {
    if (!firstSelection || secondSelection.length === 0 || !address) return;

    try {
      const traitIds = [
        ...(firstSelection.type === "trait"
          ? [firstSelection.id]
          : traitsByAttribute[firstSelection.id].traits.map((t) => t.id)),
        ...secondSelection.flatMap((selection) =>
          selection.type === "trait"
            ? [selection.id]
            : traitsByAttribute[selection.id].traits.map((t) => t.id)
        ),
      ];

      const res = await fetch(`/api/collections/${params.id}/rules`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-address": address,
        },
        body: JSON.stringify({
          ruleType,
          traitIds,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create rule");
      }

      await queryClient.invalidateQueries({ queryKey: ["rules", params.id] });
      setIsCreateOpen(false);
      setFirstSelection(null);
      setSecondSelection([]);
    } catch (error) {
      console.error("Failed to create rule:", error);
    }
  };

  const renderTraitList = (isFirstSelection: boolean = false) => {
    // Get the attribute ID of the first selection if it exists
    const firstSelectionAttributeId =
      !isFirstSelection && firstSelection?.type === "trait"
        ? traits.find((t) => t.id === firstSelection.id)?.attributeId
        : firstSelection?.type === "attribute"
        ? firstSelection.id
        : null;

    const filteredAttributes = Object.entries(traitsByAttribute).filter(
      ([, { attribute }]: [string, { attribute: Attribute }]) => {
        return attribute.name.toLowerCase().includes(searchQuery.toLowerCase());
      }
    );

    return (
      <div className="space-y-4">
        {filteredAttributes.map(
          ([attributeId, { count, traits, attribute }]) => {
            const isAttributeDisabled =
              !isFirstSelection && attributeId === firstSelectionAttributeId;

            return (
              <div key={attributeId} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (isAttributeDisabled) return;
                        const selection = {
                          type: "attribute" as const,
                          id: attributeId,
                        };
                        if (isFirstSelection) {
                          setFirstSelection(selection);
                        } else {
                          setSecondSelection((prev) =>
                            prev.some((s) => s.id === attributeId)
                              ? prev.filter((s) => s.id !== attributeId)
                              : [...prev, selection]
                          );
                        }
                      }}
                      className={`text-sm font-medium hover:underline cursor-pointer ${
                        isAttributeDisabled
                          ? "opacity-50 cursor-not-allowed hover:no-underline"
                          : ""
                      }`}
                    >
                      {attribute.name}
                    </button>
                    <span className="text-muted-foreground text-sm">
                      {count} traits
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isAttributeDisabled}
                    className={isAttributeDisabled ? "opacity-50" : ""}
                  >
                    Select All
                  </Button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {traits.map((trait) => (
                    <div
                      key={trait.id}
                      onClick={() => {
                        if (isAttributeDisabled) return;
                        const selection = {
                          type: "trait" as const,
                          id: trait.id,
                        };
                        if (isFirstSelection) {
                          setFirstSelection(selection);
                        } else {
                          setSecondSelection((prev) =>
                            prev.some((s) => s.id === trait.id)
                              ? prev.filter((s) => s.id !== trait.id)
                              : [...prev, selection]
                          );
                        }
                      }}
                      className={`p-2 border rounded-lg cursor-pointer hover:bg-accent ${
                        (isFirstSelection && firstSelection?.id === trait.id) ||
                        (!isFirstSelection &&
                          secondSelection.some((s) => s.id === trait.id))
                          ? "border-primary bg-primary/10"
                          : ""
                      } ${
                        isAttributeDisabled
                          ? "opacity-50 cursor-not-allowed hover:bg-transparent"
                          : ""
                      }`}
                    >
                      {trait.imagePath && (
                        <img
                          src={`/${trait.imagePath}`}
                          alt={trait.name}
                          className="aspect-square rounded object-cover mb-2"
                        />
                      )}
                      {!trait.imagePath && (
                        <div className="aspect-square rounded bg-background mb-2" />
                      )}
                      <div className="text-xs truncate">{trait.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          }
        )}
      </div>
    );
  };

  const getSelectionDisplay = (selection: {
    type: "trait" | "attribute";
    id: string;
  }) => {
    if (selection.type === "trait") {
      const trait = traits.find((t) => t.id === selection.id);
      return trait?.name || "Unknown trait";
    } else {
      const attribute = attributes.find((a) => a.id === selection.id);
      return attribute?.name || "Unknown attribute";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Rules</h1>
          <p className="text-muted-foreground">
            Use rules to control what traits can be combined with other traits.
            <button
              className="ml-1 text-primary hover:underline"
              onClick={() => {}}
            >
              Learn more
            </button>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            Analyze Rules <span className="text-muted-foreground">⌘A</span>
          </Button>
          <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
            New <span className="text-muted-foreground">⌘N</span>
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by rule, attribute or trait..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="border rounded-lg divide-y">
          {isLoading ? (
            <div className="flex justify-center p-4">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : Object.keys(filteredRulesByAttribute).length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              No rules found. Rules are great for simple, straightforward
              pairing requirements.
            </div>
          ) : (
            Object.entries(filteredRulesByAttribute).map(
              ([attributeName, attributeRules]) => (
                <div key={attributeName} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{attributeName}</span>
                      <span className="text-sm text-muted-foreground">
                        {attributeRules.length} rule
                        {attributeRules.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {attributeRules.map((rule) => (
                      <div
                        key={rule.id}
                        onClick={() => handleEditRule(rule)}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 cursor-pointer group"
                      >
                        <div className="flex items-center gap-6">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-muted-foreground">
                              {rule.traits[0]?.attribute?.name}
                            </span>
                            <div className="flex items-center gap-2">
                              {rule.traits[0]?.imagePath ? (
                                <img
                                  src={`/${rule.traits[0].imagePath}`}
                                  alt={rule.traits[0].name}
                                  className="w-8 h-8 rounded-sm object-cover"
                                />
                              ) : (
                                <div className="w-8 h-8 bg-background rounded-sm" />
                              )}
                              <span className="text-sm">
                                {rule.traits[0]?.name}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="text-primary">
                              <svg
                                width="20"
                                height="20"
                                viewBox="0 0 15 15"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  d="M3.5 7.5L7.5 3.5L11.5 7.5L7.5 11.5L3.5 7.5Z"
                                  stroke="currentColor"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {RULE_TYPE_LABELS[rule.ruleType]}
                            </span>
                          </div>

                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-muted-foreground">
                              {rule.traits.length} traits
                            </span>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center">
                                {rule.traits[1]?.imagePath && (
                                  <div className="relative">
                                    <img
                                      src={`/${rule.traits[1].imagePath}`}
                                      alt={rule.traits[1].name}
                                      className="w-8 h-8 rounded-sm object-cover"
                                    />
                                    {rule.traits.length > 2 && (
                                      <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                                        +{rule.traits.length - 2}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              <span className="text-sm">
                                {rule.traits[1]?.name}
                                {rule.traits.length > 2 &&
                                  `, ${rule.traits[2]?.name}`}
                                {rule.traits.length > 3 && " & ..."}
                              </span>
                            </div>
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 h-8 w-8"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )
          )}
        </div>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 border rounded-lg p-2">
                {firstSelection ? (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-background rounded" />
                    <span>{getSelectionDisplay(firstSelection)}</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Select a Trait</span>
                )}
              </div>
              <Select
                value={ruleType}
                onValueChange={(value) => setRuleType(value as RuleType)}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RULE_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex-1 border rounded-lg p-2">
                {secondSelection.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-background rounded" />
                    <span>{`${secondSelection.length} selected`}</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Select a Trait</span>
                )}
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search traits..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <ScrollArea className="h-[400px] border rounded-lg p-4">
              {renderTraitList(!firstSelection)}
            </ScrollArea>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateRule}
                disabled={!firstSelection || secondSelection.length === 0}
              >
                Create Rule
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
