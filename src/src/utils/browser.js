const isBrowser = typeof window !== 'undefined'

export const isNotificationSupported = () =>
  isBrowser && 'Notification' in window && typeof Notification?.requestPermission === 'function'
