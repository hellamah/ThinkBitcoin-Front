import { useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Switch from '@mui/material/Switch'
import Typography from '@mui/material/Typography'
import { MdOpenInNew, MdWarningAmber } from 'react-icons/md'
import { useAuth } from '../context/AuthContext'
import useConsentimento from '../hooks/useConsentimento'
import useTranslation from '../hooks/useTranslation'
import {
  DocumentoSlug,
  OrigemConsentimento,
  TipoConsentimento,
  consentimentosAtuais,
  temIntegridadeComprometida,
} from '../utils/consentimento'
import { toLocal } from '../utils/dateUtils'

/**
 * "Meus consentimentos" — o que o usuário autorizou, quando, sob qual versão, e
 * o caminho para desfazer.
 *
 * A Política de Privacidade sempre prometeu revogação a qualquer tempo (art. 18
 * da LGPD). Até esta tela existir, a promessa não tinha onde ser exercida: o
 * aceite morava num booleano de localStorage, sem data, sem versão e sem
 * histórico.
 */

// Chaves de tradução, não frases: o histórico de consentimento é justamente o
// que o titular consulta para entender o que autorizou, e em português para
// quem escolheu outro idioma isso não se lê.
const CHAVE_TIPO = Object.freeze({
  [TipoConsentimento.PRIVACIDADE]: 'consentimento.tipos.privacidade',
  [TipoConsentimento.TERMOS]: 'consentimento.tipos.termos',
  [TipoConsentimento.COOKIES]: 'consentimento.tipos.cookies',
})

const CHAVE_ORIGEM = Object.freeze({
  CADASTRO: 'consentimento.origens.cadastro',
  ATUALIZACAO_VERSAO: 'consentimento.origens.atualizacaoVersao',
  CONFIGURACOES: 'consentimento.origens.configuracoes',
  BANNER_COOKIES: 'consentimento.origens.bannerCookies',
})

// Endereço do encarregado (DPO). Fica numa constante e fora do dicionário: é o
// mesmo em qualquer idioma, e repetido nas cinco traduções seria cinco lugares
// para esquecer de atualizar quando ele mudar.
const EMAIL_ENCARREGADO = 'privacidade@thinkbitcoin.com.br'

const SLUG_POR_TIPO = Object.freeze({
  [TipoConsentimento.PRIVACIDADE]: DocumentoSlug.PRIVACIDADE,
  [TipoConsentimento.TERMOS]: DocumentoSlug.TERMOS,
})

function LinhaDocumento({ tipo, registro, onRevogar, ocupado, t }) {
  const concedido = registro?.concedido === true
  const slug = SLUG_POR_TIPO[tipo]

  const descricao = registro
    ? t(concedido ? 'consentimento.painel.aceitoEm' : 'consentimento.painel.revogadoEm', {
        data: toLocal(registro.dataRegistro),
      }) +
      (registro.versaoDocumento
        ? t('consentimento.painel.sufixoVersao', { versao: registro.versaoDocumento })
        : '')
    : t('consentimento.painel.semRegistro')

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        flexWrap: 'wrap',
        py: 1.5,
        borderBottom: '1px solid var(--border)',
      }}
    >
      <Box sx={{ flex: 1, minWidth: 220 }}>
        <Typography sx={{ color: 'var(--text-primary)', fontSize: '0.88rem', fontWeight: 700 }}>
          {t(CHAVE_TIPO[tipo])}
        </Typography>
        <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>
          {descricao}
        </Typography>
      </Box>

      {registro?.idDocumentoLegal && slug && (
        <Button
          size="small"
          component={RouterLink}
          to={`/${slug}?versao=${registro.idDocumentoLegal}`}
          target="_blank"
          rel="noopener"
          endIcon={<MdOpenInNew size={14} />}
          sx={{ color: 'var(--text-muted)', textTransform: 'none', fontSize: '0.76rem' }}
        >
          {t('consentimento.painel.verTextoAceito')}
        </Button>
      )}

      {concedido ? (
        <Button
          size="small"
          variant="outlined"
          disabled={ocupado}
          onClick={() => onRevogar(tipo)}
          sx={{
            borderColor: 'var(--danger)',
            color: 'var(--danger-ink)',
            textTransform: 'none',
            fontSize: '0.76rem',
            borderRadius: '8px',
            '&:hover': { borderColor: 'var(--danger)', backgroundColor: 'var(--danger-a10)' },
          }}
        >
          {t('consentimento.painel.revogar')}
        </Button>
      ) : (
        <Chip
          size="small"
          label={t('consentimento.painel.pendente')}
          sx={{ backgroundColor: 'var(--surface-fill)', color: 'var(--text-muted)', fontSize: '0.7rem' }}
        />
      )}
    </Box>
  )
}

