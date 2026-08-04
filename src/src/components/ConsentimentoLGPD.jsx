import { useState } from 'react'
import { createPortal } from 'react-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Divider from '@mui/material/Divider'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import { MdGavel, MdLock, MdVerifiedUser } from 'react-icons/md'

const STORAGE_KEY = 'lgpd_consent_v1'

export function hasConsented() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'accepted'
  } catch {
    return false
  }
}

function saveConsent() {
  try {
    localStorage.setItem(STORAGE_KEY, 'accepted')
  } catch {
    // sem acesso ao localStorage — continua mesmo assim
  }
}

// ─── Conteúdo: Política de Privacidade ────────────────────────────────────────
// Exportado porque as rotas /privacidade e /termos renderizam este mesmo texto.
// Duplicar a redação em duas telas é como um documento legal envelhece torto:
// alguém atualiza uma cópia e esquece a outra.
export function PrivacidadeContent() {
  return (
    <Box sx={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.75 }}>
      <Typography variant="subtitle2" sx={{ color: 'var(--accent-ink)', mb: 1, fontWeight: 700 }}>
        1. Controlador dos Dados
      </Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        A <strong style={{ color: 'var(--text-primary)' }}>ThinkBitcoin</strong> é a controladora dos dados pessoais coletados por
        meio desta plataforma, nos termos da Lei nº 13.709/2018 (LGPD).
      </Typography>

      <Typography variant="subtitle2" sx={{ color: 'var(--accent-ink)', mb: 1, fontWeight: 700 }}>
        2. Dados Coletados
      </Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        Coletamos e tratamos as seguintes categorias de dados:
      </Typography>
      <Box component="ul" sx={{ pl: 2, mb: 2 }}>
        {[
          'Dados de identificação (nome, e-mail)',
          'Dados de acesso e autenticação (token JWT — armazenado localmente)',
          'Preferências de uso (tema, idioma, perfil de risco)',
          'Dados de navegação e interação com a plataforma (logs de sessão)',
          'Endereços de carteiras Bitcoin informados voluntariamente',
        ].map((item) => (
          <li key={item}>
            <Typography variant="body2">{item}</Typography>
          </li>
        ))}
      </Box>

      <Typography variant="subtitle2" sx={{ color: 'var(--accent-ink)', mb: 1, fontWeight: 700 }}>
        3. Finalidade do Tratamento
      </Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        Os dados são tratados exclusivamente para: prestação dos serviços de análise de mercado
        Bitcoin, personalização da experiência, segurança da conta, cumprimento de obrigações
        legais e melhoria contínua da plataforma.
      </Typography>

      <Typography variant="subtitle2" sx={{ color: 'var(--accent-ink)', mb: 1, fontWeight: 700 }}>
        4. Base Legal
      </Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        O tratamento é realizado com base no seu <strong style={{ color: 'var(--text-primary)' }}>consentimento</strong> (art. 7º, I
        da LGPD), na execução do contrato de uso da plataforma (art. 7º, V) e no cumprimento de
        obrigações legais (art. 7º, II).
      </Typography>

      <Typography variant="subtitle2" sx={{ color: 'var(--accent-ink)', mb: 1, fontWeight: 700 }}>
        5. Compartilhamento de Dados
      </Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        Seus dados <strong style={{ color: 'var(--text-primary)' }}>não são vendidos</strong> a terceiros. Podemos compartilhá-los
        apenas com parceiros de infraestrutura (hospedagem, autenticação) vinculados por contratos
        de confidencialidade, ou quando exigido por lei.
      </Typography>

      <Typography variant="subtitle2" sx={{ color: 'var(--accent-ink)', mb: 1, fontWeight: 700 }}>
        6. Retenção e Exclusão
      </Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        Os dados são retidos pelo período necessário à prestação do serviço ou conforme exigido
        pela legislação. Você pode solicitar a exclusão a qualquer momento pelo e-mail de suporte.
      </Typography>

      <Typography variant="subtitle2" sx={{ color: 'var(--accent-ink)', mb: 1, fontWeight: 700 }}>
        7. Seus Direitos (art. 18 LGPD)
      </Typography>
      <Box component="ul" sx={{ pl: 2, mb: 2 }}>
        {[
          'Confirmação da existência de tratamento',
          'Acesso aos seus dados',
          'Correção de dados incompletos ou desatualizados',
          'Anonimização, bloqueio ou eliminação de dados desnecessários',
          'Portabilidade dos dados',
          'Revogação do consentimento a qualquer tempo',
        ].map((item) => (
          <li key={item}>
            <Typography variant="body2">{item}</Typography>
          </li>
        ))}
      </Box>

      <Typography variant="subtitle2" sx={{ color: 'var(--accent-ink)', mb: 1, fontWeight: 700 }}>
        8. Contato com o DPO
      </Typography>
      <Typography variant="body2">
        Para exercer seus direitos ou esclarecer dúvidas sobre privacidade, entre em contato com
        nosso Encarregado (DPO) pelo e-mail:{' '}
        <strong style={{ color: 'var(--accent-ink)' }}>privacidade@thinkbitcoin.com.br</strong>
      </Typography>
    </Box>
  )
}

