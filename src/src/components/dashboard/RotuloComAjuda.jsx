import React from 'react'
import Tooltip from '@mui/material/Tooltip'
import { MdInfoOutline } from 'react-icons/md'

/**
 * Rótulo acompanhado de um ícone que explica a métrica.
 *
 * O ícone existe porque hover puro é invisível: quem não sabe o que é
 * "drawdown" também não sabe que há algo para descobrir passando o mouse. E o
 * `title` nativo do HTML, usado antes em partes do dashboard, não aparece em
 * toque nenhum — em celular a explicação simplesmente não existia.
 *
 * Os textos descrevem o que a métrica é e como lê-la. Nunca o que fazer com
 * ela: o laboratório de sinais mostra que a maioria desses indicadores não se
 * distingue do acaso na amostra disponível, e sugerir ação a partir deles
 * seria contradizer a própria plataforma.
 *
 * @param {object} props
 * @param {React.ReactNode} props.texto - O rótulo em si.
 * @param {string} [props.ajuda] - Explicação; sem ela o ícone não aparece.
 * @param {string} [props.className] - Classe do elemento que envolve tudo.
 */
export default function RotuloComAjuda({ texto, ajuda, className }) {
  if (!ajuda) return <span className={className}>{texto}</span>

  return (
    <Tooltip
      title={ajuda}
      arrow
      // Sem isto o toque exige um segundo de pressão e some rápido demais
      // para um texto de duas linhas.
      enterTouchDelay={0}
      leaveTouchDelay={8000}
      classes={{ tooltip: 'ajuda-balao' }}
    >
      {/* O gatilho é o rótulo INTEIRO, não o ícone. O ícone tem cerca de 10px
          e exigir essa pontaria numa funcionalidade feita para quem está
          começando derrota o propósito: o gesto natural é passar o mouse no
          nome da métrica, não acertar o círculo ao lado dele. */}
      <span
        className={`${className || ''} com-ajuda`.trim()}
        tabIndex={0}
        aria-label={typeof texto === 'string' ? `${texto}: ${ajuda}` : ajuda}
      >
        {texto}
        <span className="ajuda-icone" aria-hidden="true">
          <MdInfoOutline />
        </span>
      </span>
    </Tooltip>
  )
}
