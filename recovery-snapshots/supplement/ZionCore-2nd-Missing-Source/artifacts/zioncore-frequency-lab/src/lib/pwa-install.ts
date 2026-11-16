export function isAppleTouchDevice(
  userAgent: string,
  platform: string,
  maxTouchPoints: number,
): boolean {
  return /iPhone|iPad|iPod/i.test(userAgent)
    || (platform === 'MacIntel' && maxTouchPoints > 1);
}

export function isStandalonePwa(
  displayModeStandalone: boolean,
  navigatorStandalone?: boolean,
): boolean {
  return displayModeStandalone || navigatorStandalone === true;
}
