import React from "react";

interface MediaEmbedProps {
  src: string; // The relative asset name (e.g. "cow.mp3") or full path
  assetsPath: string; // The base URL (e.g. "/api/exercises/farm/assets/")
  className?: string;
}

function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

export const MediaEmbed: React.FC<MediaEmbedProps> = ({ src, assetsPath, className = "" }) => {
  if (!src) return null;

  const ytId = getYouTubeId(src);
  if (ytId) {
    return (
      <div className={`relative aspect-video max-w-xl mx-auto rounded border overflow-hidden bg-black ${className}`}>
        <iframe
          src={`https://www.youtube.com/embed/${ytId}`}
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="w-full h-full"
        />
      </div>
    );
  }

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
