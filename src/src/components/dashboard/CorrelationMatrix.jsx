import React from 'react'
import { MdGridOn } from 'react-icons/md'
import { corDaCorrelacao } from '../../utils/correlation'

/**
 * O que a célula diz ao passar o mouse: o par, quantos pontos sustentaram o
 * coeficiente e, quando for o caso, que ele não se distingue de zero.
 *
 * O número de pares importa porque o descarte é par a par: numa moeda que
 * começou a ser coletada depois, ou com buracos na série, a célula repousa
 * sobre menos pontos que as vizinhas — e nada no desenho denunciava isso.
 */
const tituloDaCelula = (a, b, celula, t) => {
  const par = `${a} × ${b}`
  if (!celula || celula.pares === null) return par
  const partes = [par, t('correlationPairs', { count: celula.pares })]
  if (!celula.significante) partes.push(t('correlationWeak'))
  return partes.join(' · ')
}

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
      <p className="correlation-hint">{t('correlationWeakHint')}</p>

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
                {linha.map((celula, j) => (
                  <td
                    key={`${siglas[i]}-${siglas[j]}`}
                    // Só a célula que se distingue de zero recebe cor. Pintar um
                    // coeficiente que a amostra não sustenta é dar destaque a
                    // ruído — mesma regra que o laboratório de sinais aplica ao
                    // não colorir delta de linha não significante.
                    style={{
                      backgroundColor: celula?.significante
                        ? corDaCorrelacao(celula.r)
                        : 'transparent',
                    }}
                    className={[
                      // A diagonal é 1 por definição e não carrega informação;
                      // esmaecer evita que ela domine a leitura do heatmap.
                      i === j ? 'correlation-diagonal' : '',
                      celula && !celula.significante ? 'correlation-fraca' : '',
                    ].filter(Boolean).join(' ') || undefined}
                    title={tituloDaCelula(siglas[i], siglas[j], celula, t)}
                  >
                    {celula === null ? '—' : celula.r.toFixed(2)}
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
