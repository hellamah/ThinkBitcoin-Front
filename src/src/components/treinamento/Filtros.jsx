import { useState } from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import { MdExpandMore } from 'react-icons/md'
import useTranslation from '../../hooks/useTranslation'
import { corDaMoeda, formatarDia, formatarNumero, textoSobre } from './formato'

const ROXO_VERSAO = '#A78BFA'

// Quantas versões ficam à vista; as mais antigas vão para o menu. Com a lista do
// histórico inteiro são nove versões e contando, e a linha empurrava as abas.
const VERSOES_A_VISTA = 3

function LinhaDeFiltro({ rotulo, dica, children, aviso }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }} role="group" aria-label={rotulo}>
      <Typography variant="caption" title={dica} sx={{ color: 'var(--text-muted)', mr: 0.5, minWidth: { sm: 132 } }}>
        {rotulo}
      </Typography>
      {children}
      {aviso && (
        <Typography variant="caption" role="note" sx={{ color: 'var(--text-muted)', ml: 0.5 }}>
          {aviso}
        </Typography>
      )}
    </Box>
  )
}

// Chip de alternância. `aria-pressed` diz ao leitor de tela o que a cor diz a
// quem enxerga: se o filtro está ligado. `cor` é hex (o texto sai pelo
// contraste) ou um token, com `corTexto` junto.
function ChipDeFiltro({ rotulo, ativo, cor, corTexto, onClick, dica, desativado }) {
  return (
    <Chip
      label={rotulo}
      size="small"
      // Desativado, o MUI só barra o clique por CSS (pointer-events). O onClick
      // continua passado para o chip seguir botão, com o aria-disabled.
      onClick={() => { if (!desativado) onClick() }}
      disabled={desativado}
      title={dica}
      aria-pressed={ativo}
      sx={{
        cursor: 'pointer',
        background: ativo ? cor : 'var(--surface-fill-strong)',
        color: ativo ? (corTexto ?? textoSobre(cor)) : 'var(--text-primary)',
        fontWeight: ativo ? 700 : 500,
        border: `1px solid ${ativo ? cor : 'var(--border-strong)'}`,
        '&:hover': { background: ativo ? cor : 'var(--border-strong)' },
      }}
    />
  )
}

function ChipTodas({ ativo, onClick, desativado }) {
  const { t } = useTranslation()
  return (
    <ChipDeFiltro
      rotulo={t('treinamento.filterAll')}
      ativo={ativo}
      cor="var(--accent)"
      corTexto="var(--text-on-accent)"
      onClick={onClick}
      desativado={desativado}
    />
  )
}

function Selo({ children, ponto }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        ml: 0.75,
        px: 0.6,
        borderRadius: 1,
        border: '1px solid currentColor',
        fontSize: 10,
        fontWeight: 700,
        lineHeight: 1.5,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
        opacity: 0.9,
      }}
    >
      {ponto && <Box component="span" aria-hidden="true" sx={{ width: 6, height: 6, borderRadius: '50%', background: ponto }} />}
      {children}
    </Box>
  )
}

function NomeDaVersao({ v }) {
  const { t } = useTranslation()
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
      {v.versao}
      {v.atual && <Selo>{t('treinamento.versionCurrent')}</Selo>}
      {v.aoVivo && <Selo ponto="var(--perf-up)">{t('treinamento.versionLive')}</Selo>}
    </Box>
  )
}

// Período, episódios e moedas da versão, e o que cada selo quer dizer.
// Sem a contagem (versão que só os episódios carregados conhecem), só o período.
const detalheDaVersao = (v, t, locale) => {
  if (!Number.isFinite(v.inicio)) return ''
  const inicio = formatarDia(v.inicio, locale)
  const fim = formatarDia(v.fim, locale)
  const periodo = inicio === fim ? inicio : `${inicio} – ${fim}`
  return v.episodios != null
    ? t('treinamento.versionDetail', { periodo, episodios: formatarNumero(v.episodios, 0), moedas: v.moedas.length })
    : periodo
}

const dicaDaVersao = (v, t, locale) => [
  detalheDaVersao(v, t, locale),
  v.atual && `${t('treinamento.versionCurrent')}: ${t('treinamento.versionCurrentHint')}`,
  v.aoVivo && `${t('treinamento.versionLive')}: ${t('treinamento.versionLiveHint')}`,
].filter(Boolean).join('\n')