function MeusConsentimentosPanel() {
  const { token } = useAuth()
  const { t } = useTranslation()
  const { historico, carregando, erro, carregarHistorico, registrar } = useConsentimento(token)
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    carregarHistorico()
  }, [carregarHistorico])

  const atuais = consentimentosAtuais(historico)
  const cookiesAceitos = atuais[TipoConsentimento.COOKIES]?.concedido === true

  const alterarCookies = async (aceitar) => {
    setOcupado(true)
    setAviso('')
    try {
      // registrar() já recarrega o histórico desta instância.
      await registrar({
        origem: OrigemConsentimento.CONFIGURACOES,
        itens: [{ tipo: TipoConsentimento.COOKIES, idDocumentoLegal: null, concedido: aceitar }],
      })
    } catch (err) {
      setAviso(err?.hasBackendMessage ? err.message : t('consentimento.painel.erroAlteracao'))
    } finally {
      setOcupado(false)
    }
  }

  const revogar = async (tipo) => {
    setOcupado(true)
    setAviso('')
    try {
      await registrar({
        origem: OrigemConsentimento.CONFIGURACOES,
        itens: [{ tipo, idDocumentoLegal: null, concedido: false }],
      })
    } catch (err) {
      setAviso(err?.hasBackendMessage ? err.message : t('consentimento.painel.erroRevogacao'))
    } finally {
      setOcupado(false)
    }
  }

  if (carregando && historico.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={22} sx={{ color: 'var(--accent-ink)' }} />
      </Box>
    )
  }

  return (
    <Box>
      <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.82rem', mb: 2 }}>
        {t('consentimento.painel.intro')}
      </Typography>

      {temIntegridadeComprometida(historico) && (
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            alignItems: 'flex-start',
            p: 1.5,
            mb: 2,
            borderRadius: '10px',
            border: '1px solid var(--danger)',
            backgroundColor: 'var(--danger-a10)',
          }}
        >
          <MdWarningAmber style={{ color: 'var(--danger-ink)', flexShrink: 0, marginTop: 2 }} />
          <Typography sx={{ color: 'var(--danger-ink)', fontSize: '0.8rem' }}>
            {t('consentimento.painel.integridade', { email: EMAIL_ENCARREGADO })}
          </Typography>
        </Box>
      )}

      {aviso && (
        <Typography sx={{ color: 'var(--danger-ink)', fontSize: '0.8rem', mb: 2 }}>{aviso}</Typography>
      )}
      {erro && historico.length === 0 && (
        <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.8rem', mb: 2 }}>
          {/* Chave de tradução quando a falha não trouxe mensagem do backend;
              texto do servidor passa direto. */}
          {t(erro)}
        </Typography>
      )}

      <LinhaDocumento
        tipo={TipoConsentimento.PRIVACIDADE}
        registro={atuais[TipoConsentimento.PRIVACIDADE]}
        onRevogar={revogar}
        ocupado={ocupado}
        t={t}
      />
      <LinhaDocumento
        tipo={TipoConsentimento.TERMOS}
        registro={atuais[TipoConsentimento.TERMOS]}
        onRevogar={revogar}
        ocupado={ocupado}
        t={t}
      />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 220 }}>
          <Typography sx={{ color: 'var(--text-primary)', fontSize: '0.88rem', fontWeight: 700 }}>
            {t(CHAVE_TIPO[TipoConsentimento.COOKIES])}
          </Typography>
          <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>
            {atuais[TipoConsentimento.COOKIES]
              ? t('consentimento.painel.ultimaAlteracao', {
                  data: toLocal(atuais[TipoConsentimento.COOKIES].dataRegistro),
                })
              : t('consentimento.painel.semRegistroCookies')}
          </Typography>
        </Box>
        <Switch
          checked={cookiesAceitos}
          disabled={ocupado}
          onChange={(e) => alterarCookies(e.target.checked)}
        />
      </Box>

      <Typography sx={{ color: 'var(--text-faint)', fontSize: '0.75rem', mb: 2 }}>
        {t('consentimento.painel.avisoRevogacao')}
      </Typography>

      {historico.length > 0 && (
        <>
          <Divider sx={{ borderColor: 'var(--border)', my: 2 }} />
          <Typography sx={{ color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 700, mb: 1 }}>
            {t('consentimento.painel.historico')}
          </Typography>
          {historico.map((registro) => (
            <Box
              key={registro.idConsentimentoUsuarioTB}
              sx={{ display: 'flex', gap: 1, alignItems: 'baseline', flexWrap: 'wrap', mb: 0.75 }}
            >
              <Chip
                size="small"
                label={t(
                  registro.concedido
                    ? 'consentimento.painel.aceite'
                    : 'consentimento.painel.revogacao'
                )}
                sx={{
                  height: 18,
                  fontSize: '0.65rem',
                  backgroundColor: registro.concedido ? 'var(--accent-a15)' : 'var(--surface-fill)',
                  color: registro.concedido ? 'var(--accent-ink)' : 'var(--text-muted)',
                }}
              />
              <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                {CHAVE_TIPO[registro.tipo] ? t(CHAVE_TIPO[registro.tipo]) : registro.tipo}
                {registro.versaoDocumento ? ` v${registro.versaoDocumento}` : ''}
              </Typography>
              <Typography sx={{ color: 'var(--text-faint)', fontSize: '0.74rem' }}>
                {toLocal(registro.dataRegistro)}
                {CHAVE_ORIGEM[registro.origem] ? ` · ${t(CHAVE_ORIGEM[registro.origem])}` : ''}
                {registro.enderecoIp ? ` · IP ${registro.enderecoIp}` : ''}
              </Typography>
            </Box>
          ))}
        </>
      )}
    </Box>
  )
}

export default MeusConsentimentosPanel
