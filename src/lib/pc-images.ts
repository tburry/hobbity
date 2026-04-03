const pcImages = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/images/pcs/*.webp',
  { eager: true }
);

function resolve(path: string): ImageMetadata | undefined {
  return pcImages[path]?.default;
}

export function getAvatarImage(pc: string, level: number): ImageMetadata | undefined {
  return resolve(`/src/assets/images/pcs/${pc}-lvl${level}_avatar.webp`);
}

export function getFullImage(pc: string, level: number): ImageMetadata | undefined {
  return resolve(`/src/assets/images/pcs/${pc}-lvl${level}.webp`);
}

/** Get all full images for a PC across all levels (0 through current level). */
export function getAllFullImages(pc: string, maxLevel: number): { img: ImageMetadata; level: number }[] {
  const images: { img: ImageMetadata; level: number }[] = [];
  for (let lvl = 0; lvl <= maxLevel; lvl++) {
    const img = resolve(`/src/assets/images/pcs/${pc}-lvl${lvl}.webp`);
    if (img) images.push({ img, level: lvl });
  }
  return images;
}