function VersoesAnteriores({ versoes, filtrada, onVersao }) {
  const { t, idioma } = useTranslation()
  const [ancora, setAncora] = useState(null)
  const fechar = () => setAncora(null)
  const aberto = Boolean(ancora)
  return (
    <>
      <Chip
        size="small"
        onClick={(e) => setAncora(e.currentTarget)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label={t('treinamento.olderVersionsLabel')}
        label={(
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
            {t('treinamento.olderVersions', { n: versoes.length })}
            <MdExpandMore size={16} aria-hidden="true" />
          </Box>
        )}
        sx={{
          cursor: 'pointer',
          background: 'transparent',
          color: 'var(--text-secondary)',
          border: '1px dashed var(--border-strong)',
          '&:hover': { background: 'var(--surface-fill-strong)' },
        }}
      />
      <Menu
        anchorEl={ancora}
        open={aberto}
        onClose={fechar}
        slotProps={{
          paper: {
            sx: {
              backgroundColor: 'var(--surface-overlay)',
              border: '1px solid var(--border-strong)',
              borderRadius: '12px',
              backdropFilter: 'blur(16px)',
              boxShadow: '0 12px 40px var(--scrim-strong)',
              mt: 0.5,
              maxHeight: 360,
            },
          },
        }}
      >
        {versoes.map((v) => (
          <MenuItem
            key={v.versao}
            selected={v === filtrada}
            onClick={() => { onVersao(v.versao); fechar() }}
            title={dicaDaVersao(v, t, idioma.intl)}
            sx={{
              color: 'var(--text-primary)',
              display: 'block',
              '&:hover': { backgroundColor: 'var(--accent-a08)' },
              '&.Mui-selected': { backgroundColor: 'var(--accent-a15)' },
            }}
          >
            <Box sx={{ fontWeight: 600, fontSize: 14 }}><NomeDaVersao v={v} /></Box>
            <Typography variant="caption" component="div" sx={{ color: 'var(--text-muted)' }}>
              {detalheDaVersao(v, t, idioma.intl)}
            </Typography>
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}

/**
 * Filtros da tela de treino.
 *
 * @param {string[]} moedas
 * @param {string|null} moedasInativas motivo, quando o filtro de moeda não se
 *   aplica à aba aberta: os chips ficam desligados e o motivo, ao lado deles
 * @param {object[]} versoes da que treinou por último para a mais antiga (versoesDoFiltro)
 */
export default function Filtros({ moedas, moedasSelecionadas, onAlternarMoeda, onLimparMoedas, moedasInativas, versoes, versao, onVersao }) {
  const { t, idioma } = useTranslation()

  // Sem diferenciar maiúsculas, como o filtro da API: um link com "V7" filtra a v7.
  const filtrada = versao ? versoes.find((v) => v.versao.toUpperCase() === versao.toUpperCase()) : undefined
  // Um menu para uma versão só custaria um clique a mais por nada.
  const aVista = versoes.slice(0, versoes.length > VERSOES_A_VISTA + 1 ? VERSOES_A_VISTA : versoes.length)
  // A filtrada fica à vista mesmo sendo antiga: escondida no menu, nada na
  // tela diria que há um filtro de versão ligado.
  if (filtrada && !aVista.includes(filtrada)) aVista.push(filtrada)
  const anteriores = versoes.filter((v) => !aVista.includes(v))
  // Uma versão só não é escolha: "Todas" e ela dariam o mesmo.
  const mostrarVersoes = versoes.length > 1 || Boolean(versao)

  if (moedas.length === 0 && !mostrarVersoes) return null
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
      {moedas.length > 0 && (
        <LinhaDeFiltro rotulo={t('treinamento.filterByCoin')} aviso={moedasInativas}>
          <ChipTodas ativo={moedasSelecionadas.length === 0} onClick={onLimparMoedas} desativado={Boolean(moedasInativas)} />
          {moedas.map((m) => (
            <ChipDeFiltro
              key={m}
              rotulo={m}
              ativo={moedasSelecionadas.includes(m)}
              cor={corDaMoeda(m)}
              onClick={() => onAlternarMoeda(m)}
              desativado={Boolean(moedasInativas)}
            />
          ))}
        </LinhaDeFiltro>
      )}
      {mostrarVersoes && (
        <LinhaDeFiltro rotulo={t('treinamento.modelVersion')} dica={t('treinamento.modelVersionTooltip')}>
          <ChipTodas ativo={!versao} onClick={() => onVersao(null)} />
          {aVista.map((v) => (
            <ChipDeFiltro
              key={v.versao}
              rotulo={<NomeDaVersao v={v} />}
              ativo={v === filtrada}
              cor={ROXO_VERSAO}
              dica={dicaDaVersao(v, t, idioma.intl)}
              onClick={() => onVersao(v === filtrada ? null : v.versao)}
            />
          ))}
          {anteriores.length > 0 && <VersoesAnteriores versoes={anteriores} filtrada={filtrada} onVersao={onVersao} />}
        </LinhaDeFiltro>
      )}
    </Box>
  )
}
