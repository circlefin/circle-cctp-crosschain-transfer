/**
 * Copyright (c) 2025, Circle Internet Group, Inc. All rights reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
        <TabsTrigger value="fast">Fast Transfer</TabsTrigger>
        <TabsTrigger value="standard">Standard Transfer</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}