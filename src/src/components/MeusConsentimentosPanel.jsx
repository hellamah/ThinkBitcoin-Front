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

const ROTULO_TIPO = Object.freeze({
  [TipoConsentimento.PRIVACIDADE]: 'Política de Privacidade',
  [TipoConsentimento.TERMOS]: 'Termos de Uso',
  [TipoConsentimento.COOKIES]: 'Cookies de preferências',
})

const ROTULO_ORIGEM = Object.freeze({
  CADASTRO: 'no cadastro',
  ATUALIZACAO_VERSAO: 'na atualização do documento',
  CONFIGURACOES: 'nas configurações',
  BANNER_COOKIES: 'no banner de cookies',
})

const SLUG_POR_TIPO = Object.freeze({
  [TipoConsentimento.PRIVACIDADE]: DocumentoSlug.PRIVACIDADE,
  [TipoConsentimento.TERMOS]: DocumentoSlug.TERMOS,
})

function LinhaDocumento({ tipo, registro, onRevogar, ocupado }) {
  const concedido = registro?.concedido === true
  const slug = SLUG_POR_TIPO[tipo]

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
          {ROTULO_TIPO[tipo]}
        </Typography>
        <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>
          {registro
            ? `${concedido ? 'Aceito' : 'Revogado'} em ${toLocal(registro.dataRegistro)}${
                registro.versaoDocumento ? ` — versão ${registro.versaoDocumento}` : ''
              }`
            : 'Sem registro'}
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
          Ver o texto aceito
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
          Revogar
        </Button>
      ) : (
        <Chip
          size="small"
          label="Pendente"
          sx={{ backgroundColor: 'var(--surface-fill)', color: 'var(--text-muted)', fontSize: '0.7rem' }}
        />
      )}
    </Box>
  )
}

function MeusConsentimentosPanel() {
  const { token } = useAuth()
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
      setAviso(err?.hasBackendMessage ? err.message : 'Não foi possível registrar a alteração.')
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
      setAviso(err?.hasBackendMessage ? err.message : 'Não foi possível registrar a revogação.')
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
        Cada aceite fica registrado com data, versão do documento e origem. Revogar não apaga o
        registro anterior — acrescenta a revogação ao histórico.
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
            Um dos documentos registrados foi alterado após o seu aceite. Entre em contato com
            privacidade@thinkbitcoin.com.br.
          </Typography>
        </Box>
      )}

      {aviso && (
        <Typography sx={{ color: 'var(--danger-ink)', fontSize: '0.8rem', mb: 2 }}>{aviso}</Typography>
      )}
      {erro && historico.length === 0 && (
        <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.8rem', mb: 2 }}>
          Não foi possível carregar seus consentimentos agora.
        </Typography>
      )}

      <LinhaDocumento
        tipo={TipoConsentimento.PRIVACIDADE}
        registro={atuais[TipoConsentimento.PRIVACIDADE]}
        onRevogar={revogar}
        ocupado={ocupado}
      />
      <LinhaDocumento
        tipo={TipoConsentimento.TERMOS}
        registro={atuais[TipoConsentimento.TERMOS]}
        onRevogar={revogar}
        ocupado={ocupado}
      />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 220 }}>
          <Typography sx={{ color: 'var(--text-primary)', fontSize: '0.88rem', fontWeight: 700 }}>
            {ROTULO_TIPO[TipoConsentimento.COOKIES]}
          </Typography>
          <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>
            {atuais[TipoConsentimento.COOKIES]
              ? `Última alteração em ${toLocal(atuais[TipoConsentimento.COOKIES].dataRegistro)}`
              : 'Sem registro — apenas cookies essenciais'}
          </Typography>
        </Box>
        <Switch
          checked={cookiesAceitos}
          disabled={ocupado}
          onChange={(e) => alterarCookies(e.target.checked)}
        />
      </Box>

      <Typography sx={{ color: 'var(--text-faint)', fontSize: '0.75rem', mb: 2 }}>
        Revogar a Política de Privacidade ou os Termos de Uso interrompe o uso da plataforma até que
        você aceite a versão vigente novamente.
      </Typography>

      {historico.length > 0 && (
        <>
          <Divider sx={{ borderColor: 'var(--border)', my: 2 }} />
          <Typography sx={{ color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 700, mb: 1 }}>
            Histórico
          </Typography>
          {historico.map((registro) => (
            <Box
              key={registro.idConsentimentoUsuarioTB}
              sx={{ display: 'flex', gap: 1, alignItems: 'baseline', flexWrap: 'wrap', mb: 0.75 }}
            >
              <Chip
                size="small"
                label={registro.concedido ? 'Aceite' : 'Revogação'}
                sx={{
                  height: 18,
                  fontSize: '0.65rem',
                  backgroundColor: registro.concedido ? 'var(--accent-a15)' : 'var(--surface-fill)',
                  color: registro.concedido ? 'var(--accent-ink)' : 'var(--text-muted)',
                }}
              />
              <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                {ROTULO_TIPO[registro.tipo] || registro.tipo}
                {registro.versaoDocumento ? ` v${registro.versaoDocumento}` : ''}
              </Typography>
              <Typography sx={{ color: 'var(--text-faint)', fontSize: '0.74rem' }}>
                {toLocal(registro.dataRegistro)}
                {ROTULO_ORIGEM[registro.origem] ? ` · ${ROTULO_ORIGEM[registro.origem]}` : ''}
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
