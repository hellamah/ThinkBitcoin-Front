import { API_URL } from '../api'

export const WorkflowStatus = Object.freeze({
  SUCCESS: 'success',
  FAILED: 'failed',
  SKIPPED: 'skipped',
})

export const NotificationWorkflowStep = Object.freeze({
  ENABLED: 'enabled',
  DISABLED: 'disabled',
  UNSUPPORTED: 'unsupported',
  DENIED: 'denied',
  ERROR: 'error',
})

const NotificationPermission = Object.freeze({
  GRANTED: 'granted',
})

const NotificationMessageKey = Object.freeze({
  ON: 'notificationsOn',
  OFF: 'notificationsOff',
  UNSUPPORTED: 'notificationsUnsupported',
  DENIED: 'notificationsDenied',
  ERROR: 'notificationsError',
})

export const executeNotificationWorkflow = async ({
  enabled,
  token,
  isNotificationSupported,
  notificationApi,
  fetchImpl = fetch,
  baseUrl = API_URL,
}) => {
  if (!enabled) {
    return {
      status: WorkflowStatus.SKIPPED,
      step: NotificationWorkflowStep.DISABLED,
      messageKey: NotificationMessageKey.OFF,
      shouldEnableNotifications: false,
    }
  }

  if (!isNotificationSupported()) {
    return {
      status: WorkflowStatus.FAILED,
      step: NotificationWorkflowStep.UNSUPPORTED,
      messageKey: NotificationMessageKey.UNSUPPORTED,
      shouldEnableNotifications: false,
    }
  }

  try {
    const permission = await notificationApi.requestPermission()

    if (permission !== NotificationPermission.GRANTED) {
      return {
        status: WorkflowStatus.FAILED,
        step: NotificationWorkflowStep.DENIED,
        messageKey: NotificationMessageKey.DENIED,
        shouldEnableNotifications: false,
      }
    }

    // O endpoint de subscribe foi removido. Agora as notificações são controladas via preferências.

    return {
      status: WorkflowStatus.SUCCESS,
      step: NotificationWorkflowStep.ENABLED,
      messageKey: NotificationMessageKey.ON,
      shouldEnableNotifications: true,
    }
  } catch {
    return {
      status: WorkflowStatus.FAILED,
      step: NotificationWorkflowStep.ERROR,
      messageKey: NotificationMessageKey.ERROR,
      shouldEnableNotifications: false,
    }
  }
}
