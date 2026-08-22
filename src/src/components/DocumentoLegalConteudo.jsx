import { useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { parseDocumentoMarkdown, parseInline } from '../utils/markdownLegal'

/**
 * Renderiza o Markdown de um documento legal como elementos React.
 *
 * O conteúdo vem do banco, e nenhuma parte dele vira HTML: o parser devolve
 * blocos, e aqui cada bloco escolhe seu componente. Marcação escrita dentro do
 * documento aparece como texto, nunca como estrutura da página.
 */

const Inline = ({ texto }) => (
  <>
    {parseInline(texto).map((parte, indice) =>
      parte.negrito ? (
        <strong key={indice} style={{ color: 'var(--text-primary)' }}>
          {parte.texto}
        </strong>
      ) : (
        <span key={indice}>{parte.texto}</span>
      )
    )}
  </>
)

function DocumentoLegalConteudo({ conteudo }) {
  const blocos = useMemo(() => parseDocumentoMarkdown(conteudo), [conteudo])

  if (blocos.length === 0) return null

  return (
    <Box sx={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.75 }}>
      {blocos.map((bloco, indice) => {
        if (bloco.tipo === 'titulo') {
          return (
            <Typography
              key={indice}
              variant="subtitle2"
              component={`h${Math.min(bloco.nivel + 1, 6)}`}
              sx={{ color: 'var(--accent-ink)', mb: 1, mt: indice === 0 ? 0 : 2.5, fontWeight: 700 }}
            >
              <Inline texto={bloco.texto} />
            </Typography>
          )
        }

        if (bloco.tipo === 'lista') {
          return (
            <Box component="ul" key={indice} sx={{ pl: 2, mb: 2 }}>
              {bloco.itens.map((item, i) => (
                <li key={i}>
                  <Typography variant="body2">
                    <Inline texto={item} />
                  </Typography>
                </li>
              ))}
            </Box>
          )
        }

        if (bloco.tipo === 'destaque') {
          return (
            <Box
              key={indice}
              sx={{
                background: 'rgba(255,215,0,0.06)',
                border: '1px solid var(--accent-a30)',
                borderRadius: 1.5,
                p: 1.5,
                mb: 2,
              }}
            >
              {bloco.linhas.map((linha, i) => (
                <Typography
                  key={i}
                  variant="body2"
                  sx={{
                    mt: i === 0 ? 0 : 0.5,
                    // A primeira linha do destaque é o rótulo do aviso.
                    color: i === 0 ? 'var(--accent-ink)' : undefined,
                    fontWeight: i === 0 ? 600 : undefined,
                  }}
                >
                  <Inline texto={linha} />
                </Typography>
              ))}
            </Box>
          )
        }

        return (
          <Typography key={indice} variant="body2" sx={{ mb: 2 }}>
            <Inline texto={bloco.texto} />
          </Typography>
        )
      })}
    </Box>
  )
}

export default DocumentoLegalConteudo
