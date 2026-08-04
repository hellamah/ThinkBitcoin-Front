import React from 'react'
import { MdGridOn } from 'react-icons/md'
import { corDaCorrelacao } from '../../utils/correlation'

/**
 * Matriz de correlação entre as moedas selecionadas.
 *
 * @param {object} props
 * @param {object} props.correlacao - Retorno de matrizCorrelacao.
 * @param {Function} props.t - Função de tradução.
 */
export default function CorrelationMatrix({ correlacao, t }) {
  if (!correlacao) return null

  const { siglas, matriz } = correlacao

  return (
    <section className="panel correlation-panel">
      <h2>
        <MdGridOn style={{ verticalAlign: 'middle', marginRight: '10px' }} />
        {t('correlationMatrix')}
      </h2>

      <p className="correlation-hint">{t('correlationHint')}</p>

      <div className="correlation-scroll">
        <table className="correlation-table">
          <thead>
            <tr>
              <th aria-hidden="true" />
              {siglas.map((sigla) => (
                <th key={sigla} scope="col">{sigla}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matriz.map((linha, i) => (
              <tr key={siglas[i]}>
                <th scope="row">{siglas[i]}</th>
                {linha.map((r, j) => (
                  <td
                    key={`${siglas[i]}-${siglas[j]}`}
                    style={{ backgroundColor: corDaCorrelacao(r) }}
                    // A diagonal é 1 por definição e não carrega informação;
                    // esmaecer evita que ela domine a leitura do heatmap.
                    className={i === j ? 'correlation-diagonal' : undefined}
                    title={`${siglas[i]} × ${siglas[j]}`}
                  >
                    {r === null ? '—' : r.toFixed(2)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="correlation-legend">
        <span><i style={{ background: corDaCorrelacao(-1) }} /> {t('correlationInverse')}</span>
        <span><i style={{ background: corDaCorrelacao(0) }} /> {t('correlationNone')}</span>
        <span><i style={{ background: corDaCorrelacao(1) }} /> {t('correlationDirect')}</span>
      </div>
    </section>
  )
}
