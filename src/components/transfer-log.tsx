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

import { useEffect, useRef } from 'react';

export function TransferLog({ logs }: { logs: string[] }) {
  const logsEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logsEndRef.current && containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const isNearBottom = scrollHeight - (scrollTop + clientHeight) < 100;

      if (isNearBottom) {
        logsEndRef.current.scrollIntoView({
          behavior: "smooth",
          block: "nearest"
        });
      }
    }
  }, [logs]);

  return (
    <div ref={containerRef} className="w-full max-w-2xl mx-auto mt-8 p-4 bg-gray-50 rounded-lg h-64 overflow-y-auto">
      <div className="text-sm font-mono">
        {logs.map((log, index) => (
          <div key={index} className="text-gray-700">
            {log} {/* Timestamp is now pre-rendered in the log message */}
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}