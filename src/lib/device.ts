const KEY = "hisaab.deviceId";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = "DEV_" + crypto.randomUUID().slice(0, 8);
    localStorage.setItem(KEY, id);
  }
  return id;
}
