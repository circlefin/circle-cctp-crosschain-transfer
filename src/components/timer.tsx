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

import { useState, useEffect, useRef } from "react";

interface TimerProps {
  isRunning: boolean;
  onTick?: (seconds: number) => void;
  initialSeconds?: number;
}

export function Timer({ isRunning, onTick }: TimerProps) {
  const startTimeRef = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const animationRef = useRef<number | undefined>(undefined);
  const onTickRef = useRef(onTick);
  useEffect(() => {
    onTickRef.current = onTick;
  }, [onTick]);

  useEffect(() => {
    if (isRunning && startTimeRef.current === null) {
      startTimeRef.current = Date.now();
    } else if (!isRunning && startTimeRef.current !== null) {
      startTimeRef.current = null;
    }
  }, [isRunning]);

  useEffect(() => {
    const animate = () => {
      if (startTimeRef.current !== null) {
        const now = Date.now();
        const newElapsed = Math.floor((now - startTimeRef.current) / 1000);
        setElapsed(newElapsed);
        onTickRef.current?.(newElapsed);
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    if (isRunning) {
      animationRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRunning]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return (
    <div className="text-2xl font-mono">
      <span>{minutes.toString().padStart(2, "0")}</span>:<span>{seconds.toString().padStart(2, "0")}</span>
    </div>
  );
}
