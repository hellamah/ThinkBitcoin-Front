import { describe, expect, it, vi } from 'vitest'
import {
  executeNotificationWorkflow,
  NotificationWorkflowStep,
  WorkflowStatus,
} from '../src/utils/workflow'

describe('utils/workflow', () => {
  it('retorna fluxo de desativação quando notificações forem desligadas', async () => {
    const result = await executeNotificationWorkflow({
      enabled: false,
      token: null,
      isNotificationSupported: vi.fn(),
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

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.exemplo.com/ThinkBitcoin/notificacoes/subscribe',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer token-123' },
      }
    )
    expect(result.status).toBe(WorkflowStatus.SUCCESS)
    expect(result.step).toBe(NotificationWorkflowStep.ENABLED)
    expect(result.messageKey).toBe('notificationsOn')
    expect(result.shouldEnableNotifications).toBe(true)
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
})
