import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Box, Button, Chip, CircularProgress, Divider, Paper, Typography } from '@mui/material'
import { MdGavel, MdHistory, MdLock } from 'react-icons/md'
import DocumentoLegalConteudo from '../components/DocumentoLegalConteudo'
import useDocumentoLegal from '../hooks/useDocumentoLegal'
import { toLocal } from '../utils/dateUtils'
import { tipoDoSlug } from '../utils/consentimento'

// Páginas de /privacidade e /termos.
//
// O texto vem da API, versionado no banco. Antes vivia em JSX aqui e no modal
// de consentimento: duas cópias da mesma redação, sem número de versão e sem
// data — não havia como responder qual texto alguém tinha aceitado, que é
// exatamente o que o art. 8º, §1º da LGPD põe do lado do controlador provar.
//
// A rota aceita ?versao=<id> para abrir uma redação específica. É o que permite
// que o histórico de consentimento em Configurações leve o usuário ao texto que
// ele assinou, e não ao que está no ar hoje.

const CABECALHOS = Object.freeze({
  privacidade: {
    subtitulo: 'Tratamento de dados pessoais nos termos da Lei nº 13.709/2018 (LGPD).',
    Icone: MdLock,
  },
  termos: {
    subtitulo: 'Condições de uso da plataforma ThinkBitcoin.',
    Icone: MdGavel,
  },
})

