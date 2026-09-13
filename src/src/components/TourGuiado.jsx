import { Joyride, STATUS } from 'react-joyride'
import useTranslation from '../hooks/useTranslation'
import { readToken } from '../utils/themeTokens'

/**
 * Moldura comum dos tours de primeira visita (dashboard e heatmap).
 *
 * Mora num módulo próprio para ser importada sob demanda. A react-joyride e o
 * floating-ui que ela traz eram o grosso do chunk que Dashboard e Heatmap
 * compartilhavam, e o tour roda uma vez por usuário: com o import estático nas
 * páginas, todo mundo baixava a biblioteca a cada visita para, quase sempre,
 * não usá-la. Não importe este módulo direto: use TourGuiadoSobDemanda.
 *
 * As duas páginas carregavam cópias desta configuração, que já tinham
 * começado a divergir (só uma estilizava a borda do balão). Rótulos, cores e
 * ações dos botões são a moldura do Joyride, não o conteúdo de um tour — o
 * conteúdo são os `passos`, e esses continuam em cada página.
 *
 * Nota: react-joyride v3 — `skipBeacon`, `showProgress`, cores e ações dos
 * botões são configurados via prop `options` (não existem `showSkipButton`,
 * `showProgress` nem `styles.options` de nível superior como na v2), e o
 * handler de eventos é `onEvent` (não `callback`).
 */
export default function TourGuiado({ passos, onEncerrar }) {
  const { t } = useTranslation()

  // Concluir e pular encerram do mesmo jeito: nos dois casos o tour foi visto.
  const aoEvento = ({ status }) => {
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) onEncerrar()
  }

  return (
    <Joyride
      steps={passos}
      run
      continuous
      onEvent={aoEvento}
      // Os seis rótulos saem do dicionário. Três deles ficavam cravados em
      // português, então o balão aparecia traduzido com os botões em português
      // — e o tour é a primeira tela que um usuário novo vê. `{current}` e
      // `{total}` são marcadores do próprio Joyride, de chave simples: o `t` só
      // substitui `{{nome}}` e passa por eles.
      locale={{
        back: t('tour.voltar'),
        close: t('tour.fechar'),
        last: t('tour.fechar'),
        next: t('tour.proximo'),
        nextWithProgress: t('tour.proximoComProgresso'),
        skip: t('tour.pular'),
      }}
      options={{
        // Sem beacon: o tooltip abre direto em cada passo.
        skipBeacon: true,
        buttons: ['back', 'close', 'skip', 'primary'],
        showProgress: true,
        // O ✕ dispensa o tour inteiro (status "skipped" marca como visto);
        // o default 'close' da v3 avançaria para o próximo passo.
        closeButtonAction: 'skip',
        // Clique no overlay e tecla ESC não avançam por acidente.
        overlayClickAction: false,
        dismissKeyAction: false,
        // `primaryColor` sai de readToken, e não como `var(--accent)`: a
        // react-joyride passa este valor por hexToRGB para montar o fundo do
        // beacon, e hex é o único formato que aquele parser entende — com
        // `var()` ele devolve lista vazia e produz um `rgba(, 0.2)` que o
        // navegador descarta. Os demais viram estilo inline direto, onde
        // `var()` resolve sozinho e ainda acompanha a troca de tema sem
        // depender de re-render.
        primaryColor: readToken('--accent'),
        // Também por token: o fundo já vinha de --surface-overlay, mas texto
        // e seta estavam cravados no escuro. No tema claro davam branco sobre
        // branco e uma seta preta apontando para um balão branco.
        textColor: 'var(--text-secondary)',
        backgroundColor: 'var(--surface-overlay)',
        arrowColor: 'var(--surface-overlay)',
        zIndex: 9999,
      }}
      styles={{
        tooltip: {
          border: '1px solid var(--accent-a30)',
          borderRadius: 16,
          boxShadow: '0 20px 60px var(--scrim-strong)',
        },
        tooltipTitle: { color: 'var(--accent-ink)', fontWeight: 800, fontSize: '1rem' },
        tooltipContent: { color: 'var(--text-secondary)', fontSize: '0.88rem' },
        buttonPrimary: { backgroundColor: 'var(--accent)', color: 'var(--text-on-accent)', fontWeight: 700, borderRadius: '8px' },
        buttonBack: { color: 'var(--text-muted)' },
        buttonSkip: { color: 'var(--text-faint)', fontSize: '0.78rem' },
      }}
    />
  )
}
