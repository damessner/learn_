"use client";

import React, { useEffect } from "react";
import { WidgetProps, InstructionConfig } from "./types";

export const InstructionOnly: React.FC<WidgetProps<InstructionConfig>> = ({
  config,
  onChange,
}) => {
  useEffect(() => {
    // Instruction block has 0 points, always complete
    onChange({}, true, 100);
  }, [onChange]);

  return (
    <div className="p-4 bg-neutral-50 dark:bg-neutral-950/20 border border-neutral-250 dark:border-neutral-850 rounded text-sm text-neutral-800 dark:text-neutral-250 whitespace-pre-wrap leading-relaxed">
      {config.text}
    </div>
  );
};

export default InstructionOnly;
