import { useState, useEffect, useCallback, useRef } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import {
  MdCheck,
  MdPayment,
  MdHourglassEmpty,
  MdAccountBalance,
  MdWarning,
  MdContentCopy,
  MdQrCode2,
  MdArrowBack,
} from 'react-icons/md'

import Modal from './Modal'
import { apiRequest, PlanosPagamentoEndpoint, AuthenticationEndpoint, HttpMethod } from '../utils/apiClient'
import { useAuth } from '../context/AuthContext'
import useTranslation from '../hooks/useTranslation'

const POLL_INTERVAL_MS = 4000

const Step = Object.freeze({
  LISTA: 'lista',
  CONFIRMAR: 'confirmar',
  PAGAMENTO: 'pagamento',
  SUCESSO: 'sucesso',
})

const CobrancaStatus = Object.freeze({
  PENDENTE: 'PENDENTE',
  PAGO: 'PAGO',
  EXPIRADO: 'EXPIRADO',
  CANCELADO: 'CANCELADO',
})

const formatBRL = (valor) => `R$ ${Number(valor ?? 0).toFixed(2)}`

// Monta o body legado do endpoint migrar (usado apenas para plano gratuito;
// planos pagos são ativados pelo backend após confirmação do pagamento).
const buildMigrarBody = (plano, user) => ({
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
    ticks: plano.horarioLimiteSolicitacao?.ticks || 0,
  },
  taxaSaqueAntecipado: plano.taxaSaqueAntecipado,
  taxaResgate: plano.taxaResgate,
  valorMinimoResgate: plano.valorMinimoResgate,
  saldoMinimoPermanencia: plano.saldoMinimoPermanencia,
  limiteDiarioResgate: plano.limiteDiarioResgate,
  tipoPlano: plano.idPlanoPagamento, // idPlanoPagamento representa o tipo do plano no mock/migrar
  permiteResgateParcial: plano.permiteResgateParcial,
})

