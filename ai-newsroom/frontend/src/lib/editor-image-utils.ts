import { api } from "@/lib/api";

const MANAGED_IMAGE_PATTERN = /src="(http[^"]+\/img_[^"]+)"/g;

export function extractManagedImageUrls(html: string): Set<string> {
  return new Set(Array.from(html.matchAll(MANAGED_IMAGE_PATTERN)).map((match) => match[1]));
}

export function deleteManagedImages(imageUrls: Iterable<string>) {
  for (const imageUrl of imageUrls) {
    void api.deleteImage(imageUrl).catch(() => {});
  }
}

export function syncManagedImages(
  previousImages: Set<string>,
  currentImages: Set<string>,
): Set<string> {
  const removedImages = Array.from(previousImages).filter((imageUrl) => !currentImages.has(imageUrl));
  deleteManagedImages(removedImages);
  return currentImages;
}
