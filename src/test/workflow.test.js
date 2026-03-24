import { describe, it, expect, vi } from 'vitest'
import {
  executeNotificationWorkflow,
  NotificationWorkflowStep,
  WorkflowStatus,
} from '../src/utils/workflow'

describe('utils/workflow', () => {
  it('retorna skipped quando notificações estão desabilitadas', async () => {
    const result = await executeNotificationWorkflow({
      enabled: false,
      token: null,
      isNotificationSupported: () => true,
      notificationApi: { requestPermission: vi.fn() },
    })

    expect(result).toEqual({
      status: WorkflowStatus.SKIPPED,
      step: NotificationWorkflowStep.DISABLED,
      messageKey: 'notificationsOff',
      shouldEnableNotifications: false,
    })
  })

  it('retorna falha quando navegador não suporta notificações', async () => {
    const result = await executeNotificationWorkflow({
      enabled: true,
      token: null,
      isNotificationSupported: () => false,
      notificationApi: { requestPermission: vi.fn() },
    })

    expect(result.status).toBe(WorkflowStatus.FAILED)
    expect(result.step).toBe(NotificationWorkflowStep.UNSUPPORTED)
    expect(result.messageKey).toBe('notificationsUnsupported')
    expect(result.shouldEnableNotifications).toBe(false)
  })

  it('retorna sucesso e chama subscribe quando há token e permissão concedida', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true })

    const result = await executeNotificationWorkflow({
      enabled: true,
      token: 'token-123',
      isNotificationSupported: () => true,
      notificationApi: { requestPermission: vi.fn().mockResolvedValue('granted') },
      fetchImpl,
      baseUrl: 'https://api.exemplo.com',
    })

    expect(result.status).toBe(WorkflowStatus.SUCCESS)
    expect(result.step).toBe(NotificationWorkflowStep.ENABLED)
    expect(result.messageKey).toBe('notificationsOn')
    expect(result.shouldEnableNotifications).toBe(true)
  })

  it('retorna sucesso sem chamar subscribe quando token não existir', async () => {
    const fetchImpl = vi.fn()

    const result = await executeNotificationWorkflow({
      enabled: true,
      token: null,
      isNotificationSupported: () => true,
      notificationApi: { requestPermission: vi.fn().mockResolvedValue('granted') },
      fetchImpl,
    })

    expect(fetchImpl).not.toHaveBeenCalled()
    expect(result.status).toBe(WorkflowStatus.SUCCESS)
    expect(result.step).toBe(NotificationWorkflowStep.ENABLED)
  })

  it('retorna falha quando a permissão for negada', async () => {
    const result = await executeNotificationWorkflow({
      enabled: true,
      token: null,
      isNotificationSupported: () => true,
      notificationApi: { requestPermission: vi.fn().mockResolvedValue('denied') },
    })

    expect(result.status).toBe(WorkflowStatus.FAILED)
    expect(result.step).toBe(NotificationWorkflowStep.DENIED)
    expect(result.messageKey).toBe('notificationsDenied')
    expect(result.shouldEnableNotifications).toBe(false)
  })

  it('retorna erro quando requestPermission lança exceção', async () => {
    const result = await executeNotificationWorkflow({
      enabled: true,
      token: 'token-123',
      isNotificationSupported: () => true,
      notificationApi: { requestPermission: vi.fn().mockRejectedValue(new Error('boom')) },
      fetchImpl: vi.fn(),
    })

    expect(result.status).toBe(WorkflowStatus.FAILED)
    expect(result.step).toBe(NotificationWorkflowStep.ERROR)
    expect(result.messageKey).toBe('notificationsError')
    expect(result.shouldEnableNotifications).toBe(false)
  })
})
