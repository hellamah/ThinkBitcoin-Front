/**
 * Testes unitários para utils/workflow.
 *
 * Cobre:
 * - Enums WorkflowStatus e NotificationWorkflowStep
 * - executeNotificationWorkflow: todos os caminhos de execução
 *   - notificações desabilitadas → SKIPPED/DISABLED
 *   - browser não suporta notificações → FAILED/UNSUPPORTED
 *   - permissão negada → FAILED/DENIED
 *   - permissão granted sem token → SUCCESS/ENABLED
 *   - permissão granted com token → SUCCESS/ENABLED (subscribe não chamado após refatoração)
 *   - requestPermission lança exceção → FAILED/ERROR
 * - Propriedade shouldEnableNotifications em cada cenário
 */
import { describe, it, expect, vi } from 'vitest'
import {
  executeNotificationWorkflow,
  NotificationWorkflowStep,
  WorkflowStatus,
} from '../src/utils/workflow'

// factory para reduzir repetição de boilerplate
const criarContexto = (overrides = {}) => ({
  enabled: true,
  token: null,
  isNotificationSupported: () => true,
  notificationApi: { requestPermission: vi.fn().mockResolvedValue('granted') },
  fetchImpl: vi.fn(),
  baseUrl: 'https://api.exemplo.com',
  ...overrides,
})

describe('utils/workflow › Enums', () => {
  it('WorkflowStatus expõe success, failed e skipped', () => {
    expect(WorkflowStatus.SUCCESS).toBe('success')
    expect(WorkflowStatus.FAILED).toBe('failed')
    expect(WorkflowStatus.SKIPPED).toBe('skipped')
  })

  it('NotificationWorkflowStep expõe todos os passos esperados', () => {
    expect(NotificationWorkflowStep.ENABLED).toBe('enabled')
    expect(NotificationWorkflowStep.DISABLED).toBe('disabled')
    expect(NotificationWorkflowStep.UNSUPPORTED).toBe('unsupported')
    expect(NotificationWorkflowStep.DENIED).toBe('denied')
    expect(NotificationWorkflowStep.ERROR).toBe('error')
  })
})

describe('utils/workflow › executeNotificationWorkflow', () => {
  it('retorna SKIPPED/DISABLED quando notificações estão desabilitadas', async () => {
    const resultado = await executeNotificationWorkflow(criarContexto({ enabled: false }))

    expect(resultado).toEqual({
      status: WorkflowStatus.SKIPPED,
      step: NotificationWorkflowStep.DISABLED,
      messageKey: 'notificationsOff',
      shouldEnableNotifications: false,
    })
  })

  it('não chama requestPermission quando notificações estão desabilitadas', async () => {
    const notificationApi = { requestPermission: vi.fn() }
    await executeNotificationWorkflow(criarContexto({ enabled: false, notificationApi }))

    expect(notificationApi.requestPermission).not.toHaveBeenCalled()
  })

  it('retorna FAILED/UNSUPPORTED quando o browser não suporta notificações', async () => {
    const resultado = await executeNotificationWorkflow(
      criarContexto({ isNotificationSupported: () => false })
    )

    expect(resultado).toEqual({
      status: WorkflowStatus.FAILED,
      step: NotificationWorkflowStep.UNSUPPORTED,
      messageKey: 'notificationsUnsupported',
      shouldEnableNotifications: false,
    })
  })

  it('retorna FAILED/DENIED quando a permissão é negada', async () => {
    const resultado = await executeNotificationWorkflow(
      criarContexto({
        notificationApi: { requestPermission: vi.fn().mockResolvedValue('denied') },
      })
    )

    expect(resultado).toEqual({
      status: WorkflowStatus.FAILED,
      step: NotificationWorkflowStep.DENIED,
      messageKey: 'notificationsDenied',
      shouldEnableNotifications: false,
    })
  })

  it('retorna FAILED/DENIED quando a permissão retorna "default" (não concedida)', async () => {
    const resultado = await executeNotificationWorkflow(
      criarContexto({
        notificationApi: { requestPermission: vi.fn().mockResolvedValue('default') },
      })
    )

    expect(resultado.status).toBe(WorkflowStatus.FAILED)
    expect(resultado.step).toBe(NotificationWorkflowStep.DENIED)
    expect(resultado.shouldEnableNotifications).toBe(false)
  })

  it('retorna SUCCESS/ENABLED quando a permissão é concedida (sem token)', async () => {
    const resultado = await executeNotificationWorkflow(criarContexto({ token: null }))

    expect(resultado).toEqual({
      status: WorkflowStatus.SUCCESS,
      step: NotificationWorkflowStep.ENABLED,
      messageKey: 'notificationsOn',
      shouldEnableNotifications: true,
    })
  })

  it('retorna SUCCESS/ENABLED quando a permissão é concedida (com token)', async () => {
    const resultado = await executeNotificationWorkflow(
      criarContexto({ token: 'jwt-token-123' })
    )

    expect(resultado.status).toBe(WorkflowStatus.SUCCESS)
    expect(resultado.step).toBe(NotificationWorkflowStep.ENABLED)
    expect(resultado.shouldEnableNotifications).toBe(true)
  })

  it('retorna FAILED/ERROR quando requestPermission lança uma exceção', async () => {
    const resultado = await executeNotificationWorkflow(
      criarContexto({
        notificationApi: { requestPermission: vi.fn().mockRejectedValue(new Error('crash')) },
      })
    )

    expect(resultado).toEqual({
      status: WorkflowStatus.FAILED,
      step: NotificationWorkflowStep.ERROR,
      messageKey: 'notificationsError',
      shouldEnableNotifications: false,
    })
  })

  it('retorna FAILED/ERROR quando requestPermission lança um objeto (não-Error)', async () => {
    const resultado = await executeNotificationWorkflow(
      criarContexto({
        notificationApi: { requestPermission: vi.fn().mockRejectedValue('string de erro') },
      })
    )

    expect(resultado.status).toBe(WorkflowStatus.FAILED)
    expect(resultado.step).toBe(NotificationWorkflowStep.ERROR)
  })

  it('shouldEnableNotifications é sempre booleano em todos os cenários', async () => {
    const cenarios = [
      criarContexto({ enabled: false }),
      criarContexto({ isNotificationSupported: () => false }),
      criarContexto({ notificationApi: { requestPermission: vi.fn().mockResolvedValue('denied') } }),
      criarContexto(),
    ]

    for (const cenario of cenarios) {
      const resultado = await executeNotificationWorkflow(cenario)
      expect(typeof resultado.shouldEnableNotifications).toBe('boolean')
    }
  })
})
