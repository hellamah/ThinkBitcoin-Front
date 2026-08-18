import { AuthRole, temCargo } from './authentication'

/**
 * Sentido do cruzamento, como a API devolve.
 *
 * O backend serializa strings maiúsculas em vez do inteiro do enum justamente
 * para que a comparação aqui seja legível e sobreviva a um rename lá.
 */
export const DirecaoAlerta = Object.freeze({
  ACIMA: 'ACIMA',
  ABAIXO: 'ABAIXO',
})

export const StatusAlerta = Object.freeze({
  ATIVO: 'ATIVO',
  DISPARADO: 'DISPARADO',
  CANCELADO: 'CANCELADO',
})

/**
 * Teto de alertas ativos por usuário.
 *
 * Espelha `FuncaoInserirAlertaPreco.QuantidadeMaximaAtivos`. Duplicado de
 * propósito: a validação que vale é a do servidor, mas sem o número aqui o
 * usuário só descobriria o limite ao preencher o formulário e tomar erro.
 */
export const LIMITE_ALERTAS_ATIVOS = 30

export const ErroAlerta = Object.freeze({
  VALOR_INVALIDO: 'valorInvalido',
  VALOR_IGUAL: 'valorIgual',
  SEM_PRECO: 'semPreco',
  LIMITE: 'limite',
  DUPLICADO: 'duplicado',
})

/** Alertas de preço são recurso de assinatura paga. */
export const podeUsarAlertas = (user) =>
  temCargo(user, AuthRole.MINERADOR, AuthRole.ADMINISTRADOR, AuthRole.SISTEMA)

export const ehAtivo = (alerta) => alerta?.status === StatusAlerta.ATIVO

export const contarAtivos = (alertas) =>
  Array.isArray(alertas) ? alertas.filter(ehAtivo).length : 0

/**
 * Converte a entrada do formulário em número, tratando "vazio" como ausente.
 *
 * `Number('')` é 0, e 0 é finito: sem esta guarda, um campo em branco vira um
 * alvo de zero e a tela anuncia "avisamos quando cair até $0.00" antes de o
 * usuário digitar qualquer coisa.
 */
const paraNumero = (valor) => {
  if (valor === null || valor === undefined) return NaN
  if (typeof valor === 'string' && valor.trim() === '') return NaN
  return Number(valor)
}

/**
 * Deduz o sentido do alerta a partir do preço vigente.
 *
 * Só previsão: quem decide é o servidor, com o último candle. Serve para a tela
 * dizer "avisamos quando subir até X" antes de enviar, em vez de deixar o
 * usuário adivinhar o que vai acontecer.
 */
export const inferirDirecao = (valorAlvo, precoAtual) => {
  const alvo = paraNumero(valorAlvo)
  const atual = paraNumero(precoAtual)
  if (!Number.isFinite(alvo) || !Number.isFinite(atual) || atual <= 0) return null
  if (alvo === atual) return null
  return alvo > atual ? DirecaoAlerta.ACIMA : DirecaoAlerta.ABAIXO
}

/**
 * Valida o alvo com as mesmas regras do backend, para o erro aparecer enquanto
 * o usuário digita em vez de depois do POST.
 *
 * Devolve `{ valido, erro }`, onde `erro` é uma chave de ErroAlerta — não uma
 * frase: quem traduz é a tela, e este módulo é chamado de contextos sem i18n.
 */
export const validarAlerta = ({ valorAlvo, precoAtual, alertas = [], siglaMoeda } = {}) => {
  const alvo = paraNumero(valorAlvo)

  if (!Number.isFinite(alvo) || alvo <= 0) {
    return { valido: false, erro: ErroAlerta.VALOR_INVALIDO }
  }

  if (contarAtivos(alertas) >= LIMITE_ALERTAS_ATIVOS) {
    return { valido: false, erro: ErroAlerta.LIMITE }
  }

  const jaExiste = alertas.some(
    (a) =>
      ehAtivo(a) &&
      String(a.siglaMoeda).toUpperCase() === String(siglaMoeda).toUpperCase() &&
      Number(a.valorAlvo) === alvo
  )
  if (jaExiste) {
    return { valido: false, erro: ErroAlerta.DUPLICADO }
  }

  const atual = paraNumero(precoAtual)
  if (!Number.isFinite(atual) || atual <= 0) {
    return { valido: false, erro: ErroAlerta.SEM_PRECO }
  }

  // Alvo igual ao preço vigente não tem sentido possível — o servidor recusa
  // pelo mesmo motivo.
  if (alvo === atual) {
    return { valido: false, erro: ErroAlerta.VALOR_IGUAL }
  }

  return { valido: true, erro: null }
}
