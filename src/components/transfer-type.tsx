"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function TransferTypeSelector({
  value,
  onChange,
}: {
  value: "fast" | "standard";
  onChange: (value: "fast" | "standard") => void;
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as "fast" | "standard")}>
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="fast">🚀 V2 Fast</TabsTrigger>
        <TabsTrigger value="standard">🛡️ V1 Standard</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}