function DocumentoLegal({ documento }) {
  const cabecalho = CABECALHOS[documento]
  const tipo = tipoDoSlug(documento)

  const [searchParams, setSearchParams] = useSearchParams()
  const idVersaoSolicitada = searchParams.get('versao')

  const { documento: vigente, versoes, carregando, erro, carregarVersoes, obterVersao } =
    useDocumentoLegal(tipo)

  const [exibido, setExibido] = useState(null)
  const [historicoAberto, setHistoricoAberto] = useState(false)

  // Sem versão na URL, exibe a vigente. Com versão, busca aquela redação — que
  // pode estar encerrada e por isso não vem no carregamento normal.
  useEffect(() => {
    let ativo = true

    const resolver = async () => {
      if (!idVersaoSolicitada) {
        setExibido(vigente)
        return
      }
      try {
        const versao = await obterVersao(idVersaoSolicitada)
        if (ativo) setExibido(versao)
      } catch (err) {
        console.error('Erro ao carregar versão do documento:', err)
        if (ativo) setExibido(vigente)
      }
    }

    resolver()
    return () => {
      ativo = false
    }
  }, [idVersaoSolicitada, vigente, obterVersao])

  const abrirHistorico = useCallback(() => {
    setHistoricoAberto((aberto) => {
      if (!aberto) carregarVersoes()
      return !aberto
    })
  }, [carregarVersoes])

  const selecionarVersao = useCallback(
    (versao) => {
      if (versao.vigente) setSearchParams({})
      else setSearchParams({ versao: versao.idDocumentoLegal })
    },
    [setSearchParams]
  )

  if (!cabecalho || !tipo) return null

  const { subtitulo, Icone } = cabecalho
  const lendoVersaoAntiga = exibido && exibido.vigente === false

  return (
    <Box sx={{ maxWidth: 860, mx: 'auto', px: { xs: 2, md: 0 }, py: { xs: 3, md: 5 } }}>
      <Paper
        elevation={0}
        sx={{
          backgroundColor: 'var(--surface-panel-solid)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          p: { xs: 2.5, md: 4 },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
          <Icone style={{ color: 'var(--accent-ink)', fontSize: '1.5rem', flexShrink: 0 }} />
          <Typography component="h1" sx={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {exibido?.titulo || ''}
          </Typography>
        </Box>

        <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.85rem', mb: 2 }}>
          {subtitulo}
        </Typography>

        {/* Versão e vigência ficam visíveis: um documento legal sem data é um
            documento que ninguém consegue citar. */}
        {exibido && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 3 }}>
            <Chip
              size="small"
              label={`Versão ${exibido.versao}`}
              sx={{
                backgroundColor: 'var(--accent-a15)',
                color: 'var(--accent-ink)',
                fontWeight: 700,
                fontSize: '0.72rem',
              }}
            />
            <Typography sx={{ color: 'var(--text-faint)', fontSize: '0.76rem' }}>
              {lendoVersaoAntiga
                ? `Vigente de ${toLocal(exibido.dataVigenciaInicio)} a ${toLocal(exibido.dataVigenciaFim)}`
                : `Em vigor desde ${toLocal(exibido.dataVigenciaInicio)}`}
            </Typography>
            <Button
              size="small"
              startIcon={<MdHistory />}
              onClick={abrirHistorico}
              sx={{
                ml: 'auto',
                color: 'var(--text-muted)',
                textTransform: 'none',
                fontSize: '0.76rem',
                '&:hover': { color: 'var(--accent-ink)' },
              }}
            >
              {historicoAberto ? 'Ocultar histórico' : 'Histórico de alterações'}
            </Button>
          </Box>
        )}

        {lendoVersaoAntiga && (
          <Box
            sx={{
              mb: 3,
              p: 1.5,
              borderRadius: 1.5,
              border: '1px solid var(--border-strong)',
              backgroundColor: 'var(--surface-fill)',
            }}
          >
            <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Você está lendo uma versão encerrada, mantida para consulta.{' '}
              <Box
                component="span"
                onClick={() => setSearchParams({})}
                sx={{ color: 'var(--accent-ink)', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Ver a versão em vigor
              </Box>
              .
            </Typography>
          </Box>
        )}

        {historicoAberto && (
          <Box sx={{ mb: 3 }}>
            <Divider sx={{ borderColor: 'var(--border)', mb: 2 }} />
            {versoes.length === 0 ? (
              <Typography sx={{ color: 'var(--text-faint)', fontSize: '0.8rem' }}>
                Carregando versões...
              </Typography>
            ) : (
              versoes.map((v) => (
                <Box
                  key={v.idDocumentoLegal}
                  onClick={() => selecionarVersao(v)}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.25,
                    p: 1.25,
                    mb: 1,
                    borderRadius: 1.5,
                    cursor: 'pointer',
                    border: '1px solid var(--border)',
                    backgroundColor:
                      exibido?.idDocumentoLegal === v.idDocumentoLegal ? 'var(--accent-a08)' : 'transparent',
                    '&:hover': { borderColor: 'var(--border-interactive)' },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ color: 'var(--text-primary)', fontSize: '0.82rem', fontWeight: 700 }}>
                      Versão {v.versao}
                    </Typography>
                    {v.vigente && (
                      <Chip
                        size="small"
                        label="Em vigor"
                        sx={{
                          height: 18,
                          fontSize: '0.65rem',
                          backgroundColor: 'var(--accent-a15)',
                          color: 'var(--accent-ink)',
                        }}
                      />
                    )}
                    <Typography sx={{ color: 'var(--text-faint)', fontSize: '0.72rem', ml: 'auto' }}>
                      {toLocal(v.dataVigenciaInicio)}
                    </Typography>
                  </Box>
                  <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>
                    {v.resumoAlteracoes || 'Primeira versão publicada.'}
                  </Typography>
                </Box>
              ))
            )}
            <Divider sx={{ borderColor: 'var(--border)', mt: 2 }} />
          </Box>
        )}

        {carregando && !exibido && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={26} sx={{ color: 'var(--accent-ink)' }} />
          </Box>
        )}

        {erro && !exibido && (
          <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Não foi possível carregar este documento agora. Tente novamente em instantes.
          </Typography>
        )}

        <DocumentoLegalConteudo conteudo={exibido?.conteudo} />
      </Paper>
    </Box>
  )
}

export default DocumentoLegal
