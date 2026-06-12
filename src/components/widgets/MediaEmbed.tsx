import React from "react";

interface MediaEmbedProps {
  src: string; // The relative asset name (e.g. "cow.mp3") or full path
  assetsPath: string; // The base URL (e.g. "/api/exercises/farm/assets/")
  className?: string;
}

export const MediaEmbed: React.FC<MediaEmbedProps> = ({ src, assetsPath, className = "" }) => {
  if (!src) return null;

  // Resolve absolute URL
  const url = src.startsWith("http") || src.startsWith("/") ? src : `${assetsPath}${src}`;
  const ext = src.substring(src.lastIndexOf(".")).toLowerCase();

  const isImage = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"].includes(ext);
  const isAudio = [".mp3", ".ogg", ".wav", ".m4a"].includes(ext);
  const isVideo = [".mp4", ".webm", ".mkv"].includes(ext);

  if (isImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt="Exercise asset"
        className={`max-w-full h-auto rounded border border-neutral-300 dark:border-neutral-700 object-contain ${className}`}
      />
    );
  }

  if (isAudio) {
    return (
      <div className={`py-2 ${className}`}>
        <audio src={url} controls className="w-full max-w-md mx-auto" />
      </div>
    );
  }

  if (isVideo) {
    return (
      <div className={`relative aspect-video max-w-xl mx-auto rounded border overflow-hidden bg-black ${className}`}>
        <video src={url} controls className="w-full h-full" />
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 underline text-sm break-all"
    >
      Download Asset ({src})
    </a>
  );
};
