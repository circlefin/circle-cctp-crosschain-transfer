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