import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { subDays, subMonths } from 'date-fns';
import { FilterResult, FilterInterval } from '../utils/enums';

const DashboardContext = createContext();

export function DashboardProvider({ children }) {
  // Filtros Globais
  const [dataInicio, setDataInicio] = useState(() => subDays(new Date(), 7).toISOString());
  const [dataFim, setDataFim] = useState(() => new Date().toISOString());
  const [resultadoFiltro, setResultadoFiltro] = useState(FilterResult.ALL);
  const [intervalo, setIntervalo] = useState(FilterInterval.D7);
  
  // Paginação e Outros (Global para o Dashboard, caso seja relevante)
  const [pagina, setPagina] = useState(1);
  // Teto de candles por requisição. Eram 100, o que cortava até o preset mais
  // curto: o backend amostra de hora em hora, então 7d são ~168 candles e 1m
  // são ~720. O filtro dizia 12 dias e o gráfico mostrava 4, sem avisar.
  // Mil cobre os três presets com folga; acima disso a tela informa o corte.
  const [quantidade, setQuantidade] = useState(1000);

  // Seleção de Moeda para o Carrossel e Expandir Gráfico
  const [moedaSelecionada, setMoedaSelecionada] = useState(() => {
    if (typeof window === 'undefined') return null
    const params = new URLSearchParams(window.location.search)
    return params.get('moeda') || null
  })

  // Trigger para forçar atualização (Refresh global)
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const forceRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // Lógica para alterar o intervalo pré-definido
  const setFilterInterval = useCallback((opt) => {
    if (opt === FilterInterval.CUSTOM) {
      setIntervalo(opt);
      setPagina(1);
      return;
    }

    const agora = new Date();
    let inicioDate;

    if (opt === FilterInterval.H24) {
      inicioDate = subDays(agora, 1);
    } else if (opt === FilterInterval.D7) {
      inicioDate = subDays(agora, 7);
    } else if (opt === FilterInterval.M1) {
      inicioDate = subMonths(agora, 1);
    } else {
      inicioDate = agora;
    }

    const formattedInicio = inicioDate.toISOString();
    const formattedFim = agora.toISOString();

    setDataInicio(formattedInicio);
    setDataFim(formattedFim);
    setIntervalo(opt);
    setPagina(1);
    setQuantidade(100);
    setResultadoFiltro(FilterResult.ALL);
  }, []);

  const value = useMemo(() => ({
    dataInicio, setDataInicio,
    dataFim, setDataFim,
    resultadoFiltro, setResultadoFiltro,
    intervalo, setIntervalo: setFilterInterval,
    pagina, setPagina,
    quantidade, setQuantidade,
    moedaSelecionada, setMoedaSelecionada,
    refreshTrigger, forceRefresh
  }), [
    dataInicio, dataFim, resultadoFiltro, intervalo,
    pagina, quantidade, moedaSelecionada, refreshTrigger,
    setFilterInterval, forceRefresh
  ]);

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard deve ser usado dentro de um DashboardProvider');
  }
  return context;
}
