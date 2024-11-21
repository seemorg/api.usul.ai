export function bytesToMB(bytes: number) {
  return (bytes / 1024 / 1024).toFixed(1);
}

export const chunk = <T>(arr: T[], size: number) => {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size),
  );
};
