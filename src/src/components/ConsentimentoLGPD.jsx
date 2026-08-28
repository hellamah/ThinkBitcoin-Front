import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import CircularProgress from '@mui/material/CircularProgress'
import FormControlLabel from '@mui/material/FormControlLabel'
import Divider from '@mui/material/Divider'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import { MdGavel, MdLock, MdVerifiedUser } from 'react-icons/md'
import DocumentoLegalConteudo from './DocumentoLegalConteudo'
import ErrorMessage from './ErrorMessage'
import { apiRequest, DocumentoLegalEndpoint } from '../utils/apiClient'
import { MotivoPendencia, OrigemConsentimento, TipoConsentimento } from '../utils/consentimento'
import useTranslation from '../hooks/useTranslation'

/**
 * Modal de re-consentimento.
 *
 * Aparece quando a API informa que existe documento pendente para o usuário
 * logado — porque a redação mudou de forma material (art. 8º, §6º da LGPD),
 * porque o consentimento foi revogado, ou porque nunca houve aceite.
 *
 * O texto vem da API, não do bundle: até esta tela existir, a redação vivia em
 * JSX duplicado entre o modal e as páginas /termos e /privacidade, e publicar
 * uma versão nova era um deploy que não deixava rastro de qual texto a pessoa
 * tinha lido.
 *
 * @param {{ pendencias: Array, onConcluir: (itens: Array) => Promise<void> }} props
 */
