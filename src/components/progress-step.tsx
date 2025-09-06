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

import { cn } from "@/lib/utils";

const steps = [
  { name: 'Approval', statusKey: 'approving' },
  { name: 'Burn', statusKey: 'burning' },
  { name: 'Attestation', statusKey: 'waiting-attestation' },
  { name: 'Mint', statusKey: 'minting' },
];

export function ProgressSteps({ currentStep }: { currentStep: string }) {
  const getStepState = (index: number) => {
    const currentIndex = steps.findIndex(s => s.statusKey === currentStep);
    
    if (currentStep === 'completed') return 'completed';
    if (currentIndex === index) return 'active';
    if (currentIndex > index) return 'done';
    return 'pending';
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex justify-between">
        {steps.map((step, index) => {
          const state = getStepState(index);
          return (
            <div key={step.name} className="flex flex-col items-center w-1/4">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-300',
                  state === 'active' && 'bg-blue-600 text-white',
                  state === 'done' && 'bg-green-500 text-white',
                  state === 'completed' && 'bg-green-500 text-white',
                  state === 'pending' && 'bg-gray-200'
                )}
              >
                {index + 1}
              </div>
              <div className="mt-2 text-sm text-center">{step.name}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}