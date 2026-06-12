"use client";

import React, { useEffect } from "react";
import { WidgetProps, MediaConfig } from "./types";
import { MediaEmbed } from "./MediaEmbed";

export const MediaOnly: React.FC<WidgetProps<MediaConfig>> = ({
  config,
  onChange,
  assetsPath,
}) => {
  useEffect(() => {
    // Media block has 0 points, always complete
    onChange({}, true, 100);
  }, [onChange]);

  return (
    <div className="flex justify-center p-2">
      <div className="w-full max-w-xl">
        <MediaEmbed src={config.media} assetsPath={assetsPath} />
      </div>
    </div>
  );
};

export default MediaOnly;
