export function getBackendUrl() {
  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) {
    throw new Error("BACKEND_URL is not configured");
  }
  return backendUrl.replace(/\/$/, "");
}
