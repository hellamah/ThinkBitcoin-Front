import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Grid from '@mui/material/Grid'
import { MdCheck, MdPayment, MdHourglassEmpty, MdAccountBalance, MdWarning } from 'react-icons/md'

import Modal from './Modal'
import { apiRequest, PlanosPagamentoEndpoint, HttpMethod } from '../utils/apiClient'
import useTranslation from '../hooks/useTranslation'
import * as mathUtils from '../utils/mathUtils'

export default function PlanosPagamentoModal({ visible, onClose, token, user, onRefresh }) {
  const { t } = useTranslation()
  const [planos, setPlanos] = useState([])
  const [loading, setLoading] = useState(true)
  const [migratingId, setMigratingId] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const carregarPlanos = async () => {
    if (!token) return
    setLoading(true)
    setErrorMsg('')
    try {
      const res = await apiRequest(PlanosPagamentoEndpoint.LIST)
      const lista = res?.resultado?.planos || res?.Resultado?.planos || []
      setPlanos(lista)
    } catch (err) {
      console.error('Erro ao listar planos:', err)
      setErrorMsg(t('planos.migrateError') || 'Erro ao carregar planos de pagamento.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (visible) {
      carregarPlanos()
      setSuccessMsg('')
      setErrorMsg('')
    }
  }, [visible, token])

  const handleMigrar = async (plano) => {
    const confirmacao = window.confirm(
      t('planos.migrateConfirm', { nome: plano.nome }) || 
      `Deseja realmente migrar para o plano ${plano.nome}?`
    )
    if (!confirmacao) return

    setMigratingId(plano.idPlanoPagamento)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      // De acordo com a definição do usuário:
      // O body do migrar espera o idUsuarioTB e as propriedades do plano de destino.
      const body = {
        idUsuarioTB: user?.idUsuarioTB,
        nome: plano.nome,
        valor: plano.valor,
        descricao: plano.descricao,
        duracaoDias: plano.duracaoDias,
        carencia: plano.carencia,
        liquidacao: plano.liquidacao,
        tipoPrazoLiquidacao: plano.tipoPrazoLiquidacao,
        prazoCotizacao: plano.prazoCotizacao,
        horarioLimiteSolicitacao: {
          ticks: plano.horarioLimiteSolicitacao?.ticks || 0
        },
        taxaSaqueAntecipado: plano.taxaSaqueAntecipado,
        taxaResgate: plano.taxaResgate,
        valorMinimoResgate: plano.valorMinimoResgate,
        saldoMinimoPermanencia: plano.saldoMinimoPermanencia,
        limiteDiarioResgate: plano.limiteDiarioResgate,
        tipoPlano: plano.idPlanoPagamento, // idPlanoPagamento representa o tipo do plano no mock/migrar
        permiteResgateParcial: plano.permiteResgateParcial
      }

      await apiRequest(PlanosPagamentoEndpoint.MIGRATE, {
        method: HttpMethod.POST,
        body
      })

      setSuccessMsg(t('planos.migrateSuccess') || 'Plano migrado com sucesso!')
      
      // Atualiza planos locais para refletir a mudança imediatamente
      await carregarPlanos()
      
      // Atualiza o painel pai se aplicável
      if (onRefresh) await onRefresh()
    } catch (err) {
      console.error(err)
      setErrorMsg(t('planos.migrateError') || 'Falha ao migrar plano. Tente novamente.')
    } finally {
      setMigratingId(null)
    }
  }

  return (
    <Modal visible={visible} onClose={onClose} className="modal-lg">
      <Box sx={{ p: 1, maxWidth: '100%' }}>
        <Typography variant="h5" className="patrimonio-title-glow" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <MdPayment style={{ fontSize: '1.8rem' }} /> {t('planos.viewPlans')}
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem', mb: 4, fontFamily: "'Share Tech Mono', monospace" }}>
          MIGRATION_CONTROL // SELEÇÃO_DE_TARIFA_E_LIQUIDEZ
        </Typography>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={40} sx={{ color: 'var(--color-primary)' }} />
          </Box>
        ) : (
          <>
            {errorMsg && (
              <Box sx={{ bgcolor: 'rgba(244, 67, 54, 0.1)', color: '#e57373', p: 2, borderRadius: '10px', mb: 3, display: 'flex', alignItems: 'center', gap: 1.5, border: '1px solid rgba(244, 67, 54, 0.2)' }}>
                <MdWarning />
                <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>{errorMsg}</Typography>
              </Box>
            )}

            {successMsg && (
              <Box sx={{ bgcolor: 'rgba(76, 175, 80, 0.1)', color: '#81c784', p: 2, borderRadius: '10px', mb: 3, display: 'flex', alignItems: 'center', gap: 1.5, border: '1px solid rgba(76, 175, 80, 0.2)' }}>
                <MdCheck />
                <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>{successMsg}</Typography>
              </Box>
            )}

            <div className="planos-modal-container">
              {planos.map((plano) => {
                const isAtivo = plano.ativo
                const isMigrating = migratingId === plano.idPlanoPagamento

                return (
                  <div key={plano.idPlanoPagamento} className={`pricing-plan-card${isAtivo ? ' active-plan' : ''}`}>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: isAtivo ? 'var(--color-primary)' : '#fff', mb: 1, textTransform: 'uppercase', fontFamily: "'Share Tech Mono', monospace" }}>
                      {plano.nome}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', minHeight: '60px', mb: 2, fontSize: '0.85rem' }}>
                      {plano.descricao}
                    </Typography>

                    <div className="pricing-value-row">
                      <span className="pricing-price-text">
                        {plano.valor === 0 ? t('planos.free') : `R$ ${plano.valor.toFixed(2)}`}
                      </span>
                      {plano.valor > 0 && <span className="pricing-period-text">/ {t('planos.duration')} ({plano.duracaoDias} {t('planos.days')})</span>}
                    </div>

                    <div className="pricing-divider" />

                    <div className="pricing-features-list">
                      <div className="pricing-feature-item">
                        <span className="pricing-feature-icon"><MdHourglassEmpty /></span>
                        <span>{t('planos.carencia')}: {plano.carencia} {t('planos.days')}</span>
                      </div>
                      <div className="pricing-feature-item">
                        <span className="pricing-feature-icon"><MdAccountBalance /></span>
                        <span>{t('planos.liquidacao')}: D+{plano.liquidacao} ({plano.permiteResgateParcial ? t('planos.yes') : t('planos.no')} resgate parcial)</span>
                      </div>
                      <div className="pricing-feature-item">
                        <span className="pricing-feature-icon"><MdCheck /></span>
                        <span>{t('planos.taxaSaque')}: {plano.taxaSaqueAntecipado}%</span>
                      </div>
                      <div className="pricing-feature-item">
                        <span className="pricing-feature-icon"><MdCheck /></span>
                        <span>{t('planos.taxaResgate')}: {plano.taxaResgate}%</span>
                      </div>
                      <div className="pricing-feature-item">
                        <span className="pricing-feature-icon"><MdCheck /></span>
                        <span>{t('planos.limiteDiario')}: R$ {plano.limiteDiarioResgate.toLocaleString()}</span>
                      </div>
                    </div>

                    {isAtivo ? (
                      <Button
                        variant="outlined"
                        fullWidth
                        disabled
                        className="pricing-btn-migrate"
                        sx={{
                          borderColor: 'var(--color-primary) !important',
                          color: 'var(--color-primary) !important',
                          opacity: '0.8 !important',
                          bgcolor: 'rgba(255, 215, 0, 0.05)'
                        }}
                      >
                        {t('planos.active')}
                      </Button>
                    ) : (
                      <Button
                        variant={plano.idPlanoPagamento === 2 ? 'contained' : 'outlined'}
                        fullWidth
                        disabled={migratingId !== null}
                        onClick={() => handleMigrar(plano)}
                        className={`pricing-btn-migrate ${plano.idPlanoPagamento === 2 ? 'contained' : 'outlined'}`}
                      >
                        {isMigrating ? (
                          <CircularProgress size={20} color="inherit" />
                        ) : (
                          t('planos.upgrade').toUpperCase()
                        )}
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </Box>
    </Modal>
  )
}