// ─── Conteúdo: Termos de Uso ──────────────────────────────────────────────────
export function TermosContent() {
  return (
    <Box sx={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.75 }}>
      <Typography variant="subtitle2" sx={{ color: 'var(--accent-ink)', mb: 1, fontWeight: 700 }}>
        1. Aceitação dos Termos
      </Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        Ao utilizar a plataforma ThinkBitcoin você concorda integralmente com estes Termos de Uso.
        O uso continuado após alterações implica aceitação das versões atualizadas.
      </Typography>

      <Typography variant="subtitle2" sx={{ color: 'var(--accent-ink)', mb: 1, fontWeight: 700 }}>
        2. Descrição do Serviço
      </Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        A ThinkBitcoin oferece uma plataforma de análise de dados e informações sobre o mercado de
        Bitcoin, incluindo dashboards, heatmaps geopolíticos, análises de on-chain e ferramentas
        educacionais. As informações disponibilizadas têm caráter exclusivamente informativo.
      </Typography>

      <Typography variant="subtitle2" sx={{ color: 'var(--accent-ink)', mb: 1, fontWeight: 700 }}>
        3. Não Constitui Consultoria Financeira
      </Typography>
      <Box
        sx={{
          background: 'rgba(255,215,0,0.06)',
          border: '1px solid var(--accent-a30)',
          borderRadius: 1.5,
          p: 1.5,
          mb: 2,
        }}
      >
        <Typography variant="body2" sx={{ color: 'var(--accent-ink)', fontWeight: 600 }}>
          ⚠ Aviso Importante
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          O conteúdo desta plataforma é meramente informativo e educacional. Nenhuma informação
          aqui disponibilizada constitui conselho de investimento, recomendação de compra ou venda
          de ativos, ou assessoria financeira de qualquer natureza. Investimentos em criptoativos
          envolvem riscos significativos. Consulte um profissional habilitado antes de tomar
          decisões financeiras.
        </Typography>
      </Box>

      <Typography variant="subtitle2" sx={{ color: 'var(--accent-ink)', mb: 1, fontWeight: 700 }}>
        4. Uso Permitido
      </Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        Você se compromete a utilizar a plataforma somente para fins lícitos e pessoais,
        respeitando a legislação brasileira vigente. É vedado: reproduzir, redistribuir ou
        comercializar o conteúdo sem autorização expressa; realizar engenharia reversa; utilizar
        bots ou automações não autorizadas; praticar qualquer ato que prejudique a integridade da
        plataforma ou de outros usuários.
      </Typography>

      <Typography variant="subtitle2" sx={{ color: 'var(--accent-ink)', mb: 1, fontWeight: 700 }}>
        5. Propriedade Intelectual
      </Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        Todo o conteúdo, marca, código-fonte, layout e demais elementos da plataforma são de
        propriedade exclusiva da ThinkBitcoin e protegidos pela Lei nº 9.610/1998 (Lei de Direitos
        Autorais) e pela Lei nº 9.279/1996 (Propriedade Industrial).
      </Typography>

      <Typography variant="subtitle2" sx={{ color: 'var(--accent-ink)', mb: 1, fontWeight: 700 }}>
        6. Limitação de Responsabilidade
      </Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        A ThinkBitcoin não se responsabiliza por perdas financeiras decorrentes do uso das
        informações disponibilizadas, por interrupções no serviço, por falhas de terceiros ou por
        eventos de força maior.
      </Typography>

      <Typography variant="subtitle2" sx={{ color: 'var(--accent-ink)', mb: 1, fontWeight: 700 }}>
        7. Modificações
      </Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        Reservamo-nos o direito de alterar estes Termos a qualquer momento. Mudanças relevantes
        serão comunicadas por e-mail ou por aviso na plataforma.
      </Typography>

      <Typography variant="subtitle2" sx={{ color: 'var(--accent-ink)', mb: 1, fontWeight: 700 }}>
        8. Foro
      </Typography>
      <Typography variant="body2">
        Fica eleito o foro da comarca de São Paulo / SP para dirimir quaisquer controvérsias
        decorrentes destes Termos, com renúncia expressa a qualquer outro, por mais privilegiado
        que seja.
      </Typography>
    </Box>
  )
}

