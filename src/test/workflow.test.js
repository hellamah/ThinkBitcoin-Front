/**
 * Testes unitários para utils/workflow.
 * 
 * Este conjunto de testes valida os fluxos de trabalho (workflows) do sistema,
 * garantindo que processos multi-etapa como a ativação de notificações 
 * sejam resilientes e informativos.
 */
import { describe, it, expect, vi } from 'vitest'
import {
  executeNotificationWorkflow,
  NotificationWorkflowStep,
  WorkflowStatus,
} from '../src/utils/workflow'

/**
 * Fábrica de contexto para reduzir repetição nos testes de workflow.
 */
const criarContextoMock = (sobrescrever = {}) => ({
  enabled: true,
  token: null,
  isNotificationSupported: () => true,
  notificationApi: { requestPermission: vi.fn().mockResolvedValue('granted') },
  fetchImpl: vi.fn(),
  baseUrl: 'https://api.thinkbitcoin.com',
  ...sobrescrever,
})

describe('utils/workflow › Enums (Status e Etapas)', () => {
  it('deve expor os status de workflow (Sucesso, Falha, Pulado) corretamente', () => {
    expect(WorkflowStatus.SUCCESS).toBe('success')
    expect(WorkflowStatus.FAILED).toBe('failed')
    expect(WorkflowStatus.SKIPPED).toBe('skipped')
  })

  it('deve conter todas as etapas de erro e suporte para notificações', () => {
    expect(NotificationWorkflowStep.UNSUPPORTED).toBe('unsupported')
    expect(NotificationWorkflowStep.DENIED).toBe('denied')
    expect(NotificationWorkflowStep.ERROR).toBe('error')
  })
})

describe('utils/workflow › executeNotificationWorkflow (Fluxo de Notificações)', () => {
  it('deve PULAR o workflow se as notificações estiverem desabilitadas globalmente', async () => {
    const resultado = await executeNotificationWorkflow(criarContextoMock({ enabled: false }))

    expect(resultado).toMatchObject({
      status: WorkflowStatus.SKIPPED,
      step: NotificationWorkflowStep.DISABLED,
      shouldEnableNotifications: false
    })
  })

  it('deve FALHAR se o navegador do investidor não oferecer suporte a notificações', async () => {
    const resultado = await executeNotificationWorkflow(
      criarContextoMock({ isNotificationSupported: () => false })
    )

    expect(resultado).toMatchObject({
      status: WorkflowStatus.FAILED,
      step: NotificationWorkflowStep.UNSUPPORTED,
      shouldEnableNotifications: false
    })
  })

  it('deve FALHAR se o usuário negar explicitamente a permissão de notificações', async () => {
    const contexto = criarContextoMock({
      notificationApi: { requestPermission: vi.fn().mockResolvedValue('denied') }
    })
    const resultado = await executeNotificationWorkflow(contexto)

    expect(resultado.status).toBe(WorkflowStatus.FAILED)
    expect(resultado.step).toBe(NotificationWorkflowStep.DENIED)
    expect(resultado.shouldEnableNotifications).toBe(false)
  })

  it('deve retornar SUCESSO quando a permissão é concedida (cenário ideal)', async () => {
    const resultado = await executeNotificationWorkflow(criarContextoMock())

    expect(resultado).toMatchObject({
      status: WorkflowStatus.SUCCESS,
      step: NotificationWorkflowStep.ENABLED,
      shouldEnableNotifications: true
    })
  })

  it('deve capturar e tratar erros inesperados (exceções) na API de notificações', async () => {
    const contexto = criarContextoMock({
      notificationApi: { requestPermission: vi.fn().mockRejectedValue(new Error('Browser Crash')) }
    })
    const resultado = await executeNotificationWorkflow(contexto)

    expect(resultado).toMatchObject({
      status: WorkflowStatus.FAILED,
      step: NotificationWorkflowStep.ERROR,
      shouldEnableNotifications: false
    })
  })

  it('deve garantir que "shouldEnableNotifications" seja sempre um booleano determinístico', async () => {
    const cenarios = [
      criarContextoMock({ enabled: false }),
      criarContextoMock({ isNotificationSupported: () => false }),
      criarContextoMock({ notificationApi: { requestPermission: vi.fn().mockResolvedValue('granted') } })
    ]

    for (const cenario of cenarios) {
      const res = await executeNotificationWorkflow(cenario)
      expect(typeof res.shouldEnableNotifications).toBe('boolean')
    }
  })
})