export default function ConsentimentoLGPD({ pendencias, onConcluir }) {
  const { t } = useTranslation()
  const [aba, setAba] = useState(0)
  const [documentos, setDocumentos] = useState({})
  const [aceitos, setAceitos] = useState({})
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  const lista = useMemo(() => pendencias ?? [], [pendencias])

  useEffect(() => {
    let ativo = true

    const carregar = async () => {
      setCarregando(true)
      try {
        const respostas = await Promise.all(
          lista.map((p) => apiRequest(DocumentoLegalEndpoint.VERSAO(p.idDocumentoLegal)))
        )
        if (!ativo) return

        const porId = {}
        respostas.forEach((json, indice) => {
          const pendencia = lista[indice]
          if (pendencia) porId[pendencia.idDocumentoLegal] = json?.resultado || null
        })
        setDocumentos(porId)
      } catch (err) {
        console.error('Erro ao carregar documentos pendentes:', err)
        if (ativo) setErro(err?.hasBackendMessage ? err.message : t('consentimento.erroDocumentos'))
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    if (lista.length > 0) carregar()
    return () => {
      ativo = false
    }
  }, [lista, t])

  // Todos os pendentes precisam ser marcados: aceitar um e adiar o outro
  // deixaria a conta em um estado que a API vai recusar de qualquer forma.
  const podeConfirmar = lista.length > 0 && lista.every((p) => aceitos[p.idDocumentoLegal])

  const handleAceitar = async () => {
    setErro('')
    setEnviando(true)
    try {
      await onConcluir(
        lista.map((p) => ({
          tipo: p.tipo,
          idDocumentoLegal: p.idDocumentoLegal,
          concedido: true,
        })),
        OrigemConsentimento.ATUALIZACAO_VERSAO
      )
    } catch (err) {
      setErro(err?.hasBackendMessage ? err.message : t('consentimento.erroAceite'))
    } finally {
      setEnviando(false)
    }
  }

  if (lista.length === 0) return null

  const pendenciaAtiva = lista[Math.min(aba, lista.length - 1)]
  const documentoAtivo = documentos[pendenciaAtiva?.idDocumentoLegal]

  return createPortal(
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // O véu é `--scrim`, não `--surface-overlay`: overlay é a cor da
        // SUPERFÍCIE do modal, e no tema claro vale branco a 94%. Usá-lo aqui
        // pintava a tela inteira de branco quase opaco em vez de escurecer o
        // que está atrás.
        backgroundColor: 'var(--scrim-strong)',
        backdropFilter: 'blur(6px)',
        p: { xs: 1, sm: 2 },
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: 640,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          // Era um gradiente cravado em #0e0e0e/#141414 enquanto todo o texto
          // aqui dentro usa token de tema. No modo claro `--text-primary` é
          // #16181d: título, corpo do documento e rótulos dos checkboxes
          // ficavam preto sobre preto, num modal que bloqueia a navegação e
          // cujo texto a pessoa é obrigada a ler antes de aceitar.
          background: 'var(--surface-overlay)',
          backdropFilter: 'blur(30px)',
          border: '1px solid var(--accent-a20)',
          borderRadius: 3,
          boxShadow: '0 24px 64px var(--scrim-strong), 0 0 40px var(--accent-a08)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            px: 3,
            pt: 3,
            pb: 2,
            borderBottom: '1px solid var(--surface-fill-strong)',
            background: 'linear-gradient(90deg, var(--accent-a05) 0%, transparent 100%)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <MdVerifiedUser size={22} color="var(--accent-ink)" />
            <Typography
              variant="h6"
              sx={{
                color: 'var(--text-primary)',
                fontWeight: 700,
                fontSize: '1.05rem',
                letterSpacing: '-0.3px',
              }}
            >
              {lista.some((p) => p.motivo === MotivoPendencia.VERSAO_NOVA)
                ? t('consentimento.tituloAtualizado')
                : t('consentimento.tituloPadrao')}
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            {t('consentimento.subtitulo')}
          </Typography>
        </Box>

        {/* Tabs — uma por documento pendente */}
        {lista.length > 1 && (
          <Tabs
            value={Math.min(aba, lista.length - 1)}
            onChange={(_, v) => setAba(v)}
            sx={{
              px: 2,
              pt: 1,
              minHeight: 40,
              borderBottom: '1px solid var(--border)',
              '& .MuiTabs-indicator': { backgroundColor: 'var(--accent)', height: 2 },
              '& .MuiTab-root': {
                color: 'var(--text-faint)',
                fontSize: '0.8rem',
                minHeight: 40,
                textTransform: 'none',
                fontWeight: 600,
                '&.Mui-selected': { color: 'var(--accent-ink)' },
              },
            }}
          >
            {lista.map((p) => (
              <Tab
                key={p.idDocumentoLegal}
                icon={p.tipo === TipoConsentimento.PRIVACIDADE ? <MdLock size={14} /> : <MdGavel size={14} />}
                iconPosition="start"
                label={p.titulo}
              />
            ))}
          </Tabs>
        )}

        {/* Conteúdo rolável */}
        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            px: 3,
            py: 2.5,
            '&::-webkit-scrollbar': { width: 5 },
            '&::-webkit-scrollbar-track': { background: 'transparent' },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'var(--accent-a20)',
              borderRadius: 4,
            },
          }}
        >
          {/* "O que mudou" em destaque: pedir o aceite de novo sem dizer o que
              mudou transforma o consentimento informado em formalidade. */}
          {pendenciaAtiva?.motivo === MotivoPendencia.VERSAO_NOVA && pendenciaAtiva?.resumoAlteracoes && (
            <Box
              sx={{
                mb: 2.5,
                p: 1.5,
                borderRadius: 1.5,
                border: '1px solid var(--accent-a30)',
                background: 'var(--accent-a08)',
              }}
            >
              <Typography variant="body2" sx={{ color: 'var(--accent-ink)', fontWeight: 600, mb: 0.5 }}>
                {t('consentimento.oQueMudou', { versao: pendenciaAtiva.versao })}
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                {pendenciaAtiva.resumoAlteracoes}
              </Typography>
              {pendenciaAtiva.versaoAceitaAnteriormente && (
                <Typography variant="caption" sx={{ color: 'var(--text-faint)', display: 'block', mt: 0.5 }}>
                  {t('consentimento.versaoAnterior', { versao: pendenciaAtiva.versaoAceitaAnteriormente })}
                </Typography>
              )}
            </Box>
          )}

          {carregando ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} sx={{ color: 'var(--accent-ink)' }} />
            </Box>
          ) : (
            <DocumentoLegalConteudo conteudo={documentoAtivo?.conteudo} />
          )}
        </Box>

        {/* Footer: checkboxes + botão */}
        <Box
          sx={{
            px: 3,
            pt: 2,
            pb: 3,
            borderTop: '1px solid var(--surface-fill-strong)',
            backgroundColor: 'var(--scrim-soft)',
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 2 }}>
            {lista.map((p, indice) => (
              <FormControlLabel
                key={p.idDocumentoLegal}
                control={
                  <Checkbox
                    checked={!!aceitos[p.idDocumentoLegal]}
                    onChange={(e) =>
                      setAceitos((atual) => ({ ...atual, [p.idDocumentoLegal]: e.target.checked }))
                    }
                    size="small"
                    sx={{
                      color: 'var(--text-faint)',
                      '&.Mui-checked': { color: 'var(--accent-ink)' },
                      p: 0.5,
                    }}
                  />
                }
                label={
                  <Typography variant="body2" sx={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {t('consentimento.liEAceito')}{' '}
                    <span
                      style={{ color: 'var(--accent-ink)', cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => setAba(indice)}
                    >
                      {p.titulo}
                    </span>{' '}
                    <span style={{ color: 'var(--text-faint)' }}>
                      {t('consentimento.versaoCurta', { versao: p.versao })}
                    </span>
                  </Typography>
                }
              />
            ))}
          </Box>

          <ErrorMessage message={erro} onClose={() => setErro('')} />

          <Divider sx={{ borderColor: 'var(--border)', mb: 2, mt: erro ? 2 : 0 }} />

          <Button
            fullWidth
            variant="contained"
            disabled={!podeConfirmar || enviando || carregando}
            onClick={handleAceitar}
            sx={{
              background: podeConfirmar
                ? 'linear-gradient(90deg, var(--accent-deep) 0%, var(--accent) 50%, var(--accent-deep) 100%)'
                : 'var(--surface-fill-strong)',
              backgroundSize: '200% auto',
              color: podeConfirmar ? 'var(--text-on-accent)' : 'var(--text-faint)',
              fontWeight: 700,
              fontSize: '0.9rem',
              py: 1.4,
              borderRadius: 2,
              textTransform: 'none',
              letterSpacing: '0.3px',
              boxShadow: podeConfirmar ? '0 0 20px var(--accent-a30)' : 'none',
              transition: 'all 0.3s ease',
              '&:hover': {
                backgroundPosition: 'right center',
                boxShadow: podeConfirmar ? '0 0 30px var(--accent-a40)' : 'none',
              },
              '&.Mui-disabled': {
                backgroundColor: 'var(--surface-fill)',
                color: 'var(--text-faint)',
              },
            }}
          >
            {enviando
              ? t('consentimento.registrando')
              : podeConfirmar
                ? t('consentimento.aceitarEContinuar')
                : t('consentimento.leiaParaContinuar')}
          </Button>

          <Typography
            variant="caption"
            sx={{
              display: 'block',
              textAlign: 'center',
              color: 'var(--text-faint)',
              mt: 1.5,
              fontSize: '0.7rem',
            }}
          >
            {t('consentimento.rodape')}
          </Typography>
        </Box>
      </Box>
    </Box>,
    document.body
  )
}
