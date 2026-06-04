export const LAUNCH_ONBOARDING_KEY = "yds-v1-launch-onboarded"

export function isLaunchOnboardingComplete() {
  if (typeof window === "undefined") return true
  return window.localStorage.getItem(LAUNCH_ONBOARDING_KEY) === "1"
}

export function completeLaunchOnboarding() {
  if (typeof window === "undefined") return
  window.localStorage.setItem(LAUNCH_ONBOARDING_KEY, "1")
}
