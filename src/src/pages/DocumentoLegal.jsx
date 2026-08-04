import { Box, Paper, Typography } from '@mui/material'
import { MdGavel, MdLock } from 'react-icons/md'
import { PrivacidadeContent, TermosContent } from '../components/ConsentimentoLGPD'

// Páginas de /privacidade e /termos.
//
// O banner de cookies e o overlay de cadastro já linkavam para esses dois
// endereços, mas eles não existiam: com o rewrite do SPA mandando qualquer
// caminho para o index.html e a rota curinga redirecionando para "/", os dois
// links caíam na home. Num produto com consentimento LGPD e cobrança, o texto
// precisa estar de fato acessível no endereço que o usuário clicou.
//
// O conteúdo é o mesmo de ConsentimentoLGPD, importado e não copiado.

const DOCUMENTOS = Object.freeze({
  privacidade: {
    titulo: 'Política de Privacidade',
    subtitulo: 'Tratamento de dados pessoais nos termos da Lei nº 13.709/2018 (LGPD).',
    Icone: MdLock,
    Conteudo: PrivacidadeContent,
  },
  termos: {
    titulo: 'Termos de Uso',
    subtitulo: 'Condições de uso da plataforma ThinkBitcoin.',
    Icone: MdGavel,
    Conteudo: TermosContent,
  },
})

function DocumentoLegal({ documento }) {
  const doc = DOCUMENTOS[documento]
  if (!doc) return null

  const { titulo, subtitulo, Icone, Conteudo } = doc

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
            {titulo}
          </Typography>
        </Box>

        <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.85rem', mb: 3 }}>
          {subtitulo}
        </Typography>

        <Conteudo />
      </Paper>
    </Box>
  )
}

export default DocumentoLegal
