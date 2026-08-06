type ImagePickerModule = typeof import("expo-image-picker");

let cached: ImagePickerModule | null | undefined;

/** Lazily load expo-image-picker so screens don't crash on builds without the native module. */
export function getImagePicker(): ImagePickerModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("expo-image-picker") as ImagePickerModule;
    if (typeof mod?.launchImageLibraryAsync !== "function") {
      cached = null;
      return cached;
    }
    cached = mod;
  } catch {
    cached = null;
  }
  return cached;
}

export function isImagePickerAvailable() {
  return Boolean(getImagePicker());
}