export default function PlanosPagamentoModal({ visible, onClose, token, user, onRefresh }) {
  const { t } = useTranslation()
  const { login } = useAuth()
  const [planos, setPlanos] = useState([])
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(Step.LISTA)
  const [planoSelecionado, setPlanoSelecionado] = useState(null)
  const [cobranca, setCobranca] = useState(null)
  const [processando, setProcessando] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const pollRef = useRef(null)
  const copiadoRef = useRef(null)

  useEffect(() => () => clearTimeout(copiadoRef.current), [])

  const carregarPlanos = useCallback(async () => {
    if (!token) return []
    try {
      const res = await apiRequest(PlanosPagamentoEndpoint.LIST)
      const lista = res?.resultado?.planos || []
      setPlanos(lista)
      return lista
    } catch (err) {
      console.error('Erro ao listar planos:', err)
      setErrorMsg(t('planos.migrateError'))
      return []
    }
  }, [token, t])

  // Ao abrir: carrega planos e retoma cobrança Pix pendente, se houver
  // (evita gerar uma segunda cobrança quando o usuário fechou o modal no
  // meio do pagamento).
  useEffect(() => {
    if (!visible) return
    let ativo = true
    setErrorMsg('')
    setCopiado(false)
    setLoading(true)
    ;(async () => {
      const lista = await carregarPlanos()
      try {
        // suppressAuthRedirect: enquanto o backend não implementar este
        // endpoint, um 401/404 aqui não pode derrubar a sessão do usuário.
        const res = await apiRequest(PlanosPagamentoEndpoint.COBRANCA_PENDENTE, {
          suppressAuthRedirect: true,
        })
        const pendente = res?.resultado?.cobranca
        if (ativo && pendente?.status === CobrancaStatus.PENDENTE) {
          setCobranca(pendente)
          setPlanoSelecionado(
            lista.find((p) => p.idPlanoPagamento === pendente.tipoPlano) || null
          )
          setStep(Step.PAGAMENTO)
        } else if (ativo) {
          setStep(Step.LISTA)
        }
      } catch (err) {
        // Consulta de pendência é acessória: sem ela o fluxo segue pela lista.
        console.error('Erro ao consultar cobrança pendente:', err)
        if (ativo) setStep(Step.LISTA)
      } finally {
        if (ativo) setLoading(false)
      }
    })()
    return () => {
      ativo = false
    }
  }, [visible, carregarPlanos])

  const concluirPagamento = useCallback(async () => {
    setStep(Step.SUCESSO)
    setCobranca(null)
    await carregarPlanos()
    if (onRefresh) await onRefresh()
    // O cargo (permissões) acompanha a assinatura, mas viaja no token:
    // renova o token para as permissões novas valerem sem relogin.
    try {
      const res = await apiRequest(AuthenticationEndpoint.RENOVAR, {
        method: HttpMethod.POST,
        suppressAuthRedirect: true,
      })
      const novoToken = res?.resultado?.tokenAutenticado
      if (novoToken) await login(novoToken)
    } catch (err) {
      // Sem renovação, as permissões novas valem no próximo login.
      console.error('Erro ao renovar token após troca de plano:', err)
    }
  }, [carregarPlanos, onRefresh, login])

  // Polling do status da cobrança enquanto o QR code está na tela. Quem
  // ativa o plano é o backend (webhook do gateway); aqui só refletimos.
  //
  // `visible` entra na condição E nas dependências. O componente fica montado o
  // tempo todo — Settings o renderiza sempre, e é o `Modal` que devolve null —,
  // então sem esta guarda fechar a tela no meio de um pagamento deixava uma
  // consulta a cada 4 segundos rodando indefinidamente, invisível, até sair de
  // Configurações. Pior: se o Pix caísse nesse intervalo, `concluirPagamento`
  // trocava o token do usuário com a tela fechada e nada na interface dizia
  // que a assinatura tinha mudado.
  useEffect(() => {
    if (!visible || step !== Step.PAGAMENTO || !cobranca?.idCobranca) return undefined
    const consultar = async () => {
      try {
        const res = await apiRequest(
          PlanosPagamentoEndpoint.COBRANCA(cobranca.idCobranca),
          { forceRefresh: true, suppressAuthRedirect: true }
        )
        const atual = res?.resultado?.cobranca
        if (!atual) return
        if (atual.status === CobrancaStatus.PAGO) {
          await concluirPagamento()
        } else if (
          atual.status === CobrancaStatus.EXPIRADO ||
          atual.status === CobrancaStatus.CANCELADO
        ) {
          setCobranca(null)
          setStep(Step.LISTA)
          setErrorMsg(t('planos.paymentExpired'))
        }
      } catch (err) {
        // Falha pontual de rede não interrompe o polling.
        console.error('Erro ao consultar status da cobrança:', err)
      }
    }
    pollRef.current = setInterval(consultar, POLL_INTERVAL_MS)
    return () => clearInterval(pollRef.current)
  }, [visible, step, cobranca?.idCobranca, concluirPagamento, t])

  const selecionarPlano = (plano) => {
    setErrorMsg('')
    setPlanoSelecionado(plano)
    setStep(Step.CONFIRMAR)
  }

  const confirmarSelecao = async () => {
    if (!planoSelecionado) return
    setProcessando(true)
    setErrorMsg('')
    try {
      if (planoSelecionado.valor > 0) {
        const res = await apiRequest(PlanosPagamentoEndpoint.CHECKOUT, {
          method: HttpMethod.POST,
          body: {
            idUsuarioTB: user?.idUsuarioTB,
            tipoPlano: planoSelecionado.idPlanoPagamento,
            nomePlano: planoSelecionado.nome,
            valor: planoSelecionado.valor,
          },
        })
        const nova = res?.resultado?.cobranca
        if (!nova?.idCobranca) throw new Error('Resposta de checkout sem cobrança')
        setCobranca(nova)
        setStep(Step.PAGAMENTO)
      } else {
        // Plano gratuito não passa pelo gateway: migração direta.
        await apiRequest(PlanosPagamentoEndpoint.MIGRATE, {
          method: HttpMethod.POST,
          body: buildMigrarBody(planoSelecionado, user),
        })
        await concluirPagamento()
      }
    } catch (err) {
      console.error(err)
      setErrorMsg(
        planoSelecionado.valor > 0 ? t('planos.checkoutError') : t('planos.migrateError')
      )
    } finally {
      setProcessando(false)
    }
  }

  const copiarCodigoPix = async () => {
    if (!cobranca?.pixCopiaECola) return
    try {
      await navigator.clipboard.writeText(cobranca.pixCopiaECola)
      setCopiado(true)
      // Guardado em ref e cancelado no desmonte: solto, o timer de 2,5s
      // continuava vivo depois de fechar a tela e apagava o "copiado" de uma
      // reabertura seguinte.
      clearTimeout(copiadoRef.current)
      copiadoRef.current = setTimeout(() => setCopiado(false), 2500)
    } catch (err) {
      console.error('Erro ao copiar código Pix:', err)
    }
  }

  const voltarParaLista = () => {
    setStep(Step.LISTA)
    setErrorMsg('')
    setCopiado(false)
  }

  const renderMensagens = () => (
    <>
      {errorMsg && (
        <Box sx={{ backgroundColor: 'var(--danger-a10)', color: 'var(--danger-ink)', p: 2, borderRadius: '10px', mb: 3, display: 'flex', alignItems: 'center', gap: 1.5, border: '1px solid rgba(244, 67, 54, 0.2)' }}>
          <MdWarning />
          <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>{errorMsg}</Typography>
        </Box>
      )}
    </>
  )

  const renderLista = () => (
    <div className="planos-modal-container">
      {planos.map((plano) => {
        const isAtivo = plano.ativo
        return (
          <div key={plano.idPlanoPagamento} className={`pricing-plan-card${isAtivo ? ' active-plan' : ''}`}>
            {/* O nome do plano vinha em `#fff` literal sobre `--surface-panel`,
                que no tema claro é branco a 75%: os cards que NÃO são o plano
                ativo perdiam o título por completo — a tela de assinatura
                mostrava três cartões sem nome, e só o ativo (que usa o ouro)
                continuava legível. */}
            <Typography variant="h6" sx={{ fontWeight: 800, color: isAtivo ? 'var(--color-primary)' : 'var(--text-primary)', mb: 1, textTransform: 'uppercase', fontFamily: "'Share Tech Mono', monospace" }}>
              {plano.nome}
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--text-muted)', minHeight: '60px', mb: 2, fontSize: '0.85rem' }}>
              {plano.descricao}
            </Typography>

            <div className="pricing-value-row">
              <span className="pricing-price-text">
                {plano.valor === 0 ? t('planos.free') : formatBRL(plano.valor)}
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
                {/* `.toLocaleString()` direto no campo da API derrubava a tela
                    inteira — o modal fica sob o ErrorBoundary da raiz — se o
                    plano viesse sem limite diário. Os outros números do cartão
                    já são interpolados crus e sobrevivem a um null. */}
                <span>{t('planos.limiteDiario')}: R$ {Number(plano.limiteDiarioResgate ?? 0).toLocaleString()}</span>
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
                  color: 'var(--accent-ink) !important',
                  opacity: '0.8 !important',
                  backgroundColor: 'var(--accent-a05)'
                }}
              >
                {t('planos.active')}
              </Button>
            ) : (
              <Button
                variant={plano.idPlanoPagamento === 2 ? 'contained' : 'outlined'}
                fullWidth
                onClick={() => selecionarPlano(plano)}
                className={`pricing-btn-migrate ${plano.idPlanoPagamento === 2 ? 'contained' : 'outlined'}`}
              >
                {t('planos.upgrade').toUpperCase()}
              </Button>
            )}
          </div>
        )
      })}
    </div>
  )

  const renderConfirmar = () => {
    const plano = planoSelecionado
    if (!plano) return null
    const pago = plano.valor > 0
    return (
      <Box sx={{ maxWidth: 520, mx: 'auto', width: '100%' }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 3, textAlign: 'center' }}>
          {t('planos.confirmTitle')}
        </Typography>
        <Box sx={{
          border: '1px solid var(--border-strong)',
          borderRadius: '16px',
          p: 3,
          mb: 3,
          backgroundColor: 'var(--surface-subtle)',
        }}>
          <Typography sx={{ fontWeight: 800, color: 'var(--accent-ink)', textTransform: 'uppercase', fontFamily: "'Share Tech Mono', monospace", mb: 0.5, fontSize: '1rem' }}>
            {plano.nome}
          </Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'var(--text-muted)', mb: 2 }}>
            {plano.descricao}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 2 }}>
            <Typography sx={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              {t('planos.duration')}: {plano.duracaoDias} {t('planos.days')}
            </Typography>
            <Typography sx={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              {t('planos.taxaSaque')}: {plano.taxaSaqueAntecipado}%&nbsp;&nbsp;·&nbsp;&nbsp;{t('planos.taxaResgate')}: {plano.taxaResgate}%
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', mt: 1 }}>
            {plano.valor === 0 ? t('planos.free') : formatBRL(plano.valor)}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '0.88rem', color: 'var(--text-muted)', mb: 3, lineHeight: 1.6, textAlign: 'center' }}>
          {pago
            ? t('planos.confirmPaid', { valor: formatBRL(plano.valor), nome: plano.nome })
            : t('planos.confirmFree', { nome: plano.nome })}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, width: '100%' }}>
          <Button
            variant="outlined"
            startIcon={<MdArrowBack />}
            onClick={voltarParaLista}
            disabled={processando}
            sx={{ flex: 1, py: 1.4, borderRadius: '12px', fontWeight: 700 }}
          >
            {t('planos.back')}
          </Button>
          <Button
            variant="contained"
            startIcon={pago ? <MdQrCode2 /> : <MdCheck />}
            onClick={confirmarSelecao}
            disabled={processando}
            sx={{ flex: 1, py: 1.4, borderRadius: '12px', fontWeight: 700 }}
          >
            {processando ? <CircularProgress size={20} color="inherit" /> : (pago ? t('planos.generatePix') : t('planos.confirm'))}
          </Button>
        </Box>
      </Box>
    )
  }

  const renderPagamento = () => {
    if (!cobranca) return null
    const expiraEm = cobranca.expiraEm
      ? new Date(cobranca.expiraEm).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : null
    return (
      <Box sx={{ maxWidth: 440, mx: 'auto', textAlign: 'center' }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
          {t('planos.checkoutTitle')}
        </Typography>
        {planoSelecionado && (
          <Typography sx={{ fontSize: '0.9rem', color: 'var(--text-muted)', mb: 2 }}>
            {planoSelecionado.nome} · {formatBRL(cobranca.valor)}
          </Typography>
        )}
        <Typography sx={{ fontSize: '0.9rem', color: 'var(--text-muted)', mb: 2 }}>
          {t('planos.pixInstructions')}
        </Typography>

        {cobranca.qrCodeBase64 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <img
              src={cobranca.qrCodeBase64}
              alt="QR code Pix"
              style={{ width: 220, height: 220, borderRadius: 12, background: '#fff' }}
            />
          </Box>
        )}

        <Box
          sx={{
            // Tracejado literal em branco: no claro a moldura do Pix
            // copia-e-cola sumia, e o código ficava solto no meio do modal.
            border: '1px dashed var(--border-strong)',
            borderRadius: '10px',
            p: 1.5,
            mb: 2,
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: '0.72rem',
            wordBreak: 'break-all',
            color: 'var(--text-secondary)',
            textAlign: 'left',
          }}
        >
          {cobranca.pixCopiaECola}
        </Box>

        <Button
          variant="outlined"
          startIcon={copiado ? <MdCheck /> : <MdContentCopy />}
          onClick={copiarCodigoPix}
          fullWidth
          sx={{ mb: 2 }}
        >
          {copiado ? t('planos.copied') : t('planos.copyCode')}
        </Button>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, mb: 1 }}>
          <CircularProgress size={16} sx={{ color: 'var(--accent-ink)' }} />
          <Typography sx={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {t('planos.awaitingPayment')}
          </Typography>
        </Box>
        {expiraEm && (
          <Typography sx={{ fontSize: '0.78rem', color: 'var(--text-faint)', mb: 2 }}>
            {t('planos.expiresAt', { hora: expiraEm })}
          </Typography>
        )}

        <Button variant="text" startIcon={<MdArrowBack />} onClick={voltarParaLista} sx={{ color: 'var(--text-muted)' }}>
          {t('planos.back')}
        </Button>
      </Box>
    )
  }

  const renderSucesso = () => (
    <Box sx={{ maxWidth: 440, mx: 'auto', textAlign: 'center', py: 4 }}>
      <Box sx={{ fontSize: '3rem', color: 'var(--success-ink)', mb: 2 }}>
        <MdCheck />
      </Box>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        {t('planos.paymentSuccess')}
      </Typography>
      {planoSelecionado && (
        <Typography sx={{ fontSize: '0.9rem', color: 'var(--text-muted)', mb: 3 }}>
          {planoSelecionado.nome}
        </Typography>
      )}
      <Button variant="contained" onClick={voltarParaLista}>
        {t('planos.viewPlans')}
      </Button>
    </Box>
  )

  const getModalSizeClass = () => {
    // Para a lista de planos (que tem vários cards em grid), mantemos modal-lg (1100px)
    // Para confirmar, pagar (QR code) ou sucesso, usamos modal-md (720px) para não sobrar espaço
    return step === Step.LISTA ? 'modal-lg' : 'modal-md'
  }

  return (
    <Modal visible={visible} onClose={onClose} className={getModalSizeClass()}>
      <Box sx={{ p: 1, maxWidth: '100%' }}>
        <Typography variant="h5" className="patrimonio-title-glow" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <MdPayment style={{ fontSize: '1.8rem' }} /> {t('planos.viewPlans')}
        </Typography>
        <Typography sx={{ color: 'var(--text-faint)', fontSize: '0.9rem', mb: 4, fontFamily: "'Share Tech Mono', monospace" }}>
          MIGRATION_CONTROL // SELEÇÃO_DE_TARIFA_E_LIQUIDEZ
        </Typography>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={40} sx={{ color: 'var(--accent-ink)' }} />
          </Box>
        ) : (
          <>
            {renderMensagens()}
            {step === Step.LISTA && renderLista()}
            {step === Step.CONFIRMAR && renderConfirmar()}
            {step === Step.PAGAMENTO && renderPagamento()}
            {step === Step.SUCESSO && renderSucesso()}
          </>
        )}
      </Box>
    </Modal>
  )
}
