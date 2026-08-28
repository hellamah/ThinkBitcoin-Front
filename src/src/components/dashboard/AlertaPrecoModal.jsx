import { useState, useEffect, useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'
import Tooltip from '@mui/material/Tooltip'
import {
  MdNotificationsActive,
  MdTrendingUp,
  MdTrendingDown,
  MdDelete,
  MdInfoOutline,
  MdCheckCircle,
} from 'react-icons/md'

import Modal from '../Modal'
import CryptoIcon from '../CryptoIcon'
import useTranslation from '../../hooks/useTranslation'
import * as mathUtils from '../../utils/mathUtils'
import {
  DirecaoAlerta,
  StatusAlerta,
  LIMITE_ALERTAS_ATIVOS,
  contarAtivos,
  inferirDirecao,
  validarAlerta,
} from '../../utils/alertaPreco'

// O backdrop do nosso modal vive em z-index 9999 (App.css) e os popups do MUI
// nascem em 1300: sem subir a camada, o menu do seletor de moeda abria atrás do
// vidro do modal — invisível — e o clique caía no backdrop, que fechava tudo.
const Z_ACIMA_DO_MODAL = 10000

export default function AlertaPrecoModal({
  visible,
  onClose,
  moedas = [],
  moedaInicial,
  alertas = [],
  carregando,
  onCriar,
  onExcluir,
  notificacoesLigadas,
}) {
  const { t } = useTranslation()
  const [sigla, setSigla] = useState(moedaInicial || 'BTC')
  const [valorAlvo, setValorAlvo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [excluindoId, setExcluindoId] = useState(null)
  const [erroMsg, setErroMsg] = useState('')
  const [sucessoMsg, setSucessoMsg] = useState('')

  // Reabrir o modal com outra moeda selecionada no carrossel deve trazer aquela
  // moeda, não a da última vez.
  useEffect(() => {
    if (visible && moedaInicial) setSigla(moedaInicial)
  }, [visible, moedaInicial])

  useEffect(() => {
    if (!visible) {
      setValorAlvo('')
      setErroMsg('')
      setSucessoMsg('')
    }
  }, [visible])

  // A lista de moedas chega da API depois do primeiro render, e nada garante
  // que ela traga BTC. Enquanto `sigla` apontar para uma opção que não está no
  // menu, o Select do MUI acusa valor fora de faixa e renderiza o campo vazio —
  // com o formulário submetendo uma sigla que o usuário nunca viu selecionada.
  // Cair na primeira moeda disponível mantém campo e valor sempre coerentes.
  const siglaSelecionada = useMemo(() => {
    if (moedas.some((m) => m.simbolo === sigla)) return sigla
    return moedas[0]?.simbolo ?? ''
  }, [moedas, sigla])

  const precoAtual = useMemo(
    () => moedas.find((m) => m.simbolo === siglaSelecionada)?.valor ?? 0,
    [moedas, siglaSelecionada]
  )

  const direcaoPrevista = inferirDirecao(valorAlvo, precoAtual)
  const ativos = contarAtivos(alertas)

  const handleSalvar = async (e) => {
    e.preventDefault()
    setErroMsg('')
    setSucessoMsg('')

    const { valido, erro } = validarAlerta({
      valorAlvo,
      precoAtual,
      alertas,
      siglaMoeda: siglaSelecionada,
    })

    if (!valido) {
      setErroMsg(t(`alertas.erro.${erro}`, { limite: LIMITE_ALERTAS_ATIVOS }))
      return
    }

    setSalvando(true)
    try {
      await onCriar({ siglaMoeda: siglaSelecionada, valorAlvo })
      setValorAlvo('')
      setSucessoMsg(t('alertas.criadoComSucesso'))
    } catch (err) {
      // A API é a autoridade sobre teto, duplicidade e alvo já satisfeito:
      // quando ela explica o motivo, a frase dela vence a genérica daqui.
      setErroMsg(err?.hasBackendMessage ? err.message : t('alertas.erroCriar'))
    } finally {
      setSalvando(false)
    }
  }

  const handleExcluir = async (id) => {
    setErroMsg('')
    setSucessoMsg('')
    setExcluindoId(id)
    try {
      await onExcluir(id)
    } catch (err) {
      setErroMsg(err?.hasBackendMessage ? err.message : t('alertas.erroExcluir'))
    } finally {
      setExcluindoId(null)
    }
  }

  const inputSx = {
    width: '100%',
    '& .MuiOutlinedInput-root': {
      backgroundColor: 'var(--surface-subtle)',
      borderRadius: '10px',
      '&:hover': { backgroundColor: 'var(--surface-fill)' },
    },
    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border-strong)' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--accent-a50)' },
    '& .MuiInputBase-input': { color: 'var(--text-primary)', fontWeight: 600 },
  }

  return (
    <Modal visible={visible} onClose={onClose} className="alerta-preco-modal">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <MdNotificationsActive size={22} style={{ color: 'var(--accent-ink)' }} />
        <Typography
          variant="h6"
          sx={{
            fontWeight: 800,
            color: 'var(--text-primary)',
            fontFamily: "'Share Tech Mono', monospace",
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}
        >
          {t('alertas.titulo')}
        </Typography>
      </Box>

      {/* A latência é do produto, não um detalhe: o dado de preço fecha de hora
          em hora, então prometer "na hora" seria mentira. */}
      <Typography
        variant="body2"
        sx={{ color: 'var(--text-secondary)', display: 'flex', gap: 1, alignItems: 'flex-start', mb: 3 }}
      >
        <MdInfoOutline style={{ flexShrink: 0, marginTop: 3 }} />
        {t('alertas.explicacaoLatencia')}
      </Typography>

      {!notificacoesLigadas && (
        <Box
          sx={{
            border: '1px solid var(--border-strong)',
            borderRadius: '10px',
            p: 1.5,
            mb: 2.5,
            backgroundColor: 'var(--surface-subtle)',
          }}
        >
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
            {t('alertas.notificacoesDesligadas')}
          </Typography>
        </Box>
      )}

      <form onSubmit={handleSalvar}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <Box>
            <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
              {t('alertas.moeda')}
            </Typography>
            <Select
              value={siglaSelecionada}
              onChange={(e) => setSigla(e.target.value)}
              size="small"
              sx={{ ...inputSx, mt: 0.5 }}
              MenuProps={{
                sx: { zIndex: Z_ACIMA_DO_MODAL },
                PaperProps: {
                  sx: {
                    backgroundColor: 'var(--surface-overlay)',
                    backgroundImage: 'none',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: '10px',
                    maxHeight: 320,
                    '& .MuiMenuItem-root': {
                      color: 'var(--text-primary)',
                      fontWeight: 600,
                      '&:hover': { backgroundColor: 'var(--accent-a10)' },
                      '&.Mui-selected': {
                        backgroundColor: 'var(--accent-a20)',
                        color: 'var(--accent-ink)',
                      },
                    },
                  },
                },
              }}
            >
              {moedas.map((m) => (
                <MenuItem key={m.simbolo} value={m.simbolo}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CryptoIcon simbolo={m.simbolo} size={18} />
                    {m.simbolo}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
              {t('alertas.valorAlvo')}
            </Typography>
            <TextField
              type="number"
              size="small"
              value={valorAlvo}
              onChange={(e) => setValorAlvo(e.target.value)}
              placeholder={precoAtual ? String(precoAtual) : ''}
              inputProps={{ step: 'any', min: 0 }}
              sx={{ ...inputSx, mt: 0.5 }}
            />
          </Box>
        </Box>

        <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: 'var(--text-secondary)' }}>
          {precoAtual > 0
            ? t('alertas.precoAtual', { moeda: siglaSelecionada, valor: mathUtils.formatCurrency(precoAtual) })
            : t('alertas.semPrecoAtual', { moeda: siglaSelecionada })}
        </Typography>

        {direcaoPrevista && (
          <Typography
            variant="body2"
            sx={{
              mt: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 0.8,
              color: direcaoPrevista === DirecaoAlerta.ACIMA ? 'var(--positive)' : 'var(--negative)',
              fontWeight: 700,
            }}
          >
            {direcaoPrevista === DirecaoAlerta.ACIMA ? <MdTrendingUp /> : <MdTrendingDown />}
            {t(
              direcaoPrevista === DirecaoAlerta.ACIMA
                ? 'alertas.previsaoAcima'
                : 'alertas.previsaoAbaixo',
              { moeda: siglaSelecionada, valor: mathUtils.formatCurrency(Number(valorAlvo)) }
            )}
          </Typography>
        )}

        {erroMsg && (
          <Typography variant="body2" sx={{ mt: 1.5, color: 'var(--negative)' }}>
            {erroMsg}
          </Typography>
        )}
        {sucessoMsg && (
          <Typography
            variant="body2"
            sx={{ mt: 1.5, color: 'var(--positive)', display: 'flex', alignItems: 'center', gap: 0.8 }}
          >
            <MdCheckCircle /> {sucessoMsg}
          </Typography>
        )}

        <Button
          type="submit"
          variant="contained"
          disabled={salvando}
          fullWidth
          sx={{
            mt: 2.5,
            py: 1.2,
            borderRadius: '12px',
            fontFamily: "'Share Tech Mono', monospace",
            fontWeight: 700,
          }}
        >
          {salvando ? <CircularProgress size={18} /> : t('alertas.criar')}
        </Button>
      </form>

      <Box sx={{ mt: 4 }}>
        <Typography
          variant="subtitle2"
          sx={{
            color: 'var(--text-primary)',
            fontFamily: "'Share Tech Mono', monospace",
            textTransform: 'uppercase',
            mb: 1.5,
          }}
        >
          {t('alertas.meusAlertas', { ativos, limite: LIMITE_ALERTAS_ATIVOS })}
        </Typography>

        {carregando ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={22} />
          </Box>
        ) : alertas.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'var(--text-muted)', fontStyle: 'italic', py: 2 }}>
            {t('alertas.listaVazia')}
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {alertas.map((a) => {
              const disparado = a.status === StatusAlerta.DISPARADO
              return (
                <Box
                  key={a.idAlertaPrecoTB}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1.2,
                    borderRadius: '10px',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--surface-subtle)',
                    opacity: disparado ? 0.65 : 1,
                  }}
                >
                  <CryptoIcon simbolo={a.siglaMoeda} size={24} />

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                      {a.siglaMoeda}{' '}
                      {a.direcao === DirecaoAlerta.ACIMA ? '≥' : '≤'}{' '}
                      {mathUtils.formatCurrency(a.valorAlvo)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                      {disparado
                        ? t('alertas.disparadoEm', {
                            valor: mathUtils.formatCurrency(a.valorDisparo ?? a.valorAlvo),
                            data: a.dataDisparo ? new Date(a.dataDisparo).toLocaleString() : '',
                          })
                        : t('alertas.aguardando')}
                    </Typography>
                  </Box>

                  <Tooltip
                    title={t('alertas.excluir')}
                    slotProps={{ popper: { sx: { zIndex: Z_ACIMA_DO_MODAL } } }}
                  >
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => handleExcluir(a.idAlertaPrecoTB)}
                        disabled={excluindoId === a.idAlertaPrecoTB}
                        aria-label={t('alertas.excluir')}
                      >
                        {excluindoId === a.idAlertaPrecoTB ? (
                          <CircularProgress size={16} />
                        ) : (
                          <MdDelete style={{ color: 'var(--text-muted)' }} />
                        )}
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              )
            })}
          </Box>
        )}
      </Box>
    </Modal>
  )
}