// ─── Modal principal ──────────────────────────────────────────────────────────
export default function ConsentimentoLGPD({ onAccept }) {
  const [aba, setAba] = useState(0)
  const [aceitouPrivacidade, setAceitouPrivacidade] = useState(false)
  const [aceitouTermos, setAceitouTermos] = useState(false)

  const podeConfirmar = aceitouPrivacidade && aceitouTermos

  function handleAceitar() {
    saveConsent()
    onAccept()
  }

  return createPortal(
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--surface-overlay)',
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
          background: 'linear-gradient(145deg, #0e0e0e 0%, #141414 100%)',
          border: '1px solid rgba(255,215,0,0.18)',
          borderRadius: 3,
          boxShadow: '0 24px 64px var(--scrim-strong), 0 0 40px rgba(255,215,0,0.06)',
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
            background: 'linear-gradient(90deg, rgba(255,215,0,0.04) 0%, transparent 100%)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <MdVerifiedUser size={22} color="#FFD700" />
            <Typography
              variant="h6"
              sx={{
                color: 'var(--text-primary)',
                fontWeight: 700,
                fontSize: '1.05rem',
                letterSpacing: '-0.3px',
              }}
            >
              Privacidade & Termos de Uso
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            Antes de continuar, leia e aceite nossa Política de Privacidade (LGPD) e nossos Termos
            de Uso.
          </Typography>
        </Box>

        {/* Tabs */}
        <Tabs
          value={aba}
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
          <Tab icon={<MdLock size={14} />} iconPosition="start" label="Política de Privacidade" />
          <Tab icon={<MdGavel size={14} />} iconPosition="start" label="Termos de Uso" />
        </Tabs>

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
          {aba === 0 ? <PrivacidadeContent /> : <TermosContent />}
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
            <FormControlLabel
              control={
                <Checkbox
                  checked={aceitouPrivacidade}
                  onChange={(e) => setAceitouPrivacidade(e.target.checked)}
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
                  Li e aceito a{' '}
                  <span
                    style={{ color: 'var(--accent-ink)', cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => setAba(0)}
                  >
                    Política de Privacidade (LGPD)
                  </span>
                </Typography>
              }
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={aceitouTermos}
                  onChange={(e) => setAceitouTermos(e.target.checked)}
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
                  Li e aceito os{' '}
                  <span
                    style={{ color: 'var(--accent-ink)', cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => setAba(1)}
                  >
                    Termos de Uso
                  </span>
                </Typography>
              }
            />
          </Box>

          <Divider sx={{ borderColor: 'var(--border)', mb: 2 }} />

          <Button
            fullWidth
            variant="contained"
            disabled={!podeConfirmar}
            onClick={handleAceitar}
            sx={{
              background: podeConfirmar
                ? 'linear-gradient(90deg, #B8860B 0%, #FFD700 50%, #B8860B 100%)'
                : 'rgba(255,255,255,0.07)',
              backgroundSize: '200% auto',
              color: podeConfirmar ? '#000' : 'var(--border-interactive)',
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
            {podeConfirmar ? 'Aceitar e Continuar' : 'Leia e aceite ambos os documentos para continuar'}
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
            Você pode revogar seu consentimento a qualquer momento nas Configurações da conta.
          </Typography>
        </Box>
      </Box>
    </Box>,
    document.body
  )
}
