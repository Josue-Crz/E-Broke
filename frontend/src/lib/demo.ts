// Demo mode (hackathon presentations): any email domain is accepted and the
// verification code is shown on screen. Must match the backend's DEMO_MODE flag.
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'

const anyEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const sfsuEmail = /^[^\s@]+@sfsu\.edu$/i

export function isAllowedEmail(email: string) {
  return (DEMO_MODE ? anyEmail : sfsuEmail).test(email.trim())
}

export const emailErrorMessage = DEMO_MODE
  ? 'Enter a valid email address.'
  : 'Use your @sfsu.edu email address.'
