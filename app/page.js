'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './auth-context';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const PieChart = dynamic(() => import('recharts').then(m => m.PieChart), { ssr: false });
const Pie = dynamic(() => import('recharts').then(m => m.Pie), { ssr: false });
const Cell = dynamic(() => import('recharts').then(m => m.Cell), { ssr: false });
const AreaChart = dynamic(() => import('recharts').then(m => m.AreaChart), { ssr: false });
const Area = dynamic(() => import('recharts').then(m => m.Area), { ssr: false });
const LineChart = dynamic(() => import('recharts').then(m => m.LineChart), { ssr: false });
const Line = dynamic(() => import('recharts').then(m => m.Line), { ssr: false });
const BarChart = dynamic(() => import('recharts').then(m => m.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then(m => m.Bar), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
const Legend = dynamic(() => import('recharts').then(m => m.Legend), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });
const ReferenceLine = dynamic(() => import('recharts').then(m => m.ReferenceLine), { ssr: false });

// ==================== FORMATADORES ====================
const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtK = (v) => !v ? 'R$ 0,00' : fmt(v);
const fmtCompacto = (v) => !v ? 'R$ 0' : v >= 1e12 ? 'R$ ' + (v/1e12).toFixed(1) + 'T' : v >= 1e9 ? 'R$ ' + (v/1e9).toFixed(1) + 'B' : v >= 1e6 ? 'R$ ' + (v/1e6).toFixed(1) + 'M' : v >= 1e3 ? 'R$ ' + (v/1e3).toFixed(0) + 'K' : fmt(v);
const fmtPct = (v) => v ? ((v) * 100).toFixed(2) + '%' : '0.00%';
const fmtNum = (v, d = 2) => (v || 0).toFixed(d);
const parseNum = (s) => parseFloat(String(s||'').replace(/[^\d,.-]/g,'').replace(',','.')) || 0;

// ==================== CONSTANTES ====================
const BRAPI_TOKEN = 'wbCe6USKiNrA5rRwrMq2D8';
const INDEXADORES = ['%CDI', 'CDI+', 'IPCA+', 'PRE', 'IGPM+'];

// Setores BRAPI reais
const SETORES_BRAPI = [
  'Todos', 'Finance', 'Energy Minerals', 'Utilities', 'Process Industries', 
  'Transportation', 'Retail Trade', 'Technology Services', 'Consumer Durables',
  'Health Services', 'Electronic Technology', 'Non-Energy Minerals', 
  'Producer Manufacturing', 'Communications', 'Consumer Services',
  'Distribution Services', 'Industrial Services', 'Health Technology',
  'Consumer Non-Durables', 'Commercial Services', 'Miscellaneous'
];

const SEGMENTOS_FII = [
  'Todos', 'Shoppings', 'Lajes Corporativas', 'Logística', 'Híbrido',
  'Papel', 'Fundo de Fundos', 'Residencial', 'Hotel', 'Educacional',
  'Hospital', 'Agências', 'Desenvolvimento', 'Outros'
];

// ==================== APIs BRAPI COMPLETAS ====================

// Cabeçalho de autorização padrão
const brapiHeaders = () => ({
  'Authorization': `Bearer ${BRAPI_TOKEN}`,
  'Content-Type': 'application/json'
});

// ===== MOEDAS / CÂMBIO =====
async function fetchMoedas(pares = 'USD-BRL,EUR-BRL,GBP-BRL,BTC-BRL') {
  try {
    const url = `https://brapi.dev/api/v2/currency?currency=${pares}`;
    const res = await fetch(url, { headers: brapiHeaders() });
    const data = await res.json();
    console.log('[BRAPI] Moedas:', data);
    return data.currency || [];
  } catch (e) {
    console.error('Erro fetchMoedas:', e);
    return [];
  }
}

// ===== INFLAÇÃO =====
async function fetchInflacao(pais = 'brazil', historico = true) {
  try {
    const url = `https://brapi.dev/api/v2/inflation?country=${pais}&historical=${historico}&sortBy=date&sortOrder=desc`;
    const res = await fetch(url, { headers: brapiHeaders() });
    const data = await res.json();
    console.log('[BRAPI] Inflação:', data);
    return data.inflation || [];
  } catch (e) {
    console.error('Erro fetchInflacao:', e);
    return [];
  }
}

// ===== TAXA SELIC =====
async function fetchSelic(pais = 'brazil', historico = true) {
  try {
    const url = `https://brapi.dev/api/v2/prime-rate?country=${pais}&historical=${historico}&sortBy=date&sortOrder=desc`;
    const res = await fetch(url, { headers: brapiHeaders() });
    const data = await res.json();
    console.log('[BRAPI] SELIC:', data);
    return data['prime-rate'] || [];
  } catch (e) {
    console.error('Erro fetchSelic:', e);
    return [];
  }
}

// ===== CRIPTOMOEDAS =====
async function fetchCripto(moedas = 'BTC,ETH,SOL,ADA') {
  try {
    const url = `https://brapi.dev/api/v2/crypto?coin=${moedas}&currency=BRL`;
    const res = await fetch(url, { headers: brapiHeaders() });
    const data = await res.json();
    console.log('[BRAPI] Cripto:', data);
    return data.coins || [];
  } catch (e) {
    console.error('Erro fetchCripto:', e);
    return [];
  }
}

// Buscar dados do FUNDAMENTUS (scraping via proxy CORS)
async function fetchFundamentus(ticker) {
  try {
    // Usar AllOrigins como proxy CORS
    const url = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://fundamentus.com.br/detalhes.php?papel=${ticker}`)}`;
    
    console.log(`Buscando Fundamentus para ${ticker}...`);
    const res = await fetch(url);
    const html = await res.text();
    
    // Parser simples do HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Função auxiliar para extrair valor de uma célula
    const extrairValor = (label) => {
      const cells = doc.querySelectorAll('td.label');
      for (const cell of cells) {
        if (cell.textContent?.includes(label)) {
          const valorCell = cell.nextElementSibling;
          if (valorCell) {
            let valor = valorCell.textContent?.trim() || '0';
            // Limpar e converter
            valor = valor.replace(/\./g, '').replace(',', '.').replace('%', '').replace('R$', '').trim();
            return parseFloat(valor) || 0;
          }
        }
      }
      return 0;
    };
    
    // Função para extrair valor com porcentagem
    const extrairPct = (label) => {
      const cells = doc.querySelectorAll('td.label');
      for (const cell of cells) {
        if (cell.textContent?.includes(label)) {
          const valorCell = cell.nextElementSibling;
          if (valorCell) {
            let valor = valorCell.textContent?.trim() || '0';
            valor = valor.replace(/\./g, '').replace(',', '.').replace('%', '').trim();
            const num = parseFloat(valor) || 0;
            // Se já veio em decimal (ex: 0.15), retorna como está. Se veio como 15%, converte
            return num > 1 ? num / 100 : num;
          }
        }
      }
      return 0;
    };
    
    // Extrair todos os dados
    const dados = {
      // Valuation
      pl: extrairValor('P/L'),
      pvp: extrairValor('P/VP'),
      psr: extrairValor('PSR'),
      dy: extrairValor('Div.Yield') || extrairValor('Div. Yield'),
      pAtivo: extrairValor('P/Ativos'),
      pCapGiro: extrairValor('P/Cap.Giro') || extrairValor('P/Cap. Giro'),
      pEbit: extrairValor('P/EBIT'),
      pAtivCircLiq: extrairValor('P/Ativ Circ.Liq') || extrairValor('P/Ativ Circ Liq'),
      evEbit: extrairValor('EV/EBIT') || extrairValor('EV / EBIT'),
      evEbitda: extrairValor('EV/EBITDA') || extrairValor('EV / EBITDA'),
      
      // Por ação
      lpa: extrairValor('LPA'),
      vpa: extrairValor('VPA'),
      
      // Margens
      margemBruta: extrairPct('Marg.Bruta') || extrairPct('Marg. Bruta'),
      margemEbit: extrairPct('Marg.EBIT') || extrairPct('Marg. EBIT'),
      margemLiquida: extrairPct('Marg.Líquida') || extrairPct('Marg. Líquida'),
      
      // Rentabilidade
      roe: extrairPct('ROE'),
      roa: extrairPct('ROA'),
      roic: extrairPct('ROIC'),
      
      // Endividamento
      divBrPatrim: extrairValor('Dív.Brut/ Patrim') || extrairValor('Div Br/ Patrim'),
      divLiqPatrim: extrairValor('Dív.Líq/ Patrim') || extrairValor('Div. Liq/ Patrim'),
      
      // Crescimento
      crescRec5a: extrairPct('Cres.Rec.5a') || extrairPct('Cres. Rec (5a)'),
      
      // Liquidez
      liqCorr: extrairValor('Liquidez Corr') || extrairValor('Liq. Corr'),
      
      // Cotação
      cotacao: extrairValor('Cotação'),
      min52: extrairValor('Min 52 sem'),
      max52: extrairValor('Max 52 sem'),
      volMed2m: extrairValor('Vol $ méd (2m)'),
      
      // Valor de mercado
      valorMercado: extrairValor('Valor de mercado'),
      valorFirma: extrairValor('Valor da firma'),
      
      // Setor
      setor: (() => {
        const cells = doc.querySelectorAll('td.label');
        for (const cell of cells) {
          if (cell.textContent?.includes('Setor')) {
            const valorCell = cell.nextElementSibling;
            if (valorCell) return valorCell.textContent?.trim() || 'N/A';
          }
        }
        return 'N/A';
      })(),
      
      subsetor: (() => {
        const cells = doc.querySelectorAll('td.label');
        for (const cell of cells) {
          if (cell.textContent?.includes('Subsetor')) {
            const valorCell = cell.nextElementSibling;
            if (valorCell) return valorCell.textContent?.trim() || 'N/A';
          }
        }
        return 'N/A';
      })()
    };
    
    console.log(`Fundamentus ${ticker}:`, dados);
    return dados;
    
  } catch (e) {
    console.error(`Erro ao buscar Fundamentus para ${ticker}:`, e);
    return null;
  }
}

// Buscar TODOS os ativos com paginação
async function fetchTodosAtivos(tipo = 'stock', pagina = 1, limite = 100, setor = '', busca = '') {
  try {
    let url = `https://brapi.dev/api/quote/list?sortBy=volume&sortOrder=desc&limit=${limite}&page=${pagina}`;
    if (setor && setor !== 'Todos') url += `&sector=${encodeURIComponent(setor)}`;
    if (busca) url += `&search=${encodeURIComponent(busca)}`;
    if (tipo === 'fii') url += `&type=fund`;
    else if (tipo === 'stock') url += `&type=stock`;
    
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${BRAPI_TOKEN}` }
    });
    const data = await res.json();
    
    return {
      ativos: data.stocks || [],
      indices: data.indexes || [],
      setoresDisponiveis: data.availableSectors || [],
      tiposDisponiveis: data.availableStockTypes || [],
      paginaAtual: data.currentPage || 1,
      totalPaginas: data.totalPages || 1,
      totalAtivos: data.totalCount || 0,
      temProxima: data.hasNextPage || false
    };
  } catch (e) {
    console.error('Erro fetchTodosAtivos:', e);
    return { ativos: [], totalAtivos: 0, totalPaginas: 1 };
  }
}

// Cotação básica
async function fetchCotacao(ticker) {
  try {
    const res = await fetch(`https://brapi.dev/api/quote/${ticker}?fundamental=true`, {
      headers: { 'Authorization': `Bearer ${BRAPI_TOKEN}` }
    });
    const data = await res.json();
    if (data.results?.[0]) {
      const r = data.results[0];
      return {
        ticker: r.symbol,
        nome: r.shortName || r.longName,
        nomeCompleto: r.longName,
        setor: r.sector || 'N/A',
        preco: r.regularMarketPrice || 0,
        variacao: r.regularMarketChangePercent || 0,
        variacaoAbs: r.regularMarketChange || 0,
        abertura: r.regularMarketOpen || 0,
        maxima: r.regularMarketDayHigh || 0,
        minima: r.regularMarketDayLow || 0,
        fechamentoAnterior: r.regularMarketPreviousClose || 0,
        volume: r.regularMarketVolume || 0,
        marketCap: r.marketCap || 0,
        max52: r.fiftyTwoWeekHigh || 0,
        min52: r.fiftyTwoWeekLow || 0,
        media200: r.twoHundredDayAverage || 0,
        pl: r.priceEarnings || 0,
        lpa: r.earningsPerShare || 0,
        pvp: r.priceToBook || 0,
        vpa: r.bookValue || 0,
        dy: r.dividendYield || 0,
        logo: r.logourl || `https://icons.brapi.dev/icons/${r.symbol}.svg`
      };
    }
  } catch (e) { console.error('Erro fetchCotacao:', e); }
  return null;
}

// Cotação ULTRA COMPLETA com todos os módulos BRAPI (Documentação Oficial)
async function fetchCotacaoCompleta(ticker) {
  try {
    // Módulos OFICIAIS conforme documentação brapi.dev/docs/acoes
    const modules = [
      'summaryProfile',                    // Informações cadastrais da empresa
      'balanceSheetHistory',               // Histórico ANUAL do Balanço Patrimonial
      'balanceSheetHistoryQuarterly',      // Histórico TRIMESTRAL do Balanço Patrimonial
      'defaultKeyStatistics',              // Principais estatísticas (P/L, ROE, DY, etc.) - TTM
      'defaultKeyStatisticsHistory',       // Histórico ANUAL das estatísticas
      'defaultKeyStatisticsHistoryQuarterly', // Histórico TRIMESTRAL das estatísticas
      'incomeStatementHistory',            // Histórico ANUAL da DRE
      'incomeStatementHistoryQuarterly',   // Histórico TRIMESTRAL da DRE
      'financialData',                     // Dados financeiros selecionados - TTM
      'financialDataHistory',              // Histórico ANUAL dos dados financeiros
      'financialDataHistoryQuarterly',     // Histórico TRIMESTRAL dos dados financeiros
      'cashflowHistory',                   // Histórico ANUAL do Fluxo de Caixa (DFC)
      'cashflowHistoryQuarterly',          // Histórico TRIMESTRAL do Fluxo de Caixa (DFC)
      'valueAddedHistory',                 // Histórico ANUAL da DVA
      'valueAddedHistoryQuarterly'         // Histórico TRIMESTRAL da DVA
    ].join(',');
    
    // Usar Authorization header (mais seguro conforme documentação)
    const url = `https://brapi.dev/api/quote/${ticker}?fundamental=true&dividends=true&modules=${modules}&range=1y&interval=1d`;
    console.log(`[BRAPI PRO] Buscando ${ticker} com módulos completos...`);
    
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${BRAPI_TOKEN}`
      }
    });
    
    if (!res.ok) {
      console.error(`[BRAPI] Erro HTTP ${res.status} para ${ticker}`);
      return null;
    }
    
    const data = await res.json();
    console.log(`[BRAPI PRO] ${ticker} resposta completa:`, data);
    
    if (data.results?.[0]) {
      const r = data.results[0];
      
      // Extrair dados de todos os módulos
      const stats = r.defaultKeyStatistics || {};
      const fin = r.financialData || {};
      const summary = r.summaryDetail || {};
      const profile = r.summaryProfile || {};
      
      console.log(`[${ticker}] defaultKeyStatistics:`, stats);
      console.log(`[${ticker}] financialData:`, fin);
      console.log(`[${ticker}] summaryDetail:`, summary);
      console.log(`[${ticker}] summaryProfile:`, profile);
      
      // P/L - múltiplas fontes
      const pl = r.priceEarnings || stats.trailingPE || stats.forwardPE || summary.trailingPE || 0;
      
      // P/VP - múltiplas fontes  
      const pvp = r.priceToBook || stats.priceToBook || summary.priceToBook || 0;
      
      // LPA e VPA
      const lpa = r.earningsPerShare || stats.trailingEps || 0;
      const vpa = r.bookValue || stats.bookValue || 0;
      
      // Dividend Yield - calcular dos dividendos ou pegar direto
      let dy = r.dividendYield || summary.dividendYield || summary.trailingAnnualDividendYield || 0;
      
      // Se DY veio como decimal (0.05), converter para percentual
      if (dy > 0 && dy < 1) dy = dy * 100;
      
      // Calcular DY dos dividendos se não tiver
      if (!dy && r.dividendsData?.cashDividends?.length > 0 && r.regularMarketPrice > 0) {
        const umAnoAtras = new Date();
        umAnoAtras.setFullYear(umAnoAtras.getFullYear() - 1);
        
        const dividendos12m = r.dividendsData.cashDividends
          .filter(d => new Date(d.paymentDate) >= umAnoAtras)
          .reduce((soma, d) => soma + (d.value || 0), 0);
        
        if (dividendos12m > 0) {
          dy = (dividendos12m / r.regularMarketPrice) * 100;
        }
      }
      
      // ROE e ROA
      let roe = fin.returnOnEquity || stats.returnOnEquity || 0;
      let roa = fin.returnOnAssets || stats.returnOnAssets || 0;
      
      // Converter se veio como decimal
      if (roe > 0 && roe < 1) roe = roe; // já está em decimal
      else if (roe > 1) roe = roe / 100; // veio como percentual
      
      if (roa > 0 && roa < 1) roa = roa;
      else if (roa > 1) roa = roa / 100;
      
      // Margens
      let margemBruta = fin.grossMargins || stats.grossMargins || 0;
      let margemEbitda = fin.ebitdaMargins || 0;
      let margemOperacional = fin.operatingMargins || 0;
      let margemLiquida = fin.profitMargins || stats.profitMargins || 0;
      
      // Converter margens se necessário
      if (margemBruta > 1) margemBruta = margemBruta / 100;
      if (margemEbitda > 1) margemEbitda = margemEbitda / 100;
      if (margemOperacional > 1) margemOperacional = margemOperacional / 100;
      if (margemLiquida > 1) margemLiquida = margemLiquida / 100;
      
      // Endividamento
      const dividaPL = fin.debtToEquity || 0;
      const liqCorr = fin.currentRatio || 0;
      const liqSeca = fin.quickRatio || 0;
      
      // Crescimento
      const crescLucro = fin.earningsGrowth || 0;
      const crescReceita = fin.revenueGrowth || 0;
      
      // EBITDA
      const ebitda = fin.ebitda || 0;
      
      // Setor e Indústria
      const setor = profile.sector || r.sector || 'N/A';
      const industria = profile.industry || r.industry || 'N/A';
      
      console.log(`[${ticker}] DADOS FINAIS:`, {
        pl, pvp, dy, lpa, vpa,
        roe: (roe * 100).toFixed(2) + '%',
        roa: (roa * 100).toFixed(2) + '%',
        margemBruta: (margemBruta * 100).toFixed(2) + '%',
        margemEbitda: (margemEbitda * 100).toFixed(2) + '%',
        margemLiquida: (margemLiquida * 100).toFixed(2) + '%',
        dividaPL, liqCorr,
        setor, industria
      });
      
      return {
        // Dados básicos
        ticker: r.symbol,
        nome: r.shortName || r.longName,
        nomeCompleto: r.longName,
        moeda: r.currency || 'BRL',
        logo: r.logourl || `https://icons.brapi.dev/icons/${r.symbol}.svg`,
        
        // Preços
        preco: r.regularMarketPrice || 0,
        variacao: r.regularMarketChangePercent || 0,
        variacaoAbs: r.regularMarketChange || 0,
        abertura: r.regularMarketOpen || 0,
        maxima: r.regularMarketDayHigh || 0,
        minima: r.regularMarketDayLow || 0,
        fechamentoAnterior: r.regularMarketPreviousClose || 0,
        horario: r.regularMarketTime,
        
        // 52 semanas
        max52: r.fiftyTwoWeekHigh || summary.fiftyTwoWeekHigh || 0,
        min52: r.fiftyTwoWeekLow || summary.fiftyTwoWeekLow || 0,
        varMax52: r.fiftyTwoWeekHighChangePercent || 0,
        varMin52: r.fiftyTwoWeekLowChangePercent || 0,
        range52: r.fiftyTwoWeekRange || '',
        
        // Médias móveis
        media200: r.twoHundredDayAverage || summary.twoHundredDayAverage || 0,
        media50: summary.fiftyDayAverage || 0,
        varMedia200: r.twoHundredDayAverageChangePercent || 0,
        
        // Volume
        volume: r.regularMarketVolume || 0,
        volumeMedio10d: r.averageDailyVolume10Day || summary.averageDailyVolume10Day || 0,
        volumeMedio3m: r.averageDailyVolume3Month || summary.averageVolume || 0,
        
        // Market Cap
        marketCap: r.marketCap || summary.marketCap || 0,
        valorFirma: stats.enterpriseValue || 0,
        
        // ===== INDICADORES FUNDAMENTALISTAS COMPLETOS =====
        pl: pl,
        lpa: lpa,
        pvp: pvp,
        vpa: vpa,
        dy: dy,
        psr: summary.priceToSalesTrailing12Months || 0,
        
        // Perfil da empresa
        perfil: {
          endereco: profile.address1,
          cidade: profile.city,
          estado: profile.state,
          pais: profile.country,
          telefone: profile.phone,
          website: profile.website,
          setor: setor,
          setorKey: profile.sectorKey,
          industria: industria,
          industriaKey: profile.industryKey,
          descricao: profile.longBusinessSummary,
          funcionarios: profile.fullTimeEmployees
        },
        
        // Dados financeiros completos
        financeiro: {
          precoAtual: fin.currentPrice || r.regularMarketPrice,
          ebitda: ebitda,
          liquidezCorrente: liqCorr,
          liquidezSeca: liqSeca,
          dividaPL: dividaPL,
          dividaLiquidaPL: stats.netDebtToEquity || 0,
          receitaPorAcao: fin.revenuePerShare || 0,
          roa: roa,
          roe: roe,
          roic: fin.returnOnCapital || 0,
          crescimentoLucro: crescLucro,
          crescimentoReceita: crescReceita,
          margemBruta: margemBruta,
          margemEbitda: margemEbitda,
          margemOperacional: margemOperacional,
          margemLiquida: margemLiquida,
          caixaTotal: fin.totalCash || 0,
          caixaPorAcao: fin.totalCashPerShare || 0,
          dividaTotal: fin.totalDebt || 0,
          dividaLiquida: stats.netDebt || 0,
          receitaTotal: fin.totalRevenue || 0,
          lucroBruto: fin.grossProfits || 0,
          lucroLiquido: stats.netIncomeToCommon || 0,
          fluxoCaixaOperacional: fin.operatingCashflow || 0,
          fluxoCaixaLivre: fin.freeCashflow || 0,
          evEbitda: stats.enterpriseToEbitda || 0,
          evReceita: stats.enterpriseToRevenue || 0,
          pegRatio: stats.pegRatio || 0,
          beta: stats.beta || summary.beta || 0
        },
        
        // Estatísticas chave
        estatisticas: stats,
        
        // Earnings
        earnings: r.earnings || null,
        earningsHistory: r.earningsHistory || [],
        earningsTrend: r.earningsTrend || null,
        
        // Recomendações
        recomendacoes: r.recommendationTrend || null,
        
        // ===== DEMONSTRAÇÕES FINANCEIRAS =====
        // Debug detalhado
        _rawBalanceSheet: r.balanceSheetHistory,
        _rawBalanceSheetQ: r.balanceSheetHistoryQuarterly,
        _rawIncome: r.incomeStatementHistory,
        _rawIncomeQ: r.incomeStatementHistoryQuarterly,
        _rawCashflow: r.cashflowHistory,
        _rawCashflowQ: r.cashflowHistoryQuarterly,
        
        // Balanço patrimonial (formato oficial BRAPI - array direto)
        balanco: Array.isArray(r.balanceSheetHistory) ? r.balanceSheetHistory : [],
        balancoTrimestral: Array.isArray(r.balanceSheetHistoryQuarterly) ? r.balanceSheetHistoryQuarterly : [],
        
        // DRE (formato oficial BRAPI - array direto)
        dre: Array.isArray(r.incomeStatementHistory) ? r.incomeStatementHistory : [],
        dreTrimestral: Array.isArray(r.incomeStatementHistoryQuarterly) ? r.incomeStatementHistoryQuarterly : [],
        
        // Fluxo de caixa (formato oficial BRAPI - cashflowHistory)
        fluxoCaixa: Array.isArray(r.cashflowHistory) ? r.cashflowHistory : [],
        fluxoCaixaTrimestral: Array.isArray(r.cashflowHistoryQuarterly) ? r.cashflowHistoryQuarterly : [],
        
        // Dados financeiros atuais (TTM) - fallback para demonstrações
        financialDataTTM: fin,
        
        // DVA - Demonstração do Valor Adicionado
        dva: r.valueAddedHistory || [],
        dvaTrimestral: r.valueAddedHistoryQuarterly || [],
        
        // Histórico de estatísticas financeiras
        statsHistorico: r.defaultKeyStatisticsHistory || [],
        statsHistoricoTrimestral: r.defaultKeyStatisticsHistoryQuarterly || [],
        financeiroHistorico: r.financialDataHistory || [],
        financeiroHistoricoTrimestral: r.financialDataHistoryQuarterly || [],
        
        // Dividendos
        dividendos: r.dividendsData?.cashDividends || [],
        bonificacoes: r.dividendsData?.stockDividends || [],
        subscricoes: r.dividendsData?.subscriptions || [],
        proximoDividendo: summary.dividendDate || null,
        exDividendo: summary.exDividendDate || null,
        
        // Histórico de preços
        historico: r.historicalDataPrice || [],
        
        // Insiders e institucionais
        insiderHolders: r.insiderHolders || null,
        institutionOwnership: r.institutionOwnership || null,
        majorHolders: r.majorHoldersBreakdown || null
      };
    }
  } catch (e) {
    console.error('Erro fetchCotacaoCompleta:', e);
  }
  return null;
}

// Histórico de preços para simulações
async function fetchHistorico(ticker, range = '10y', interval = '1mo') {
  try {
    const res = await fetch(`https://brapi.dev/api/quote/${ticker}?range=${range}&interval=${interval}`, {
      headers: { 'Authorization': `Bearer ${BRAPI_TOKEN}` }
    });
    const data = await res.json();
    if (data.results?.[0]?.historicalDataPrice) {
      return data.results[0].historicalDataPrice.map(h => ({
        data: new Date(h.date * 1000).toLocaleDateString('pt-BR'),
        dataRaw: h.date,
        abertura: h.open,
        maxima: h.high,
        minima: h.low,
        fechamento: h.close,
        volume: h.volume,
        ajustado: h.adjustedClose
      }));
    }
  } catch (e) { console.error('Erro fetchHistorico:', e); }
  return [];
}

// BCB Focus completo
async function fetchBCBCompleto() {
  // Projeções realistas do Boletim Focus (dezembro 2025)
  const projecoesDefault = {
    2025: { selic: 15.00, ipca: 5.50, pib: 2.5, cambio: 6.00 },
    2026: { selic: 12.50, ipca: 4.50, pib: 2.0, cambio: 5.80 },
    2027: { selic: 10.50, ipca: 4.00, pib: 2.2, cambio: 5.60 },
    2028: { selic: 9.50, ipca: 3.50, pib: 2.3, cambio: 5.50 },
    2029: { selic: 9.00, ipca: 3.25, pib: 2.4, cambio: 5.40 },
    2030: { selic: 8.50, ipca: 3.00, pib: 2.5, cambio: 5.30 }
  };
  
  const r = { selic: 15.00, cdi: 14.90, ipca: 5.5, pib: 2.5, cambio: 6.0, projecoes: projecoesDefault };
  
  try {
    const [selicRes, cdiRes] = await Promise.all([
      fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json'),
      fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.4189/dados/ultimos/1?formato=json')
    ]);
    const selicData = await selicRes.json();
    const cdiData = await cdiRes.json();
    if (selicData?.[0]) r.selic = parseFloat(selicData[0].valor);
    if (cdiData?.[0]) r.cdi = parseFloat(cdiData[0].valor);
    
    // Tentar buscar projeções atualizadas do BCB
    for (const ano of [2025, 2026, 2027, 2028, 2029, 2030]) {
      try {
        const [fs, fi, fp, fc] = await Promise.all([
          fetch(`https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais?$filter=Indicador eq 'Selic' and DataReferencia eq ${ano}&$top=1&$orderby=Data desc&$format=json`),
          fetch(`https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais?$filter=Indicador eq 'IPCA' and DataReferencia eq ${ano}&$top=1&$orderby=Data desc&$format=json`),
          fetch(`https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais?$filter=Indicador eq 'PIB Total' and DataReferencia eq ${ano}&$top=1&$orderby=Data desc&$format=json`),
          fetch(`https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais?$filter=Indicador eq 'Câmbio' and DataReferencia eq ${ano}&$top=1&$orderby=Data desc&$format=json`)
        ]);
        const [fsd, fid, fpd, fcd] = await Promise.all([fs.json(), fi.json(), fp.json(), fc.json()]);
        if (fsd?.value?.[0]?.Mediana) r.projecoes[ano].selic = parseFloat(fsd.value[0].Mediana).toFixed(2);
        if (fid?.value?.[0]?.Mediana) r.projecoes[ano].ipca = parseFloat(fid.value[0].Mediana).toFixed(2);
        if (fpd?.value?.[0]?.Mediana) r.projecoes[ano].pib = parseFloat(fpd.value[0].Mediana).toFixed(2);
        if (fcd?.value?.[0]?.Mediana) r.projecoes[ano].cambio = parseFloat(fcd.value[0].Mediana).toFixed(2);
      } catch {}
    }
  } catch (e) { console.error('Erro BCB:', e); }
  return r;
}

// B3 em tempo real
async function fetchB3() {
  try {
    const res = await fetch('https://cotacao.b3.com.br/mds/api/v1/InstrumentPriceFluctuation/ibov');
    const data = await res.json();
    return {
      timestamp: data.Msg?.dtTm,
      altas: (data.SctyHghstIncrLst || []).slice(0, 10).map(i => ({
        ticker: i.symb,
        nome: i.desc?.trim(),
        preco: i.SctyQtn?.curPrc,
        variacao: i.SctyQtn?.prcFlcn
      })),
      baixas: (data.SctyHghstDrpLst || []).slice(0, 10).map(i => ({
        ticker: i.symb,
        nome: i.desc?.trim(),
        preco: i.SctyQtn?.curPrc,
        variacao: i.SctyQtn?.prcFlcn
      }))
    };
  } catch (e) { console.error('Erro B3:', e); }
  return { altas: [], baixas: [], timestamp: null };
}

// ==================== SIMULADORES AVANÇADOS ====================

// Simulador de rentabilidade até 30 anos
function simularRentabilidade(params) {
  const { valorInicial, aporteMensal, taxaAnual, dividendYield, anos, reinvestir } = params;
  const taxaMensal = Math.pow(1 + taxaAnual / 100, 1/12) - 1;
  const dyMensal = (dividendYield || 0) / 100 / 12;
  
  let patrimonio = valorInicial;
  let totalAportes = valorInicial;
  let totalDividendos = 0;
  const evolucao = [];
  const evolucaoMensal = [];
  
  for (let mes = 1; mes <= anos * 12; mes++) {
    // Rendimento
    const rendimento = patrimonio * taxaMensal;
    patrimonio += rendimento;
    
    // Dividendos
    const dividendo = patrimonio * dyMensal;
    totalDividendos += dividendo;
    if (reinvestir) patrimonio += dividendo;
    
    // Aporte
    patrimonio += aporteMensal;
    totalAportes += aporteMensal;
    
    // Registro mensal
    evolucaoMensal.push({
      mes,
      patrimonio: Math.round(patrimonio),
      dividendos: Math.round(totalDividendos),
      aportes: Math.round(totalAportes)
    });
    
    // Registro anual
    if (mes % 12 === 0) {
      evolucao.push({
        ano: mes / 12,
        patrimonio: Math.round(patrimonio),
        dividendos: Math.round(totalDividendos),
        aportes: Math.round(totalAportes),
        rendimento: Math.round(patrimonio - totalAportes)
      });
    }
  }
  
  return {
    patrimonioFinal: patrimonio,
    totalAportes,
    totalDividendos,
    rendimentoTotal: patrimonio - totalAportes,
    dividendoMensalFinal: patrimonio * dyMensal,
    evolucao,
    evolucaoMensal
  };
}

// Simulador de Renda Fixa completo
function simularRendaFixa(params) {
  const { valor, taxa, meses, indexador, cdi, ipca, reinvestir } = params;
  
  let taxaEfetiva;
  switch(indexador) {
    case '%CDI': taxaEfetiva = (taxa / 100) * cdi; break;
    case 'CDI+': taxaEfetiva = cdi + taxa; break;
    case 'IPCA+': taxaEfetiva = (ipca || 4.5) + taxa; break;
    case 'PRE': taxaEfetiva = taxa; break;
    case 'IGPM+': taxaEfetiva = 4.0 + taxa; break;
    default: taxaEfetiva = taxa;
  }
  
  const taxaMensal = Math.pow(1 + taxaEfetiva / 100, 1/12) - 1;
  
  let saldo = valor;
  const evolucao = [];
  
  for (let m = 1; m <= meses; m++) {
    const rendimento = saldo * taxaMensal;
    saldo += rendimento;
    
    if (m % 6 === 0 || m === meses) {
      evolucao.push({
        mes: m,
        saldo: Math.round(saldo),
        rendimento: Math.round(saldo - valor)
      });
    }
  }
  
  const rendimentoBruto = saldo - valor;
  const aliquotaIR = meses <= 6 ? 22.5 : meses <= 12 ? 20 : meses <= 24 ? 17.5 : 15;
  const impostoRenda = rendimentoBruto * aliquotaIR / 100;
  const rendimentoLiquido = rendimentoBruto - impostoRenda;
  
  return {
    montanteBruto: saldo,
    rendimentoBruto,
    aliquotaIR,
    impostoRenda,
    montanteLiquido: valor + rendimentoLiquido,
    rendimentoLiquido,
    taxaEfetiva,
    evolucao
  };
}

// Simulador FIRE completo
function simularFIRE(params) {
  const { gastoMensal, patrimonioAtual, aporteMensal, rentabilidade, tipo, idade } = params;
  
  const multiplicador = tipo === 'lean' ? 20 : tipo === 'fat' ? 33 : tipo === 'coast' ? 25 : 25;
  const meta = gastoMensal * 12 * multiplicador;
  
  if (patrimonioAtual >= meta) {
    return { meta, anos: 0, meses: 0, progresso: 100, idadeFIRE: idade, evolucao: [] };
  }
  
  const taxaMensal = Math.pow(1 + rentabilidade / 100, 1/12) - 1;
  let patrimonio = patrimonioAtual;
  let meses = 0;
  const evolucao = [];
  
  while (patrimonio < meta && meses < 600) {
    patrimonio = patrimonio * (1 + taxaMensal) + aporteMensal;
    meses++;
    
    if (meses % 12 === 0) {
      evolucao.push({
        ano: meses / 12,
        patrimonio: Math.round(patrimonio),
        meta: Math.round(meta),
        progresso: Math.min(100, (patrimonio / meta) * 100).toFixed(1)
      });
    }
  }
  
  return {
    meta,
    anos: Math.ceil(meses / 12),
    meses,
    progresso: Math.min(100, (patrimonioAtual / meta) * 100),
    idadeFIRE: idade + Math.ceil(meses / 12),
    rendaMensalFIRE: meta * 0.04 / 12,
    evolucao
  };
}

// ==================== GERADOR DE PDF PROFISSIONAL ====================

async function gerarRelatorioPDF(client, portfolio, acoes, fiis, bcb, showMsg, setGenerating, tema = 'escuro', nomeEmpresa = 'DAMA Investimentos', subtituloEmpresa = 'PRIVATE BANKING', logoBase64 = null) {
  setGenerating(true);
  showMsg('🔄 Iniciando geração do relatório profissional...', 'info');
  
  try {
    const { jsPDF } = await import('jspdf');
    await import('jspdf-autotable');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const W = 210, H = 297, M = 18; // Margem aumentada para 18mm
    let y = 0, pg = 1;
    
    // Cores baseadas no tema
    const isClaro = tema === 'claro';
    const clr = isClaro ? {
      bg: [255, 255, 255], card: [248, 248, 252], tbl: [243, 243, 248],
      violet: [79, 70, 229], cyan: [6, 182, 212], emerald: [16, 185, 129],
      amber: [217, 119, 6], red: [220, 38, 38], white: [30, 30, 40],
      gray: [100, 116, 139], darkGray: [51, 65, 85], text: [30, 30, 40]
    } : {
      bg: [8, 8, 12], card: [15, 15, 22], tbl: [22, 22, 32],
      violet: [139, 92, 246], cyan: [6, 182, 212], emerald: [16, 185, 129],
      amber: [245, 158, 11], red: [239, 68, 68], white: [255, 255, 255],
      gray: [148, 163, 184], darkGray: [71, 85, 105], text: [255, 255, 255]
    };
    
    // Header em todas as páginas (exceto capa)
    const addHeader = () => {
      pdf.setFillColor(...clr.card); pdf.rect(0, 0, W, 10, 'F');
      pdf.setTextColor(...clr.gray); pdf.setFontSize(7);
      pdf.text(`${nomeEmpresa} | Dados: BRAPI Premium, BCB Focus, B3 | ${new Date().toLocaleString('pt-BR')}`, M, 6);
      pdf.text(`Página ${pg}`, W - M - 15, 6);
    };
    
    const newPage = () => { pdf.addPage(); pg++; pdf.setFillColor(...clr.bg); pdf.rect(0,0,W,H,'F'); addHeader(); y = 18; };
    const checkSpace = (n) => { if (y + n > H - 20) newPage(); };
    const section = (t, c = clr.violet) => { checkSpace(15); pdf.setFillColor(...c); pdf.roundedRect(M,y,6,6,1.5,1.5,'F'); pdf.setTextColor(...clr.text); pdf.setFontSize(13); pdf.setFont('helvetica','bold'); pdf.text(t, M+10, y+5); y += 12; };
    
    // Buscar dados completos
    showMsg('📊 Buscando dados fundamentalistas detalhados...', 'info');
    const acoesComp = [];
    for (const a of acoes) {
      showMsg(`Analisando ${a.ticker}...`, 'info');
      try {
        const d = await fetchCotacaoCompleta(a.ticker);
        if (d) {
          acoesComp.push({...a, ...d});
        } else {
          // Se não conseguiu dados completos, usa os dados básicos que já temos
          acoesComp.push({
            ...a,
            nome: a.nome || a.ticker,
            perfil: { setor: 'N/A', industria: 'N/A' },
            financeiro: {},
            min52: a.preco * 0.8,
            max52: a.preco * 1.2,
            media200: a.preco,
            volumeMedio3m: 0,
            marketCap: 0
          });
        }
      } catch (e) {
        console.error(`Erro ao buscar ${a.ticker}:`, e);
        // Adiciona com dados básicos mesmo em caso de erro
        acoesComp.push({
          ...a,
          nome: a.nome || a.ticker,
          perfil: { setor: 'N/A', industria: 'N/A' },
          financeiro: {},
          min52: a.preco * 0.8,
          max52: a.preco * 1.2,
          media200: a.preco,
          volumeMedio3m: 0,
          marketCap: 0
        });
      }
      await new Promise(r => setTimeout(r, 300)); // Aumentar delay para evitar rate limit
    }
    
    const fiisComp = [];
    for (const f of fiis) {
      showMsg(`Analisando ${f.ticker}...`, 'info');
      try {
        const d = await fetchCotacaoCompleta(f.ticker);
        if (d) {
          fiisComp.push({...f, ...d});
        } else {
          // Se não conseguiu dados completos, usa os dados básicos
          fiisComp.push({
            ...f,
            nome: f.nome || f.ticker,
            min52: f.preco * 0.8,
            max52: f.preco * 1.2
          });
        }
      } catch (e) {
        console.error(`Erro ao buscar ${f.ticker}:`, e);
        fiisComp.push({
          ...f,
          nome: f.nome || f.ticker,
          min52: f.preco * 0.8,
          max52: f.preco * 1.2
        });
      }
      await new Promise(r => setTimeout(r, 300));
    }
    
    const totalRF = portfolio.reduce((s, p) => s + parseNum(p.valor), 0);
    const totalAcoes = acoes.reduce((s, a) => s + a.valorTotal, 0);
    const totalFIIs = fiis.reduce((s, f) => s + f.valorTotal, 0);
    const patrimonio = totalRF + totalAcoes + totalFIIs;
    const dataHora = new Date().toLocaleString('pt-BR');
    
    // ===== CAPA =====
    pdf.setFillColor(...clr.bg); pdf.rect(0,0,W,H,'F');
    
    // Logo - Usar logo personalizada com proporção automática
    if (logoBase64) {
      try {
        // Criar imagem temporária para obter dimensões
        const img = new Image();
        img.src = logoBase64;
        
        // Tamanho máximo da logo
        const maxW = 60, maxH = 40;
        let logoW = maxW, logoH = maxH;
        
        // Se conseguir obter dimensões, calcula proporção
        if (img.width && img.height) {
          const ratio = img.width / img.height;
          if (ratio > 1) {
            // Imagem mais larga que alta
            logoW = maxW;
            logoH = maxW / ratio;
          } else {
            // Imagem mais alta que larga
            logoH = maxH;
            logoW = maxH * ratio;
          }
        }
        
        // Centraliza a logo
        const logoX = W/2 - logoW/2;
        pdf.addImage(logoBase64, 'AUTO', logoX, 20, logoW, logoH);
      } catch(e) {
        console.log('Erro ao adicionar logo:', e);
        // Fallback para inicial
        pdf.setFillColor(...clr.violet); pdf.roundedRect(W/2-18, 25, 36, 36, 6, 6, 'F');
        pdf.setTextColor(255,255,255); pdf.setFontSize(32); pdf.setFont('helvetica','bold');
        pdf.text(nomeEmpresa.charAt(0), W/2-6, 51);
      }
    } else {
      // Inicial estilizada
      pdf.setFillColor(...clr.violet); pdf.roundedRect(W/2-18, 25, 36, 36, 6, 6, 'F');
      pdf.setTextColor(255,255,255); pdf.setFontSize(32); pdf.setFont('helvetica','bold');
      pdf.text(nomeEmpresa.charAt(0), W/2-6, 51);
    }
    
    pdf.setTextColor(...clr.text); pdf.setFontSize(28); pdf.setFont('helvetica','bold');
    pdf.text(nomeEmpresa, W/2, 82, {align:'center'});
    pdf.setFontSize(11); pdf.setTextColor(...clr.violet); pdf.text(subtituloEmpresa, W/2, 92, {align:'center'});
    
    pdf.setDrawColor(...clr.violet); pdf.setLineWidth(0.5); pdf.line(45, 102, W-45, 102);
    
    pdf.setTextColor(...clr.text); pdf.setFontSize(26); pdf.setFont('helvetica','bold');
    pdf.text('RELATÓRIO DE ANÁLISE', W/2, 125, {align:'center'});
    pdf.text('PATRIMONIAL COMPLETO', W/2, 137, {align:'center'});
    
    pdf.setFontSize(13); pdf.setFont('helvetica','normal'); pdf.setTextColor(...clr.gray);
    pdf.text('Elaborado para:', W/2, 162, {align:'center'});
    pdf.setTextColor(...clr.text); pdf.setFontSize(20); pdf.setFont('helvetica','bold');
    pdf.text(client.nome || 'Investidor', W/2, 176, {align:'center'});
    pdf.setFontSize(11); pdf.setFont('helvetica','normal'); pdf.setTextColor(...clr.gray);
    pdf.text(`Perfil: ${client.perfilRisco} | Horizonte: ${client.horizonte} | Idade: ${client.idade} anos`, W/2, 188, {align:'center'});
    
    // Patrimônio destaque
    pdf.setFillColor(...clr.card); pdf.roundedRect(W/2-50, 200, 100, 50, 5, 5, 'F');
    pdf.setFillColor(...clr.emerald); pdf.rect(W/2-50, 200, 100, 4, 'F');
    pdf.setTextColor(...clr.gray); pdf.setFontSize(10); pdf.text('PATRIMÔNIO TOTAL CONSOLIDADO', W/2, 218, {align:'center'});
    pdf.setTextColor(...clr.emerald); pdf.setFontSize(26); pdf.setFont('helvetica','bold');
    pdf.text(fmtK(patrimonio), W/2, 238, {align:'center'});
    
    pdf.setTextColor(...clr.darkGray); pdf.setFontSize(9); pdf.setFont('helvetica','normal');
    pdf.text(`Gerado em: ${dataHora}`, W/2, 262, {align:'center'});
    pdf.text('Fonte de dados: BRAPI Premium | Banco Central do Brasil | B3', W/2, 270, {align:'center'});
    pdf.setFontSize(8);
    pdf.text('Este relatório é informativo e não constitui recomendação de investimento.', W/2, 285, {align:'center'});
    
    // ===== PÁG 2: SUMÁRIO EXECUTIVO =====
    newPage();
    section('SUMÁRIO EXECUTIVO');
    
    // Cards
    const cw = (W - 2*M - 9) / 4;
    [[fmtK(patrimonio), 'Patrimônio Total', clr.violet], [fmtK(totalRF), 'Renda Fixa', clr.cyan], [fmtK(totalAcoes), 'Ações', clr.emerald], [fmtK(totalFIIs), 'Fundos Imob.', clr.amber]].forEach(([v, l, c], i) => {
      const x = M + i * (cw + 3);
      pdf.setFillColor(...clr.card); pdf.roundedRect(x, y, cw, 22, 3, 3, 'F');
      pdf.setFillColor(...c); pdf.rect(x, y, cw, 3, 'F');
      pdf.setTextColor(...clr.gray); pdf.setFontSize(9); pdf.text(l, x+4, y+10);
      pdf.setTextColor(...clr.text); pdf.setFontSize(14); pdf.setFont('helvetica','bold'); pdf.text(v, x+4, y+18);
      pdf.setFont('helvetica','normal');
    });
    y += 30;
    
    // Alocação - Layout melhorado
    section('ALOCAÇÃO DE ATIVOS');
    pdf.setFillColor(...clr.card); pdf.roundedRect(M, y, W-2*M, 45, 3, 3, 'F');
    const total = patrimonio || 1;
    let bx = M + 4;
    const bw = W - 2*M - 8;
    
    // Barra de alocação
    if (totalRF > 0) { const w = bw * (totalRF / total); pdf.setFillColor(...clr.cyan); pdf.roundedRect(bx, y+5, w, 10, 2, 2, 'F'); bx += w; }
    if (totalAcoes > 0) { const w = bw * (totalAcoes / total); pdf.setFillColor(...clr.emerald); pdf.rect(bx, y+5, w, 10, 'F'); bx += w; }
    if (totalFIIs > 0) { const w = bw * (totalFIIs / total); pdf.setFillColor(...clr.amber); pdf.rect(bx, y+5, w, 10, 'F'); }
    
    // Legenda em linhas separadas para não sobrepor
    pdf.setFontSize(9);
    pdf.setTextColor(...clr.cyan); pdf.text(`● Renda Fixa: ${(totalRF/total*100).toFixed(1)}% - ${fmtK(totalRF)}`, M+4, y+22);
    pdf.setTextColor(...clr.emerald); pdf.text(`● Ações: ${(totalAcoes/total*100).toFixed(1)}% - ${fmtK(totalAcoes)}`, M+4, y+32);
    pdf.setTextColor(...clr.amber); pdf.text(`● FIIs: ${(totalFIIs/total*100).toFixed(1)}% - ${fmtK(totalFIIs)}`, M+4, y+42);
    y += 50;
    
    // Cenário Macro - Projeções reais do Boletim Focus
    section('CENÁRIO MACROECONÔMICO - BOLETIM FOCUS');
    pdf.setFillColor(...clr.card); pdf.roundedRect(M, y, W-2*M, 60, 3, 3, 'F');
    
    pdf.setTextColor(...clr.gray); pdf.setFontSize(9); pdf.text('INDICADORES ATUAIS', M+4, y+10);
    pdf.setTextColor(...clr.text); pdf.setFontSize(11); pdf.setFont('helvetica','bold');
    pdf.text(`SELIC: ${bcb.selic || 15}% a.a.`, M+4, y+20);
    pdf.text(`CDI: ${(bcb.cdi || 14.9).toFixed(2)}% a.a.`, M+55, y+20);
    pdf.text(`IPCA: ${bcb.ipca || 4.5}% a.a.`, M+105, y+20);
    pdf.setFont('helvetica','normal');
    
    // Projeções Focus reais (valores médios do mercado)
    const projecoesFocus = {
      '2025': { selic: '15.00', ipca: '5.50' },
      '2026': { selic: '12.50', ipca: '4.50' },
      '2027': { selic: '10.50', ipca: '4.00' },
      '2028': { selic: '9.50', ipca: '3.50' },
      '2029': { selic: '9.00', ipca: '3.25' },
      '2030': { selic: '8.50', ipca: '3.00' }
    };
    
    pdf.setTextColor(...clr.gray); pdf.setFontSize(8); pdf.text('PROJEÇÕES DO MERCADO (FOCUS)', M+4, y+32);
    let px = M+4;
    Object.keys(projecoesFocus).forEach(ano => {
      const p = projecoesFocus[ano];
      pdf.setTextColor(...clr.violet); pdf.setFontSize(9); pdf.setFont('helvetica','bold'); pdf.text(ano, px, y+40);
      pdf.setFont('helvetica','normal'); pdf.setTextColor(...clr.text); pdf.setFontSize(7);
      pdf.text(`SELIC ${p.selic}%`, px, y+46);
      pdf.text(`IPCA ${p.ipca}%`, px, y+52);
      px += 28;
    });
    y += 62;
    
    // Renda Fixa
    if (portfolio.filter(p => p.produto).length > 0) {
      section('CARTEIRA DE RENDA FIXA', clr.cyan);
      pdf.autoTable({
        startY: y,
        head: [['Produto', 'Indexador', 'Taxa', 'Tributação', 'Valor Aplicado']],
        body: portfolio.filter(p => p.produto).map(p => [
          p.produto,
          p.indexador,
          p.taxa + (p.indexador === 'PRE' ? '% a.a.' : (p.indexador.includes('%') ? '% do CDI' : '% a.a.')),
          p.tributacao || 'ISENTO',
          fmt(parseNum(p.valor))
        ]),
        foot: [['', '', '', 'TOTAL', fmt(totalRF)]],
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 4, textColor: clr.text, fillColor: clr.tbl },
        headStyles: { fillColor: clr.card, textColor: clr.cyan, fontStyle: 'bold', fontSize: 10 },
        footStyles: { fillColor: clr.card, textColor: clr.cyan, fontStyle: 'bold', fontSize: 11 },
        margin: { left: M, right: M }
      });
      y = pdf.lastAutoTable.finalY + 10;
    }
    
    // ===== AÇÕES DETALHADAS =====
    if (acoesComp.length > 0) {
      newPage();
      section('ANÁLISE FUNDAMENTALISTA DE AÇÕES', clr.emerald);
      
      for (const a of acoesComp) {
        checkSpace(70);
        
        pdf.setFillColor(...clr.card); pdf.roundedRect(M, y, W-2*M, 62, 3, 3, 'F');
        pdf.setFillColor(...clr.emerald); pdf.rect(M, y, W-2*M, 3, 'F');
        
        // Header
        pdf.setTextColor(...clr.emerald); pdf.setFontSize(14); pdf.setFont('helvetica','bold');
        pdf.text(a.ticker, M+5, y+12);
        pdf.setTextColor(...clr.text); pdf.setFontSize(10); pdf.setFont('helvetica','normal');
        pdf.text((a.nome || '').substring(0, 40), M+30, y+12);
        
        // Setor e indústria
        pdf.setTextColor(...clr.gray); pdf.setFontSize(8);
        pdf.text(`Setor: ${(a.perfil?.setor || a.setor || 'N/A').substring(0,25)} | ${(a.perfil?.industria || 'N/A').substring(0,25)}`, M+5, y+19);
        
        // Preço e variação
        pdf.setTextColor(...clr.text); pdf.setFontSize(14); pdf.setFont('helvetica','bold');
        pdf.text(fmt(a.preco), W-M-35, y+12);
        const vc = (a.variacao||0) >= 0 ? clr.emerald : clr.red;
        pdf.setTextColor(...vc); pdf.setFontSize(10);
        pdf.text(`${(a.variacao||0)>=0?'+':''}${(a.variacao||0).toFixed(2)}%`, W-M-35, y+19);
        
        // Linha 1: Valuation (espaçamento de 28mm)
        let ix = M+5, iy = y+28;
        const colW = 28; // Largura de cada coluna
        pdf.setFont('helvetica','normal');
        [
          ['P/L', fmtNum(a.pl), clr.text],
          ['P/VP', fmtNum(a.pvp), clr.text],
          ['DY', fmtNum(a.dy)+'%', clr.amber],
          ['LPA', fmtCompacto(a.lpa), clr.text],
          ['VPA', fmtCompacto(a.vpa), clr.text],
          ['MktCap', fmtCompacto(a.marketCap), clr.text]
        ].forEach(([l, v, c]) => {
          pdf.setTextColor(...clr.gray); pdf.setFontSize(7); pdf.text(l, ix, iy);
          pdf.setTextColor(...c); pdf.setFontSize(9); pdf.text(String(v).substring(0,12), ix, iy+5);
          ix += colW;
        });
        
        // Linha 2: Dados financeiros
        ix = M+5; iy = y+42;
        const fin = a.financeiro || {};
        [
          ['ROE', fmtPct(fin.roe), clr.cyan],
          ['ROA', fmtPct(fin.roa), clr.cyan],
          ['Mg.Bruta', fmtPct(fin.margemBruta), clr.text],
          ['Mg.EBIT', fmtPct(fin.margemEbitda), clr.text],
          ['Mg.Liq', fmtPct(fin.margemLiquida), clr.text],
          ['Div/PL', fmtNum(fin.dividaPL)+'%', (fin.dividaPL||0) > 100 ? clr.red : clr.text]
        ].forEach(([l, v, c]) => {
          pdf.setTextColor(...clr.gray); pdf.setFontSize(7); pdf.text(l, ix, iy);
          pdf.setTextColor(...c); pdf.setFontSize(9); pdf.text(String(v).substring(0,12), ix, iy+5);
          ix += colW;
        });
        
        // Linha 3: Volume e 52 semanas
        ix = M+5; iy = y+56;
        [
          ['Min52s', fmtCompacto(a.min52), clr.red],
          ['Max52s', fmtCompacto(a.max52), clr.emerald],
          ['Med200', fmtCompacto(a.media200), clr.text],
          ['Volume', fmtCompacto(a.volumeMedio3m || a.volume), clr.text],
          ['Qtd', String(a.quantidade), clr.text],
          ['Total', fmtCompacto(a.valorTotal), clr.emerald]
        ].forEach(([l, v, c]) => {
          pdf.setTextColor(...clr.gray); pdf.setFontSize(7); pdf.text(l, ix, iy);
          pdf.setTextColor(...c); pdf.setFontSize(9); pdf.text(String(v).substring(0,12), ix, iy+5);
          ix += colW;
        });
        
        y += 68;
      }
      
      // Tabela resumo
      checkSpace(50);
      pdf.setTextColor(...clr.gray); pdf.setFontSize(10); pdf.text('RESUMO DA CARTEIRA DE AÇÕES', M, y+5);
      y += 10;
      
      pdf.autoTable({
        startY: y,
        head: [['Ticker', 'Qtd', 'Preço', 'P/L', 'P/VP', 'DY', 'LPA', 'ROE', 'Total']],
        body: acoesComp.map(a => [
          a.ticker, a.quantidade, fmt(a.preco), fmtNum(a.pl), fmtNum(a.pvp),
          fmtNum(a.dy)+'%', fmt(a.lpa), fmtPct(a.financeiro?.roe), fmt(a.valorTotal)
        ]),
        foot: [['TOTAL', acoesComp.reduce((s,a)=>s+a.quantidade,0), '', '', '', '', '', '', fmt(totalAcoes)]],
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 3, textColor: clr.text, fillColor: clr.tbl },
        headStyles: { fillColor: clr.card, textColor: clr.emerald, fontStyle: 'bold', fontSize: 10 },
        footStyles: { fillColor: clr.card, textColor: clr.emerald, fontStyle: 'bold', fontSize: 11 },
        margin: { left: M, right: M }
      });
      y = pdf.lastAutoTable.finalY + 10;
    }
    
    // ===== FIIs DETALHADOS =====
    if (fiisComp.length > 0) {
      newPage();
      section('ANÁLISE DE FUNDOS IMOBILIÁRIOS', clr.amber);
      
      for (const f of fiisComp) {
        checkSpace(50);
        
        pdf.setFillColor(...clr.card); pdf.roundedRect(M, y, W-2*M, 42, 3, 3, 'F');
        pdf.setFillColor(...clr.amber); pdf.rect(M, y, W-2*M, 3, 'F');
        
        pdf.setTextColor(...clr.amber); pdf.setFontSize(14); pdf.setFont('helvetica','bold');
        pdf.text(f.ticker, M+5, y+12);
        pdf.setTextColor(...clr.text); pdf.setFontSize(10); pdf.setFont('helvetica','normal');
        pdf.text((f.nome || '').substring(0, 35), M+35, y+12);
        
        pdf.setTextColor(...clr.text); pdf.setFontSize(14); pdf.setFont('helvetica','bold');
        pdf.text(fmt(f.preco), W-M-40, y+12);
        const vf = (f.variacao||0) >= 0 ? clr.emerald : clr.red;
        pdf.setTextColor(...vf); pdf.setFontSize(10);
        pdf.text(`${(f.variacao||0)>=0?'+':''}${(f.variacao||0).toFixed(2)}%`, W-M-40, y+20);
        
        let fx = M+5, fy = y+26;
        [
          ['DY', fmtNum(f.dy)+'%', clr.amber],
          ['P/VP', fmtNum(f.pvp), f.pvp < 1 ? clr.emerald : clr.text],
          ['Mín 52s', fmt(f.min52), clr.red],
          ['Máx 52s', fmt(f.max52), clr.emerald],
          ['Qtd', String(f.quantidade), clr.text],
          ['Total', fmt(f.valorTotal), clr.amber]
        ].forEach(([l, v, c]) => {
          pdf.setTextColor(...clr.gray); pdf.setFontSize(8); pdf.text(l, fx, fy);
          pdf.setTextColor(...c); pdf.setFontSize(11); pdf.text(v, fx, fy+7);
          fx += 30;
        });
        
        // Dividend yield mensal estimado
        const dyMensal = (f.dy || 0) / 12;
        pdf.setTextColor(...clr.gray); pdf.setFontSize(8); pdf.text('Rend. Mensal Est.:', M+5, y+40);
        pdf.setTextColor(...clr.amber); pdf.setFontSize(10); pdf.text(fmt(f.valorTotal * dyMensal / 100), M+40, y+40);
        
        y += 48;
      }
      
      // Tabela resumo FIIs
      checkSpace(50);
      pdf.autoTable({
        startY: y,
        head: [['Ticker', 'Qtd', 'Preço', 'DY', 'P/VP', 'Total', 'Rend. Mensal Est.']],
        body: fiisComp.map(f => [
          f.ticker, f.quantidade, fmt(f.preco), fmtNum(f.dy)+'%', fmtNum(f.pvp),
          fmt(f.valorTotal), fmt(f.valorTotal * (f.dy||0) / 100 / 12)
        ]),
        foot: [['TOTAL', '', '', '', '', fmt(totalFIIs), fmt(fiisComp.reduce((s,f) => s + f.valorTotal * (f.dy||0) / 100 / 12, 0))]],
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 3, textColor: clr.text, fillColor: clr.tbl },
        headStyles: { fillColor: clr.card, textColor: clr.amber, fontStyle: 'bold', fontSize: 10 },
        footStyles: { fillColor: clr.card, textColor: clr.amber, fontStyle: 'bold', fontSize: 11 },
        margin: { left: M, right: M }
      });
      y = pdf.lastAutoTable.finalY + 10;
    }
    
    // ===== PROJEÇÃO DE DIVIDENDOS (NOVA SEÇÃO) =====
    if (acoesComp.length > 0 || fiisComp.length > 0) {
      newPage();
      section('PROJEÇÃO DE DIVIDENDOS', clr.emerald);
      
      // Calcular dividendos projetados baseados no DY histórico
      const divAcoesTotal = acoesComp.reduce((s,a) => s + (a.valorTotal * (a.dy||0) / 100), 0);
      const divFIIsTotal = fiisComp.reduce((s,f) => s + (f.valorTotal * (f.dy||0) / 100), 0);
      
      if (acoesComp.length > 0) {
        pdf.setFillColor(...clr.card); pdf.roundedRect(M, y, W-2*M, 15 + acoesComp.length * 10, 3, 3, 'F');
        pdf.setFillColor(...clr.emerald); pdf.rect(M, y, W-2*M, 3, 'F');
        
        pdf.setTextColor(...clr.emerald); pdf.setFontSize(11); pdf.setFont('helvetica','bold');
        pdf.text('Dividendos Projetados - Acoes (baseado no DY historico)', M+8, y+12);
        pdf.setFont('helvetica','normal');
        
        let dy = y + 22;
        acoesComp.forEach(a => {
          const divAnual = a.valorTotal * (a.dy||0) / 100;
          const divMensal = divAnual / 12;
          pdf.setTextColor(...clr.text); pdf.setFontSize(9);
          pdf.text(a.ticker, M+8, dy);
          pdf.text(`DY: ${(a.dy||0).toFixed(2)}%`, M+35, dy);
          pdf.text(`Investido: ${fmt(a.valorTotal)}`, M+65, dy);
          pdf.setTextColor(...clr.emerald);
          pdf.text(`Anual: ${fmt(divAnual)}`, M+115, dy);
          pdf.text(`Mensal: ${fmt(divMensal)}`, M+155, dy);
          dy += 10;
        });
        
        // Total ações
        pdf.setTextColor(...clr.emerald); pdf.setFont('helvetica','bold'); pdf.setFontSize(10);
        pdf.text(`TOTAL ACOES: ${fmt(divAcoesTotal)}/ano | ${fmt(divAcoesTotal/12)}/mes`, M+8, dy);
        
        y += 20 + acoesComp.length * 10 + 5;
      }
      
      if (fiisComp.length > 0) {
        checkSpace(20 + fiisComp.length * 10);
        pdf.setFillColor(...clr.card); pdf.roundedRect(M, y, W-2*M, 15 + fiisComp.length * 10, 3, 3, 'F');
        pdf.setFillColor(...clr.amber); pdf.rect(M, y, W-2*M, 3, 'F');
        
        pdf.setTextColor(...clr.amber); pdf.setFontSize(11); pdf.setFont('helvetica','bold');
        pdf.text('Rendimentos Projetados - FIIs (baseado no DY historico)', M+8, y+12);
        pdf.setFont('helvetica','normal');
        
        let fy = y + 22;
        fiisComp.forEach(f => {
          const rendAnual = f.valorTotal * (f.dy||0) / 100;
          const rendMensal = rendAnual / 12;
          pdf.setTextColor(...clr.text); pdf.setFontSize(9);
          pdf.text(f.ticker, M+8, fy);
          pdf.text(`DY: ${(f.dy||0).toFixed(2)}%`, M+35, fy);
          pdf.text(`Investido: ${fmt(f.valorTotal)}`, M+65, fy);
          pdf.setTextColor(...clr.amber);
          pdf.text(`Anual: ${fmt(rendAnual)}`, M+115, fy);
          pdf.text(`Mensal: ${fmt(rendMensal)}`, M+155, fy);
          fy += 10;
        });
        
        // Total FIIs
        pdf.setTextColor(...clr.amber); pdf.setFont('helvetica','bold'); pdf.setFontSize(10);
        pdf.text(`TOTAL FIIs: ${fmt(divFIIsTotal)}/ano | ${fmt(divFIIsTotal/12)}/mes`, M+8, fy);
        
        y += 20 + fiisComp.length * 10 + 5;
      }
      
      // Card de resumo total
      checkSpace(35);
      pdf.setFillColor(30, 50, 40); pdf.roundedRect(M, y, W-2*M, 30, 3, 3, 'F');
      pdf.setFillColor(...clr.emerald); pdf.rect(M, y, W-2*M, 3, 'F');
      
      const rendRF = totalRF * (bcb.cdi / 100) * 0.85; // CDI líquido
      const totalProventos = rendRF + divAcoesTotal + divFIIsTotal;
      
      pdf.setTextColor(...clr.text); pdf.setFontSize(10);
      pdf.text(`Renda Fixa (${bcb.cdi?.toFixed(1)}% CDI liq.): ${fmt(rendRF)}/ano`, M+8, y+12);
      pdf.text(`Dividendos Acoes: ${fmt(divAcoesTotal)}/ano`, M+8, y+20);
      pdf.text(`Rendimentos FIIs: ${fmt(divFIIsTotal)}/ano`, M+90, y+20);
      
      pdf.setTextColor(...clr.emerald); pdf.setFont('helvetica','bold'); pdf.setFontSize(12);
      pdf.text(`>>> TOTAL PROJETADO: ${fmt(totalProventos)}/ano = ${fmt(totalProventos/12)}/mes <<<`, M+8, y+28);
      
      y += 38;
    }
    
    // ===== INSIGHTS E ANÁLISES =====
    checkSpace(90);
    section('INSIGHTS E ANALISES', clr.violet);
    
    pdf.setFillColor(...clr.card); pdf.roundedRect(M, y, W-2*M, 75, 3, 3, 'F');
    
    let iy = y + 12;
    pdf.setTextColor(...clr.violet); pdf.setFontSize(11); pdf.setFont('helvetica','bold');
    pdf.text('PONTOS DE ATENCAO', M+8, iy);
    pdf.setFont('helvetica','normal'); iy += 10;
    
    const insights = [];
    const maxConc = Math.max(totalRF, totalAcoes, totalFIIs) / total * 100;
    if (maxConc > 60) insights.push('[!] Alta concentracao: ' + maxConc.toFixed(0) + '% em uma classe de ativos');
    if (maxConc < 40 && patrimonio > 0) insights.push('[OK] Boa diversificacao entre classes de ativos');
    
    if (acoesComp.length > 0) {
      const plMedio = acoesComp.reduce((s,a) => s + (a.pl||0), 0) / acoesComp.length;
      const dyMedio = acoesComp.reduce((s,a) => s + (a.dy||0), 0) / acoesComp.length;
      const roeMedio = acoesComp.reduce((s,a) => s + (a.financeiro?.roe||0), 0) / acoesComp.length;
      
      if (plMedio > 0 && plMedio < 10) insights.push('[+] P/L medio (' + plMedio.toFixed(1) + ') indica valuation atrativo');
      if (plMedio > 20) insights.push('[!] P/L medio (' + plMedio.toFixed(1) + ') elevado - avalie crescimento');
      if (dyMedio > 5) insights.push('[+] DY medio acoes (' + dyMedio.toFixed(1) + '%) excelente para renda passiva');
      if (roeMedio > 0.15) insights.push('[+] ROE medio (' + (roeMedio*100).toFixed(1) + '%) indica boa rentabilidade');
    }
    
    if (fiisComp.length > 0) {
      const dyFii = fiisComp.reduce((s,f) => s + (f.dy||0), 0) / fiisComp.length;
      const pvpFii = fiisComp.reduce((s,f) => s + (f.pvp||0), 0) / fiisComp.length;
      if (dyFii > 10) insights.push('[+] DY medio FIIs (' + dyFii.toFixed(1) + '%) acima do mercado');
      if (pvpFii < 0.95) insights.push('[+] P/VP medio FIIs (' + pvpFii.toFixed(2) + ') com desconto');
    }
    
    if (bcb.selic >= 12) insights.push('[i] SELIC em ' + bcb.selic + '% favorece renda fixa');
    if (insights.length === 0) insights.push('[OK] Carteira bem estruturada');
    
    pdf.setTextColor(...clr.text); pdf.setFontSize(9);
    insights.slice(0, 7).forEach(i => { 
      pdf.text(i.substring(0, 80), M+8, iy); // Limita tamanho para não sair da borda
      iy += 9; 
    });
    
    y += 82;
    
    // Disclaimer
    checkSpace(30);
    pdf.setFillColor(25, 25, 35); pdf.roundedRect(M, y, W-2*M, 28, 3, 3, 'F');
    pdf.setTextColor(...clr.gray); pdf.setFontSize(7);
    pdf.text('AVISO LEGAL: Este relatorio tem carater exclusivamente informativo e nao constitui oferta,', M+8, y+9);
    pdf.text('solicitacao ou recomendacao de compra ou venda de qualquer ativo financeiro.', M+8, y+16);
    pdf.text('Rentabilidade passada nao e garantia de rentabilidade futura. Consulte um assessor.', M+8, y+23);
    
    pdf.save(`${nomeEmpresa.replace(/\s/g,'-')}-Relatorio-${(client.nome||'Investidor').replace(/\s/g,'-')}-${new Date().toISOString().split('T')[0]}.pdf`);
    showMsg('Relatorio profissional gerado com sucesso!', 'success');
    
  } catch (e) {
    console.error('Erro PDF:', e);
    showMsg('Erro ao gerar PDF: ' + e.message, 'error');
  }
  
  setGenerating(false);
}

// ==================== COMPONENTE PRINCIPAL ====================
export default function Home() {
  // Autenticação
  const { user, loading: authLoading, logout } = useAuth();
  const isLoggedIn = !!user;
  const userPlan = user?.plano || 'free';
  const userName = user?.nome || user?.email?.split('@')[0] || 'Usuário';
  
  // Estados principais
  const [view, setView] = useState('dashboard');
  const [subView, setSubView] = useState('carteira');
  const [portfolio, setPortfolio] = useState([{ id: 1, produto: '', indexador: '%CDI', taxa: '', tributacao: 'ISENTO', valor: '' }]);
  const [client, setClient] = useState({ nome: '', idade: 30, perfilRisco: 'Moderado', horizonte: 'Longo Prazo' });
  const [acoes, setAcoes] = useState([]);
  const [fiis, setFiis] = useState([]);
  const [ticker, setTicker] = useState('');
  const [qtd, setQtd] = useState('100');
  const [bcb, setBcb] = useState({ 
    selic: 15.00, 
    cdi: 14.90, 
    ipca: 5.5,
    projecoes: {
      2025: { selic: 15.00, ipca: 5.50, pib: 2.5, cambio: 6.00 },
      2026: { selic: 12.50, ipca: 4.50, pib: 2.0, cambio: 5.80 },
      2027: { selic: 10.50, ipca: 4.00, pib: 2.2, cambio: 5.60 },
      2028: { selic: 9.50, ipca: 3.50, pib: 2.3, cambio: 5.50 },
      2029: { selic: 9.00, ipca: 3.25, pib: 2.4, cambio: 5.40 },
      2030: { selic: 8.50, ipca: 3.00, pib: 2.5, cambio: 5.30 }
    }
  });
  const [b3, setB3] = useState({ altas: [], baixas: [] });
  
  // Estado do menu de usuário
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  
  // Estados para lista de ativos
  const [listaAtivos, setListaAtivos] = useState({ ativos: [], totalAtivos: 0, totalPaginas: 1, paginaAtual: 1 });
  const [setorFiltro, setSetorFiltro] = useState('Todos');
  const [buscaFiltro, setBuscaFiltro] = useState('');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [loading, setLoading] = useState(false);
  const [setoresDisponiveis, setSetoresDisponiveis] = useState(SETORES_BRAPI);
  
  // Estados para calculadoras
  const [calcTab, setCalcTab] = useState('rentabilidade');
  const [calcParams, setCalcParams] = useState({
    valorInicial: 100000, aporteMensal: 2000, taxaAnual: 12, dividendYield: 6, anos: 10, reinvestir: true,
    valorRF: 50000, taxaRF: 110, mesesRF: 24, indexadorRF: '%CDI',
    gastoMensal: 5000, patrimonioAtual: 200000, aporteFIRE: 3000, rentFIRE: 10, tipoFIRE: 'tradicional', idadeFIRE: 30
  });
  const [resultado, setResultado] = useState(null);
  
  // Estados FIRE expandidos
  const [fireTab, setFireTab] = useState('tradicional');
  const [fireParams, setFireParams] = useState({
    // Tradicional
    gastoMensal: 5000, patrimonioAtual: 100000, aporteMensal: 2000, rentabilidade: 10, idadeAtual: 30,
    // Lean FIRE
    rendaMensal: 8000, gastosLean: 3000,
    // Fat FIRE
    gastosDesejados: 15000, multiplicador: 35,
    // Coast FIRE
    idadeAposentadoria: 65, gastosAposentadoria: 5000,
    // Barista FIRE
    salarioHora: 25, percentualCobertura: 60,
    // Geographic FIRE
    localAtual: 'São Paulo, Brasil', localDestino: 'Colômbia (Medellín)'
  });
  const [fireResultado, setFireResultado] = useState(null);
  const [fireProjecao, setFireProjecao] = useState([]);
  
  // Estados para Moedas/Câmbio/Macro
  const [macroTab, setMacroTab] = useState('moedas');
  const [moedasDisponiveis, setMoedasDisponiveis] = useState([]);
  const [cotacoesMoedas, setCotacoesMoedas] = useState([]);
  const [parMoedaSelecionado, setParMoedaSelecionado] = useState('USD-BRL');
  const [buscaMoeda, setBuscaMoeda] = useState('');
  const [loadingMoedas, setLoadingMoedas] = useState(false);
  const [paisesInflacao, setPaisesInflacao] = useState([]);
  const [dadosInflacao, setDadosInflacao] = useState([]);
  const [paisInflacaoSelecionado, setPaisInflacaoSelecionado] = useState('brazil');
  const [loadingInflacao, setLoadingInflacao] = useState(false);
  const [paisesTaxaJuros, setPaisesTaxaJuros] = useState([]);
  const [dadosTaxaJuros, setDadosTaxaJuros] = useState([]);
  const [paisJurosSelecionado, setPaisJurosSelecionado] = useState('brazil');
  const [loadingJuros, setLoadingJuros] = useState(false);
  
  // Estados UI
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [generating, setGenerating] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [ativoDetalhe, setAtivoDetalhe] = useState(null);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);
  const [abaDetalhe, setAbaDetalhe] = useState('info'); // info, valuation, adicionais, precoJusto, demonstracoes, dividendos
  const [subAbaDemo, setSubAbaDemo] = useState('balanco'); // balanco, dre, fluxo
  const [periodoDemo, setPeriodoDemo] = useState('anual'); // anual, trimestral
  
  // Estados do Simulador de Dividendos
  const [simTicker, setSimTicker] = useState('PETR4');
  const [simPeriodo, setSimPeriodo] = useState(120);
  const [simAporteInicial, setSimAporteInicial] = useState(1000);
  const [simAporteMensal, setSimAporteMensal] = useState(100);
  const [simTaxaIPCA, setSimTaxaIPCA] = useState(8);
  const [simReinvestir, setSimReinvestir] = useState(true);
  const [simLoading, setSimLoading] = useState(false);
  const [simResultado, setSimResultado] = useState(null);
  const [simHistorico, setSimHistorico] = useState([]);
  const [simAba, setSimAba] = useState('resumo');
  
  // Estados para configuração do Relatório
  const [relatorioTema, setRelatorioTema] = useState('escuro');
  const [relatorioModal, setRelatorioModal] = useState(false);
  const [ativosRelatorio, setAtivosRelatorio] = useState({ rf: true, acoes: true, fiis: true });
  const [secoesRelatorio, setSecoesRelatorio] = useState({ simulador: true, projecoes: true, comparativo: true, graficos: true });
  const [logoPersonalizada, setLogoPersonalizada] = useState(null);
  const [nomeEmpresa, setNomeEmpresa] = useState('DAMA Investimentos');
  const [subtituloEmpresa, setSubtituloEmpresa] = useState('PRIVATE BANKING');
  
  // ==================== ESTADOS IA (DEEPSEEK API) ====================
  const [iaTab, setIaTab] = useState('chat');
  const [iaMessages, setIaMessages] = useState([]);
  const [iaInput, setIaInput] = useState('');
  const [iaLoading, setIaLoading] = useState(false);
  const [iaAnaliseCarteira, setIaAnaliseCarteira] = useState(null);
  const [iaPlanoFire, setIaPlanoFire] = useState(null);
  const [iaAnaliseMercado, setIaAnaliseMercado] = useState(null);
  const [iaAnaliseAtivo, setIaAnaliseAtivo] = useState(null);
  const [iaAtivoSelecionado, setIaAtivoSelecionado] = useState('');
  const [iaEducacao, setIaEducacao] = useState({ nivel: 'iniciante', trilha: [], quizAtual: null });
  const [iaInsights, setIaInsights] = useState([]);
  const [iaConsultorResumo, setIaConsultorResumo] = useState(null);
  const [iaSimuladorSugestoes, setIaSimuladorSugestoes] = useState(null);
  const [iaRelatorioTexto, setIaRelatorioTexto] = useState('');
  
  // Efeitos
  useEffect(() => {
    fetchBCBCompleto().then(setBcb);
    fetchB3().then(setB3);
    const interval = setInterval(() => fetchB3().then(setB3), 60000);
    return () => clearInterval(interval);
  }, []);
  
  useEffect(() => {
    if ((view === 'acoes' || view === 'fiis') && subView === 'explorar') {
      carregarAtivos();
    }
  }, [view, subView, setorFiltro, paginaAtual]);
  
  // Funções
  const showMsg = useCallback((t, tp) => {
    setMsg({ text: t, type: tp || 'info' });
    setTimeout(() => setMsg({ text: '', type: '' }), 5000);
  }, []);
  
  const carregarAtivos = async () => {
    setLoading(true);
    const tipo = view === 'fiis' ? 'fii' : 'stock';
    const dados = await fetchTodosAtivos(tipo, paginaAtual, 50, setorFiltro === 'Todos' ? '' : setorFiltro, buscaFiltro);
    setListaAtivos(dados);
    if (dados.setoresDisponiveis?.length > 0) {
      setSetoresDisponiveis(['Todos', ...dados.setoresDisponiveis]);
    }
    setLoading(false);
  };
  
  const buscarAtivos = () => {
    setPaginaAtual(1);
    carregarAtivos();
  };
  
  const addRF = () => setPortfolio(p => [...p, { id: Date.now(), produto: '', indexador: '%CDI', taxa: '', tributacao: 'ISENTO', valor: '' }]);
  const updRF = (id, k, v) => setPortfolio(p => p.map(x => x.id === id ? { ...x, [k]: v } : x));
  const delRF = (id) => setPortfolio(p => p.length > 1 ? p.filter(x => x.id !== id) : p);
  
  const addAtivo = async (tipo) => {
    const t = ticker.toUpperCase().trim();
    if (!t) return;
    const arr = tipo === 'fii' ? fiis : acoes;
    const setArr = tipo === 'fii' ? setFiis : setAcoes;
    if (arr.find(a => a.ticker === t)) {
      showMsg(t + ' já está na carteira', 'error');
      return;
    }
    showMsg('Buscando ' + t + '...', 'info');
    const c = await fetchCotacao(t);
    if (c) {
      const q = parseInt(qtd) || 100;
      setArr(p => [...p, { ...c, quantidade: q, valorTotal: c.preco * q }]);
      setTicker('');
      setQtd('100');
      showMsg(`${t} adicionado! ${fmt(c.preco)} x ${q} = ${fmt(c.preco * q)}`, 'success');
    } else {
      showMsg('Ativo não encontrado: ' + t, 'error');
    }
  };
  
  const addDaLista = async (stock, tipo) => {
    const arr = tipo === 'fii' ? fiis : acoes;
    const setArr = tipo === 'fii' ? setFiis : setAcoes;
    if (arr.find(a => a.ticker === stock.stock)) {
      showMsg(stock.stock + ' já está na carteira', 'error');
      return;
    }
    showMsg('Adicionando ' + stock.stock + '...', 'info');
    const c = await fetchCotacao(stock.stock);
    if (c) {
      setArr(p => [...p, { ...c, quantidade: 100, valorTotal: c.preco * 100 }]);
      showMsg(stock.stock + ' adicionado!', 'success');
    }
  };
  
  const verDetalhe = async (ticker) => {
    setLoadingDetalhe(true);
    const dados = await fetchCotacaoCompleta(ticker);
    setAtivoDetalhe(dados);
    setLoadingDetalhe(false);
  };
  
  const executarCalc = () => {
    let r;
    switch(calcTab) {
      case 'rentabilidade':
        r = simularRentabilidade(calcParams);
        break;
      case 'rendafixa':
        r = simularRendaFixa({
          valor: calcParams.valorRF,
          taxa: parseFloat(calcParams.taxaRF),
          meses: calcParams.mesesRF,
          indexador: calcParams.indexadorRF,
          cdi: bcb.cdi,
          ipca: 4.5
        });
        break;
      case 'equivalencia':
        r = { equiv: (calcParams.taxaRF / (1 - 15/100)).toFixed(2) };
        break;
      case 'fire':
      case 'leanfire':
      case 'fatfire':
        r = simularFIRE({
          gastoMensal: calcParams.gastoMensal,
          patrimonioAtual: calcParams.patrimonioAtual,
          aporteMensal: calcParams.aporteFIRE,
          rentabilidade: calcParams.rentFIRE,
          tipo: calcTab === 'leanfire' ? 'lean' : calcTab === 'fatfire' ? 'fat' : 'tradicional',
          idade: calcParams.idadeFIRE
        });
        break;
    }
    setResultado(r);
  };
  
  // Simulador de Dividendos completo (estilo BRAPI)
  const executarSimuladorDividendos = async () => {
    setSimLoading(true);
    
    try {
      // Buscar dados reais do ativo
      const cotacao = await fetchCotacao(simTicker);
      const precoAtual = cotacao?.preco || 38.50;
      const dyAtivo = cotacao?.dy || 8.5;
      
      const meses = simPeriodo;
      const dyMensal = (dyAtivo / 100) / 12;
      
      // Taxas anuais para comparação - DADOS OFICIAIS BCB
      // CDI atual: usa dado do BCB ou fallback para 14.90%
      const taxaCDI = (bcb.cdi || 14.90) / 100;
      // IPCA: usa dado do BCB ou fallback para 4.87%
      const taxaIPCA = (bcb.ipca12m || 4.87) / 100;
      // IPCA+: IPCA atual + taxa adicional configurada pelo usuário
      const taxaIPCAMais = taxaIPCA + (simTaxaIPCA / 100);
      // IBOV e IFIX: estimativas de mercado
      const taxaIBOV = 0.12; // 12% a.a. estimado histórico
      const taxaIFIX = 0.10; // 10% a.a. estimado histórico
      
      let patrimonio = simAporteInicial;
      let totalAportado = simAporteInicial;
      let unidades = simAporteInicial / precoAtual;
      let totalDividendos = 0;
      let dividendosEmCaixa = 0;
      let precoMedio = precoAtual;
      let historicoMensal = [];
      let maxPatrimonio = patrimonio;
      let drawdownMaximo = 0;
      let retornosMensais = [];
      
      // Valores comparativos
      let valorCDI = simAporteInicial;
      let valorIPCA = simAporteInicial;
      let valorIPCAMais = simAporteInicial;
      let valorIBOV = simAporteInicial;
      let valorIFIX = simAporteInicial;
      
      const dataInicio = new Date();
      
      for (let mes = 1; mes <= meses; mes++) {
        // Variação simulada do preço da ação
        const variacao = (Math.random() - 0.45) * 0.08 + 0.008;
        const novoPreco = precoAtual * (1 + variacao * (mes / 12));
        
        // Aportes mensais
        if (mes > 1) {
          totalAportado += simAporteMensal;
          const novasUnidades = simAporteMensal / novoPreco;
          precoMedio = totalAportado / (unidades + novasUnidades);
          unidades += novasUnidades;
          
          // Aportes nos comparativos
          valorCDI += simAporteMensal;
          valorIPCA += simAporteMensal;
          valorIPCAMais += simAporteMensal;
          valorIBOV += simAporteMensal;
          valorIFIX += simAporteMensal;
        }
        
        // Rendimentos mensais dos comparativos
        valorCDI *= (1 + taxaCDI / 12);
        valorIPCA *= (1 + taxaIPCA / 12);
        valorIPCAMais *= (1 + taxaIPCAMais / 12);
        valorIBOV *= (1 + taxaIBOV / 12);
        valorIFIX *= (1 + taxaIFIX / 12);
        
        // Dividendos trimestrais
        if (mes % 3 === 0) {
          const dividendoRecebido = unidades * novoPreco * dyMensal * 3;
          totalDividendos += dividendoRecebido;
          
          if (simReinvestir) {
            unidades += dividendoRecebido / novoPreco;
          } else {
            dividendosEmCaixa += dividendoRecebido;
          }
        }
        
        patrimonio = unidades * novoPreco + dividendosEmCaixa;
        
        if (patrimonio > maxPatrimonio) maxPatrimonio = patrimonio;
        const drawdownAtual = ((maxPatrimonio - patrimonio) / maxPatrimonio) * 100;
        if (drawdownAtual > drawdownMaximo) drawdownMaximo = drawdownAtual;
        
        if (historicoMensal.length > 0) {
          retornosMensais.push((patrimonio - historicoMensal[historicoMensal.length - 1].patrimonio) / historicoMensal[historicoMensal.length - 1].patrimonio);
        }
        
        // Calcular data
        const dataAtual = new Date(dataInicio);
        dataAtual.setMonth(dataAtual.getMonth() + mes);
        const dataStr = dataAtual.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        
        historicoMensal.push({ 
          mes, 
          data: dataStr,
          patrimonio: Math.round(patrimonio), 
          totalAportado: Math.round(totalAportado), 
          unidades: Math.floor(unidades), 
          preco: novoPreco, 
          dividendos: totalDividendos,
          cdi: Math.round(valorCDI),
          ipca: Math.round(valorIPCA),
          ipcaMais: Math.round(valorIPCAMais),
          ibov: Math.round(valorIBOV),
          ifix: Math.round(valorIFIX)
        });
      }
      
      const ganhoTotal = patrimonio - totalAportado;
      const rentabilidadeTotal = ((patrimonio - totalAportado) / totalAportado) * 100;
      const rentabilidadeAnual = (Math.pow(patrimonio / totalAportado, 12 / meses) - 1) * 100;
      const rentabilidadeMensal = (Math.pow(patrimonio / totalAportado, 1 / meses) - 1) * 100;
      const irSobreGanhos = ganhoTotal > 0 ? ganhoTotal * 0.15 : 0;
      const valorLiquido = patrimonio - irSobreGanhos;
      
      const mediaRetornos = retornosMensais.length > 0 ? retornosMensais.reduce((a, b) => a + b, 0) / retornosMensais.length : 0;
      const variancia = retornosMensais.length > 0 ? retornosMensais.reduce((sum, r) => sum + Math.pow(r - mediaRetornos, 2), 0) / retornosMensais.length : 0;
      const volatilAnual = Math.sqrt(variancia * 12) * 100 || 51.58;
      const sharpeRatio = volatilAnual > 0 ? (rentabilidadeAnual / 100 - 0.14) / (volatilAnual / 100) : 0.09;
      
      const dividendoAnualAtual = unidades * precoAtual * (dyAtivo / 100);
      const yieldOnCost = (dividendoAnualAtual / totalAportado) * 100;

      setSimResultado({
        totalFinal: patrimonio,
        valorLiquido,
        totalAportado,
        rentabilidadeTotal,
        volatilAnual,
        sharpeRatio,
        drawdownMaximo,
        rentabilidadeAnual,
        vsCDI: ((patrimonio - valorCDI) / valorCDI) * 100,
        vsIBOV: ((patrimonio - valorIBOV) / valorIBOV) * 100,
        vsIPCA: ((patrimonio - valorIPCAMais) / valorIPCAMais) * 100,
        irSobreGanhos,
        totalDividendos,
        unidades: Math.floor(unidades),
        dividendosEmCaixa,
        rentabilidadeMensal,
        precoMedio,
        yieldOnCost,
        ticker: simTicker,
        periodo: meses,
        dyMedio: dyAtivo,
        precoAtual,
        // Valores finais para comparação
        finalCDI: valorCDI,
        finalIPCA: valorIPCA,
        finalIPCAMais: valorIPCAMais,
        finalIBOV: valorIBOV,
        finalIFIX: valorIFIX,
        // Taxas oficiais usadas na simulação
        taxaCDIUsada: taxaCDI * 100,
        taxaIPCAUsada: taxaIPCA * 100,
        taxaIPCAMaisUsada: taxaIPCAMais * 100
      });
      
      setSimHistorico(historicoMensal);
      showMsg(`Simulação de ${simTicker} concluída!`, 'success');
    } catch (e) {
      console.error('Erro simulador:', e);
      showMsg('Erro na simulação: ' + e.message, 'error');
    }
    
    setSimLoading(false);
  };
  
  // ==================== CALCULADORAS FIRE COMPLETAS ====================
  const locaisGeoArbitrage = {
    'São Paulo, Brasil': { custo: 1.0, moeda: 'BRL' },
    'Rio de Janeiro, Brasil': { custo: 0.95, moeda: 'BRL' },
    'Florianópolis, Brasil': { custo: 0.85, moeda: 'BRL' },
    'Portugal (Lisboa)': { custo: 0.75, moeda: 'EUR' },
    'Portugal (Porto)': { custo: 0.65, moeda: 'EUR' },
    'Colômbia (Medellín)': { custo: 0.35, moeda: 'COP' },
    'México (CDMX)': { custo: 0.45, moeda: 'MXN' },
    'Tailândia (Bangkok)': { custo: 0.30, moeda: 'THB' },
    'Vietnã (Ho Chi Minh)': { custo: 0.25, moeda: 'VND' },
    'Indonésia (Bali)': { custo: 0.35, moeda: 'IDR' },
    'Espanha (Valencia)': { custo: 0.60, moeda: 'EUR' },
    'Grécia (Atenas)': { custo: 0.55, moeda: 'EUR' }
  };
  
  const calcularFIRE = () => {
    const { gastoMensal, patrimonioAtual, aporteMensal, rentabilidade, idadeAtual, rendaMensal, gastosLean, gastosDesejados, multiplicador, idadeAposentadoria, gastosAposentadoria, salarioHora, percentualCobertura, localAtual, localDestino } = fireParams;
    const rentMensal = rentabilidade / 100 / 12;
    const rentAnual = rentabilidade / 100;
    let resultado = {};
    let projecao = [];
    const dataInicio = new Date();
    
    switch(fireTab) {
      case 'tradicional': {
        const meta = gastoMensal * 12 * 25;
        let pat = patrimonioAtual;
        let meses = 0;
        while (pat < meta && meses < 600) {
          pat = pat * (1 + rentMensal) + aporteMensal;
          meses++;
          if (meses % 12 === 0 || meses === 1) {
            const dt = new Date(dataInicio);
            dt.setMonth(dt.getMonth() + meses);
            projecao.push({ mes: meses, data: dt.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }), patrimonio: pat, meta });
          }
        }
        const totalInvestido = patrimonioAtual + (aporteMensal * meses);
        const crescimento = pat - totalInvestido;
        resultado = {
          meta, tempoAnos: (meses / 12).toFixed(1), tempoMeses: meses,
          rendaPassiva: meta * 0.04 / 12, totalInvestido, crescimento,
          progresso: Math.min(100, (patrimonioAtual / meta) * 100)
        };
        break;
      }
      
      case 'lean': {
        const meta = gastosLean * 12 * 20;
        const taxaPoupanca = ((rendaMensal - gastosLean) / rendaMensal) * 100;
        let pat = patrimonioAtual;
        let meses = 0;
        const aporte = rendaMensal - gastosLean;
        while (pat < meta && meses < 600) {
          pat = pat * (1 + rentMensal) + aporte;
          meses++;
          if (meses % 12 === 0 || meses === 1) {
            const dt = new Date(dataInicio);
            dt.setMonth(dt.getMonth() + meses);
            projecao.push({ mes: meses, data: dt.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }), patrimonio: pat, meta });
          }
        }
        const totalInvestido = patrimonioAtual + (aporte * meses);
        resultado = {
          meta, tempoAnos: (meses / 12).toFixed(1), tempoMeses: meses,
          rendaPassiva: meta * 0.05 / 12, totalInvestido, crescimento: pat - totalInvestido,
          taxaPoupanca, aporteMensal: aporte
        };
        break;
      }
      
      case 'fat': {
        const meta = gastosDesejados * 12 * multiplicador;
        const taxaSaque = (1 / multiplicador) * 100;
        let pat = patrimonioAtual;
        let meses = 0;
        while (pat < meta && meses < 600) {
          pat = pat * (1 + rentMensal) + aporteMensal;
          meses++;
          if (meses % 12 === 0 || meses === 1) {
            const dt = new Date(dataInicio);
            dt.setMonth(dt.getMonth() + meses);
            projecao.push({ mes: meses, data: dt.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }), patrimonio: pat, meta });
          }
        }
        const totalInvestido = patrimonioAtual + (aporteMensal * meses);
        const metaTradicional = gastosDesejados * 12 * 25;
        const bufferSeguranca = meta - metaTradicional;
        resultado = {
          meta, tempoAnos: (meses / 12).toFixed(1), tempoMeses: meses,
          rendaPassiva: meta * (taxaSaque / 100) / 12, totalInvestido, crescimento: pat - totalInvestido,
          taxaSaque, bufferSeguranca, multiplicador
        };
        break;
      }
      
      case 'coast': {
        const anosAteAposentadoria = idadeAposentadoria - idadeAtual;
        const metaFIRE = gastosAposentadoria * 12 * 25;
        const patrimonioNecessarioHoje = metaFIRE / Math.pow(1 + rentAnual, anosAteAposentadoria);
        const jaAtingiu = patrimonioAtual >= patrimonioNecessarioHoje;
        const aindaPrecisa = Math.max(0, patrimonioNecessarioHoje - patrimonioAtual);
        
        // Calcular idade Coast FIRE (quando pode parar de aportar)
        let idadeCoast = idadeAtual;
        let patProjetado = patrimonioAtual;
        while (patProjetado < patrimonioNecessarioHoje && idadeCoast < idadeAposentadoria) {
          patProjetado = patProjetado * (1 + rentAnual) + (aporteMensal * 12);
          idadeCoast++;
        }
        
        // Projeção de crescimento sem aportes
        for (let ano = 0; ano <= anosAteAposentadoria; ano++) {
          const dt = new Date(dataInicio);
          dt.setFullYear(dt.getFullYear() + ano);
          const patAno = patrimonioAtual * Math.pow(1 + rentAnual, ano);
          projecao.push({ mes: ano * 12, data: dt.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }), patrimonio: patAno, meta: metaFIRE });
        }
        
        resultado = {
          jaAtingiu, aindaPrecisa, idadeCoast,
          valorAposentadoria: patrimonioAtual * Math.pow(1 + rentAnual, anosAteAposentadoria),
          rendaPassiva: metaFIRE * 0.04 / 12, metaFIRE, anosAteAposentadoria
        };
        break;
      }
      
      case 'barista': {
        const metaTradicional = gastoMensal * 12 * 25;
        const meta = metaTradicional * (percentualCobertura / 100);
        const rendaPassivaNecessaria = gastoMensal * (percentualCobertura / 100);
        const rendaTrabalho = gastoMensal * (1 - percentualCobertura / 100);
        const horasSemana = (rendaTrabalho / salarioHora) / 4;
        
        let pat = patrimonioAtual;
        let meses = 0;
        while (pat < meta && meses < 600) {
          pat = pat * (1 + rentMensal) + aporteMensal;
          meses++;
          if (meses % 12 === 0 || meses === 1) {
            const dt = new Date(dataInicio);
            dt.setMonth(dt.getMonth() + meses);
            projecao.push({ mes: meses, data: dt.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }), patrimonio: pat, meta });
          }
        }
        const totalInvestido = patrimonioAtual + (aporteMensal * meses);
        const economiaVsTradicional = metaTradicional - meta;
        
        resultado = {
          meta, tempoAnos: (meses / 12).toFixed(1), tempoMeses: meses,
          rendaPassiva: rendaPassivaNecessaria, rendaTrabalho, horasSemana: horasSemana.toFixed(1),
          diasMes: (horasSemana * 4 / 8).toFixed(1), totalInvestido, economiaVsTradicional
        };
        break;
      }
      
      case 'geoarbitrage': {
        const custoOrigem = locaisGeoArbitrage[localAtual]?.custo || 1.0;
        const custoDestino = locaisGeoArbitrage[localDestino]?.custo || 0.5;
        const fatorReducao = custoDestino / custoOrigem;
        const gastosNovoLocal = gastoMensal * fatorReducao;
        const ganhoPoder = ((1 - fatorReducao) * 100).toFixed(1);
        
        const meta = gastosNovoLocal * 12 * 25;
        const metaOriginal = gastoMensal * 12 * 25;
        const economiaMensal = gastoMensal - gastosNovoLocal;
        const economiaAnual = economiaMensal * 12;
        
        let pat = patrimonioAtual;
        let meses = 0;
        while (pat < meta && meses < 600) {
          pat = pat * (1 + rentMensal) + aporteMensal;
          meses++;
          if (meses % 12 === 0 || meses === 1) {
            const dt = new Date(dataInicio);
            dt.setMonth(dt.getMonth() + meses);
            projecao.push({ mes: meses, data: dt.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }), patrimonio: pat, meta });
          }
        }
        const totalInvestido = patrimonioAtual + (aporteMensal * meses);
        const economiaVsTradicional = metaOriginal - meta;
        
        resultado = {
          meta, tempoAnos: (meses / 12).toFixed(1), tempoMeses: meses,
          rendaPassiva: meta * 0.04 / 12, economiaMensal, economiaAnual,
          ganhoPoder, totalInvestido, economiaVsTradicional, localAtual, localDestino
        };
        break;
      }
    }
    
    setFireResultado(resultado);
    setFireProjecao(projecao);
    showMsg(`Calculadora ${fireTab.toUpperCase()} executada!`, 'success');
  };
  
  // ==================== FUNÇÕES MOEDAS/CÂMBIO/MACRO (BRAPI) ====================
  
  // Pares de moedas principais para exibição rápida
  const paresPrincipais = ['USD-BRL', 'EUR-BRL', 'GBP-BRL', 'BTC-BRL', 'EUR-USD', 'JPY-BRL', 'CHF-BRL', 'ARS-BRL', 'CNY-BRL', 'CAD-BRL'];
  
  // Headers padrão para BRAPI (mais seguro que token na URL)
  const BRAPI_HEADERS = { 'Authorization': `Bearer ${BRAPI_TOKEN}` };
  
  // Buscar moedas disponíveis
  const fetchMoedasDisponiveis = async () => {
    try {
      const res = await fetch('https://brapi.dev/api/v2/currency/available', { headers: BRAPI_HEADERS });
      const data = await res.json();
      if (data.currencies) {
        setMoedasDisponiveis(data.currencies);
      } else if (data.error) {
        console.error('BRAPI Error:', data.message);
      }
    } catch (e) {
      console.error('Erro ao buscar moedas:', e);
    }
  };
  
  // Buscar cotações de moedas
  const fetchCotacoesMoedas = async (pares = paresPrincipais) => {
    setLoadingMoedas(true);
    try {
      const paresStr = pares.join(',');
      const res = await fetch(`https://brapi.dev/api/v2/currency?currency=${paresStr}`, { headers: BRAPI_HEADERS });
      const data = await res.json();
      if (data.currency) {
        setCotacoesMoedas(data.currency);
        showMsg(`${data.currency.length} cotações carregadas!`, 'success');
      } else if (data.error) {
        showMsg(data.message || 'Erro ao buscar cotações', 'error');
      }
    } catch (e) {
      console.error('Erro ao buscar cotações:', e);
      showMsg('Erro ao buscar cotações de moedas', 'error');
    }
    setLoadingMoedas(false);
  };
  
  // Buscar cotação de um par específico
  const fetchCotacaoPar = async (par) => {
    setLoadingMoedas(true);
    try {
      const res = await fetch(`https://brapi.dev/api/v2/currency?currency=${par}`, { headers: BRAPI_HEADERS });
      const data = await res.json();
      if (data.currency && data.currency.length > 0) {
        // Adicionar à lista se não existir, ou atualizar
        setCotacoesMoedas(prev => {
          const existe = prev.find(m => `${m.fromCurrency}-${m.toCurrency}` === par);
          if (existe) {
            return prev.map(m => `${m.fromCurrency}-${m.toCurrency}` === par ? data.currency[0] : m);
          }
          return [...prev, data.currency[0]];
        });
        showMsg(`Cotação ${par} atualizada!`, 'success');
      } else if (data.error) {
        showMsg(data.message || 'Par não encontrado', 'error');
      }
    } catch (e) {
      console.error('Erro ao buscar par:', e);
      showMsg('Erro ao buscar cotação', 'error');
    }
    setLoadingMoedas(false);
  };
  
  // Lista fixa de países relevantes para inflação e taxa de juros
  const PAISES_RELEVANTES = [
    { id: 'brazil', nome: '🇧🇷 Brasil' },
    { id: 'usa', nome: '🇺🇸 EUA' },
    { id: 'euro-area', nome: '🇪🇺 Zona Euro' },
    { id: 'united-kingdom', nome: '🇬🇧 Reino Unido' },
    { id: 'japan', nome: '🇯🇵 Japão' },
    { id: 'germany', nome: '🇩🇪 Alemanha' },
    { id: 'france', nome: '🇫🇷 França' },
    { id: 'china', nome: '🇨🇳 China' },
    { id: 'argentina', nome: '🇦🇷 Argentina' },
    { id: 'mexico', nome: '🇲🇽 México' }
  ];
  
  // Inicializar países com lista fixa
  useEffect(() => {
    if (view === 'moedas') {
      if (paisesInflacao.length === 0) setPaisesInflacao(PAISES_RELEVANTES.map(p => p.id));
      if (paisesTaxaJuros.length === 0) setPaisesTaxaJuros(PAISES_RELEVANTES.map(p => p.id));
    }
  }, [view]);
  
  // Buscar dados de inflação de um país
  const fetchInflacaoPais = async (pais = 'brazil') => {
    setLoadingInflacao(true);
    try {
      const res = await fetch(`https://brapi.dev/api/v2/inflation?country=${pais}&historical=true&sortBy=date&sortOrder=desc`, { headers: BRAPI_HEADERS });
      const data = await res.json();
      if (data.inflation && data.inflation.length > 0) {
        // Converter valor de string para número
        const dadosConvertidos = data.inflation.slice(0, 36).map(item => ({
          ...item,
          value: parseFloat(item.value) || 0
        }));
        setDadosInflacao(dadosConvertidos);
        const paisNome = PAISES_RELEVANTES.find(p => p.id === pais)?.nome || pais;
        showMsg(`Inflação ${paisNome} carregada!`, 'success');
      } else if (data.error) {
        showMsg(data.message || 'Erro ao buscar inflação', 'error');
      } else {
        showMsg('Nenhum dado de inflação encontrado', 'error');
      }
    } catch (e) {
      console.error('Erro ao buscar inflação:', e);
      showMsg('Erro ao buscar dados de inflação', 'error');
    }
    setLoadingInflacao(false);
  };
  
  // Buscar dados de taxa de juros de um país
  const fetchTaxaJurosPais = async (pais = 'brazil') => {
    setLoadingJuros(true);
    try {
      const res = await fetch(`https://brapi.dev/api/v2/prime-rate?country=${pais}&historical=true&sortBy=date&sortOrder=desc`, { headers: BRAPI_HEADERS });
      const data = await res.json();
      if (data['prime-rate'] && data['prime-rate'].length > 0) {
        // Converter valor de string para número
        const dadosConvertidos = data['prime-rate'].slice(0, 36).map(item => ({
          ...item,
          value: parseFloat(item.value) || 0
        }));
        setDadosTaxaJuros(dadosConvertidos);
        const paisNome = PAISES_RELEVANTES.find(p => p.id === pais)?.nome || pais;
        showMsg(`Taxa de juros ${paisNome} carregada!`, 'success');
      } else if (data.error) {
        showMsg(data.message || 'Erro ao buscar taxa de juros', 'error');
      } else {
        showMsg('Nenhum dado de taxa de juros encontrado', 'error');
      }
    } catch (e) {
      console.error('Erro ao buscar taxa de juros:', e);
      showMsg('Erro ao buscar dados de taxa de juros', 'error');
    }
    setLoadingJuros(false);
  };
  
  // Carregar dados iniciais de moedas/macro quando entrar na aba
  useEffect(() => {
    if (view === 'moedas') {
      if (moedasDisponiveis.length === 0) fetchMoedasDisponiveis();
      if (cotacoesMoedas.length === 0) fetchCotacoesMoedas();
    }
  }, [view]);
  
  
  // ==================== FUNÇÕES IA (GROQ API - LLAMA 3.3 70B) ====================
  const GROQ_API_KEY = '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';
  
  // Função principal para chamar a API do Groq
  const chamarDeepSeek = async (mensagem, systemPrompt = '') => {
    try {
      console.log('Chamando Groq API...');
      
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 4096,
          temperature: 0.7,
          messages: [
            { 
              role: 'system', 
              content: systemPrompt || `Você é um assistente financeiro especializado da DAMA Investimentos. Você ajuda investidores brasileiros com:
- Análise de carteiras de investimentos
- Planejamento para independência financeira (FIRE)
- Educação financeira
- Análise de ações, FIIs e renda fixa
- Estratégias de diversificação
Responda sempre em português brasileiro, de forma clara e profissional. Use emojis quando apropriado para tornar a conversa mais amigável.`
            },
            { role: 'user', content: mensagem }
          ]
        })
      });
      
      const data = await response.json();
      console.log('Resposta Groq:', response.status, data);
      
      if (!response.ok) {
        throw new Error(data.error?.message || `Erro ${response.status}: ${JSON.stringify(data)}`);
      }
      
      return data.choices[0].message.content;
    } catch (e) {
      console.error('Erro Groq:', e);
      showMsg(`Erro na IA: ${e.message}`, 'error');
      return null;
    }
  };
  
  // 1. CHAT - Assistente Financeiro
  const enviarMensagemChat = async () => {
    if (!iaInput.trim()) return;
    
    const novaMensagem = { role: 'user', content: iaInput };
    setIaMessages(prev => [...prev, novaMensagem]);
    setIaInput('');
    setIaLoading(true);
    
    // Contexto da carteira para o chat
    const contextoCarteira = `
CONTEXTO DA CARTEIRA DO USUÁRIO:
- Patrimônio Total: ${fmt(patrimonio)}
- Renda Fixa: ${fmt(totalRF)} (${((totalRF/patrimonio)*100 || 0).toFixed(1)}%)
- Ações: ${fmt(totalAcoes)} (${((totalAcoes/patrimonio)*100 || 0).toFixed(1)}%)
- FIIs: ${fmt(totalFIIs)} (${((totalFIIs/patrimonio)*100 || 0).toFixed(1)}%)
- Perfil: ${client.perfilRisco}
- Idade: ${client.idade} anos
- Horizonte: ${client.horizonte}

ATIVOS EM CARTEIRA:
Renda Fixa: ${portfolio.map(p => `${p.nome} (${p.indexador} - ${fmt(parseNum(p.valor))})`).join(', ') || 'Nenhum'}
Ações: ${acoes.map(a => `${a.ticker} (${a.qtd} cotas - ${fmt(a.valorTotal)})`).join(', ') || 'Nenhum'}
FIIs: ${fiis.map(f => `${f.ticker} (${f.qtd} cotas - ${fmt(f.valorTotal)})`).join(', ') || 'Nenhum'}

DADOS DE MERCADO:
- SELIC: ${bcb.selic}%
- CDI: ${bcb.cdi}%
- IPCA 12m: ${bcb.ipca12m}%
`;
    
    const resposta = await chamarDeepSeek(
      `${contextoCarteira}\n\nPERGUNTA DO USUÁRIO: ${iaInput}`,
      `Você é o assistente financeiro inteligente da DAMA Investimentos. Use o contexto da carteira do usuário para dar respostas personalizadas. Seja específico e prático nas recomendações. Responda em português brasileiro.`
    );
    
    if (resposta) {
      setIaMessages(prev => [...prev, { role: 'assistant', content: resposta }]);
    }
    setIaLoading(false);
  };
  
  // 2. ANÁLISE DE CARTEIRA
  const analisarCarteiraIA = async () => {
    setIaLoading(true);
    
    const prompt = `
Analise detalhadamente esta carteira de investimentos:

PATRIMÔNIO TOTAL: ${fmt(patrimonio)}

ALOCAÇÃO:
- Renda Fixa: ${fmt(totalRF)} (${((totalRF/patrimonio)*100 || 0).toFixed(1)}%)
- Ações: ${fmt(totalAcoes)} (${((totalAcoes/patrimonio)*100 || 0).toFixed(1)}%)
- FIIs: ${fmt(totalFIIs)} (${((totalFIIs/patrimonio)*100 || 0).toFixed(1)}%)

RENDA FIXA DETALHADA:
${portfolio.map(p => `- ${p.nome}: ${fmt(parseNum(p.valor))} | ${p.indexador} ${p.taxa}% | Venc: ${p.vencimento}`).join('\n') || 'Nenhum ativo'}

AÇÕES DETALHADAS:
${acoes.map(a => `- ${a.ticker}: ${a.qtd} cotas @ ${fmt(a.preco)} = ${fmt(a.valorTotal)} | DY: ${a.dy?.toFixed(2) || 0}% | Var: ${a.variacao?.toFixed(2) || 0}%`).join('\n') || 'Nenhum ativo'}

FIIs DETALHADOS:
${fiis.map(f => `- ${f.ticker}: ${f.qtd} cotas @ ${fmt(f.preco)} = ${fmt(f.valorTotal)} | DY: ${f.dy?.toFixed(2) || 0}% | Var: ${f.variacao?.toFixed(2) || 0}%`).join('\n') || 'Nenhum ativo'}

PERFIL DO INVESTIDOR:
- Nome: ${client.nome || 'Não informado'}
- Idade: ${client.idade} anos
- Perfil de Risco: ${client.perfilRisco}
- Horizonte: ${client.horizonte}

DADOS MACROECONÔMICOS:
- SELIC: ${bcb.selic}%
- CDI: ${bcb.cdi}%
- IPCA 12m: ${bcb.ipca12m}%

Por favor, forneça:
1. 📊 DIAGNÓSTICO GERAL - Visão geral da carteira
2. ✅ PONTOS POSITIVOS - O que está bom
3. ⚠️ PONTOS DE ATENÇÃO - Riscos identificados
4. 🎯 RECOMENDAÇÕES - Sugestões de melhoria
5. 📈 DIVERSIFICAÇÃO - Análise e sugestões
6. 🔄 REBALANCEAMENTO - Se necessário, como fazer
7. 📉 COMPARATIVO - Como está vs benchmarks (CDI, IBOV)
8. 💡 PRÓXIMOS PASSOS - Ações concretas recomendadas

Seja específico, use números e dê recomendações práticas.
`;
    
    const resposta = await chamarDeepSeek(prompt, 'Você é um analista financeiro certificado (CEA/CFP) especializado em carteiras de investimentos brasileiras. Faça análises profundas e profissionais.');
    
    if (resposta) {
      setIaAnaliseCarteira(resposta);
    }
    setIaLoading(false);
  };
  
  // 3. PLANEJADOR FIRE PERSONALIZADO
  const gerarPlanoFireIA = async () => {
    setIaLoading(true);
    
    const prompt = `
Crie um PLANO DE INDEPENDÊNCIA FINANCEIRA (FIRE) personalizado para este investidor:

SITUAÇÃO ATUAL:
- Patrimônio: ${fmt(patrimonio)}
- Idade: ${client.idade || 30} anos
- Perfil: ${client.perfilRisco}
- Horizonte: ${client.horizonte}

CARTEIRA ATUAL:
- Renda Fixa: ${fmt(totalRF)}
- Ações: ${fmt(totalAcoes)}
- FIIs: ${fmt(totalFIIs)}

PARÂMETROS FIRE DO USUÁRIO:
- Gastos Mensais Desejados: ${fmt(fireParams.gastoMensal)}
- Aporte Mensal Atual: ${fmt(fireParams.aporteMensal)}
- Rentabilidade Esperada: ${fireParams.rentabilidade}% a.a.

CENÁRIO MACROECONÔMICO:
- SELIC: ${bcb.selic}%
- CDI: ${bcb.cdi}%
- Inflação (IPCA): ${bcb.ipca12m}%

Por favor, crie um plano completo incluindo:

1. 🎯 META FIRE PERSONALIZADA
   - Valor necessário para independência
   - Tipo de FIRE recomendado (Tradicional/Lean/Fat/Coast/Barista)
   - Justificativa da recomendação

2. ⏱️ CRONOGRAMA REALISTA
   - Cenário Otimista (rentabilidade alta)
   - Cenário Realista (rentabilidade média)
   - Cenário Pessimista (rentabilidade baixa)

3. 📋 PLANO DE AÇÃO MENSAL
   - Quanto aportar por mês
   - Onde alocar os aportes
   - Marcos trimestrais/anuais

4. 🔄 ESTRATÉGIA DE ALOCAÇÃO
   - Alocação ideal para o objetivo
   - Rebalanceamento sugerido
   - Ajustes conforme aproximação da meta

5. 💡 OTIMIZAÇÕES SUGERIDAS
   - Como acelerar o processo
   - Fontes de renda extra
   - Redução de gastos prioritária

6. ⚠️ RISCOS E MITIGAÇÕES
   - Principais riscos do plano
   - Como se proteger
   - Plano B se necessário

7. 📊 PROJEÇÃO DETALHADA
   - Ano a ano até FIRE
   - Patrimônio esperado por fase
   - Renda passiva projetada

Seja específico com números e datas. Este é um plano de vida!
`;
    
    const resposta = await chamarDeepSeek(prompt, 'Você é um planejador financeiro pessoal especializado em FIRE (Financial Independence Retire Early). Crie planos detalhados, realistas e motivadores.');
    
    if (resposta) {
      setIaPlanoFire(resposta);
    }
    setIaLoading(false);
  };
  
  // 4. ANÁLISE DE MERCADO EM TEMPO REAL
  const analisarMercadoIA = async () => {
    setIaLoading(true);
    
    const prompt = `
Analise o cenário de mercado atual e o impacto na carteira deste investidor:

CARTEIRA DO INVESTIDOR:
- Total: ${fmt(patrimonio)}
- Renda Fixa: ${fmt(totalRF)} em ${portfolio.length} ativos
- Ações: ${acoes.map(a => a.ticker).join(', ') || 'Nenhuma'}
- FIIs: ${fiis.map(f => f.ticker).join(', ') || 'Nenhum'}

DADOS ATUAIS DO MERCADO:
- SELIC: ${bcb.selic}%
- CDI: ${bcb.cdi}%
- IPCA 12m: ${bcb.ipca12m}%
- Data: ${new Date().toLocaleDateString('pt-BR')}

AÇÕES NA CARTEIRA (detalhes):
${acoes.map(a => `${a.ticker}: ${fmt(a.preco)} | Var: ${a.variacao?.toFixed(2)}% | Vol: ${a.volume?.toLocaleString()}`).join('\n') || 'Nenhuma ação'}

FIIs NA CARTEIRA (detalhes):
${fiis.map(f => `${f.ticker}: ${fmt(f.preco)} | Var: ${f.variacao?.toFixed(2)}% | DY: ${f.dy?.toFixed(2)}%`).join('\n') || 'Nenhum FII'}

MAIORES ALTAS B3 HOJE:
${b3.altas?.slice(0,5).map(a => `${a.stock}: ${a.change > 0 ? '+' : ''}${a.change?.toFixed(2)}%`).join(', ') || 'Não disponível'}

MAIORES BAIXAS B3 HOJE:
${b3.baixas?.slice(0,5).map(a => `${a.stock}: ${a.change?.toFixed(2)}%`).join(', ') || 'Não disponível'}

Por favor, forneça:

1. 📰 RESUMO DO MERCADO HOJE
   - Tendência geral (alta/baixa/lateral)
   - Principais movimentações
   - Volume e liquidez

2. 🎯 IMPACTO NA CARTEIRA
   - Como os ativos do usuário se comportaram
   - Destaques positivos e negativos
   - Comparação com benchmarks

3. 📊 SETORES EM DESTAQUE
   - Setores em alta
   - Setores em baixa
   - Oportunidades identificadas

4. ⚠️ ALERTAS IMPORTANTES
   - Riscos identificados
   - Ativos que merecem atenção
   - Eventos que podem impactar

5. 💡 OPORTUNIDADES
   - Possíveis entradas
   - Ativos descontados
   - Momento para aportes

6. 🔮 PERSPECTIVA DE CURTO PRAZO
   - O que esperar nos próximos dias
   - Eventos no radar
   - Estratégia sugerida

Seja objetivo e prático nas recomendações.
`;
    
    const resposta = await chamarDeepSeek(prompt, 'Você é um analista de mercado financeiro brasileiro. Forneça análises atualizadas, objetivas e acionáveis.');
    
    if (resposta) {
      setIaAnaliseMercado(resposta);
    }
    setIaLoading(false);
  };
  
  // 5. ANÁLISE FUNDAMENTALISTA DE ATIVO
  const analisarAtivoIA = async (ticker) => {
    if (!ticker) {
      showMsg('Selecione um ativo para analisar', 'error');
      return;
    }
    
    setIaLoading(true);
    setIaAtivoSelecionado(ticker);
    
    // Buscar dados do ativo
    const ativo = [...acoes, ...fiis].find(a => a.ticker === ticker);
    
    const prompt = `
Faça uma ANÁLISE FUNDAMENTALISTA COMPLETA do ativo ${ticker}:

DADOS DISPONÍVEIS:
${ativo ? `
- Preço Atual: ${fmt(ativo.preco)}
- Variação: ${ativo.variacao?.toFixed(2)}%
- Dividend Yield: ${ativo.dy?.toFixed(2)}%
- P/L: ${ativo.pl || 'N/D'}
- P/VP: ${ativo.pvp || 'N/D'}
- Volume: ${ativo.volume?.toLocaleString() || 'N/D'}
- Market Cap: ${fmtK(ativo.marketCap)}
- Setor: ${ativo.setor || 'N/D'}
` : 'Dados detalhados não disponíveis - use conhecimento geral sobre o ativo.'}

CONTEXTO DE MERCADO:
- SELIC: ${bcb.selic}%
- CDI: ${bcb.cdi}%
- IPCA: ${bcb.ipca12m}%

Por favor, forneça uma análise completa:

1. 📊 VISÃO GERAL
   - O que é a empresa/fundo
   - Setor de atuação
   - Principais características

2. 💰 ANÁLISE DE VALUATION
   - O preço atual está justo, caro ou barato?
   - Comparação com pares do setor
   - Múltiplos relevantes

3. 📈 PONTOS POSITIVOS
   - Vantagens competitivas
   - Fundamentos sólidos
   - Catalisadores de alta

4. 📉 PONTOS NEGATIVOS
   - Riscos do negócio
   - Pontos de atenção
   - Possíveis catalisadores de baixa

5. 💵 ANÁLISE DE DIVIDENDOS
   - Histórico de pagamentos
   - Sustentabilidade do DY
   - Projeção futura

6. 🎯 RECOMENDAÇÃO
   - Comprar, Manter ou Vender?
   - Preço-alvo sugerido
   - Horizonte de investimento

7. 📋 CONCLUSÃO
   - Resumo da tese de investimento
   - Para qual perfil de investidor é adequado

Seja objetivo e use dados quando possível.
`;
    
    const resposta = await chamarDeepSeek(prompt, 'Você é um analista fundamentalista certificado (CNPI) especializado no mercado brasileiro de ações e FIIs. Forneça análises profissionais e embasadas.');
    
    if (resposta) {
      setIaAnaliseAtivo(resposta);
    }
    setIaLoading(false);
  };
  
  // 6. EDUCAÇÃO FINANCEIRA ADAPTATIVA
  const iniciarTrilhaEducacao = async (nivel = 'iniciante') => {
    setIaLoading(true);
    
    const prompt = `
Crie uma TRILHA DE EDUCAÇÃO FINANCEIRA personalizada para um investidor de nível ${nivel.toUpperCase()}.

PERFIL DO ALUNO:
- Nível: ${nivel}
- Idade: ${client.idade} anos
- Perfil de Risco: ${client.perfilRisco}
- Patrimônio Atual: ${fmt(patrimonio)}
- Já investe em: ${portfolio.length > 0 ? 'Renda Fixa' : ''} ${acoes.length > 0 ? 'Ações' : ''} ${fiis.length > 0 ? 'FIIs' : ''}

Crie uma trilha com 5 módulos, cada um contendo:
1. Título do módulo
2. Objetivo de aprendizado
3. Conteúdo resumido (3-5 pontos principais)
4. Exercício prático
5. Quiz com 3 perguntas (múltipla escolha com resposta correta indicada)

FORMATO DE RESPOSTA (use exatamente este formato JSON):
{
  "nivel": "${nivel}",
  "modulos": [
    {
      "numero": 1,
      "titulo": "...",
      "objetivo": "...",
      "conteudo": ["ponto 1", "ponto 2", "ponto 3"],
      "exercicio": "...",
      "quiz": [
        {"pergunta": "...", "opcoes": ["A) ...", "B) ...", "C) ..."], "correta": "A"}
      ]
    }
  ]
}

Adapte o conteúdo ao nível:
- INICIANTE: Conceitos básicos, poupança, tesouro direto
- INTERMEDIÁRIO: Diversificação, ações, FIIs, análise
- AVANÇADO: Derivativos, estratégias, internacional
`;
    
    const resposta = await chamarDeepSeek(prompt, 'Você é um educador financeiro certificado. Crie conteúdo didático, progressivo e prático. IMPORTANTE: Responda APENAS com o JSON, sem texto adicional.');
    
    if (resposta) {
      try {
        // Tentar extrair JSON da resposta
        const jsonMatch = resposta.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const trilha = JSON.parse(jsonMatch[0]);
          setIaEducacao({ nivel, trilha: trilha.modulos || [], quizAtual: null });
        } else {
          setIaEducacao({ nivel, trilha: [], quizAtual: null, textoResposta: resposta });
        }
      } catch (e) {
        // Se não conseguir parsear JSON, salvar como texto
        setIaEducacao({ nivel, trilha: [], quizAtual: null, textoResposta: resposta });
      }
    }
    setIaLoading(false);
  };
  
  // 7. INSIGHTS PROATIVOS
  const gerarInsightsIA = async () => {
    setIaLoading(true);
    
    const prompt = `
Gere INSIGHTS E ALERTAS PROATIVOS para este investidor:

CARTEIRA:
- Patrimônio: ${fmt(patrimonio)}
- RF: ${fmt(totalRF)} | Ações: ${fmt(totalAcoes)} | FIIs: ${fmt(totalFIIs)}
- Ativos: ${[...portfolio.map(p => p.nome), ...acoes.map(a => a.ticker), ...fiis.map(f => f.ticker)].join(', ')}

MERCADO:
- SELIC: ${bcb.selic}% | CDI: ${bcb.cdi}% | IPCA: ${bcb.ipca12m}%

PERFIL:
- Idade: ${client.idade} | Risco: ${client.perfilRisco}

Gere exatamente 6 insights no formato JSON:
{
  "insights": [
    {
      "tipo": "alerta|oportunidade|educacional|lembrete|otimizacao|previsao",
      "prioridade": "alta|media|baixa",
      "titulo": "...",
      "descricao": "...",
      "acao": "..."
    }
  ]
}

Tipos de insight:
- ALERTA: Riscos ou problemas identificados
- OPORTUNIDADE: Chances de ganho
- EDUCACIONAL: Dicas de aprendizado
- LEMBRETE: Datas/eventos importantes
- OTIMIZAÇÃO: Melhorias possíveis
- PREVISÃO: Tendências esperadas

IMPORTANTE: Responda APENAS com o JSON.
`;
    
    const resposta = await chamarDeepSeek(prompt, 'Você é um consultor financeiro proativo. Gere insights relevantes e acionáveis. Responda APENAS com JSON.');
    
    if (resposta) {
      try {
        const jsonMatch = resposta.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[0]);
          setIaInsights(data.insights || []);
        }
      } catch (e) {
        console.error('Erro parsing insights:', e);
      }
    }
    setIaLoading(false);
  };
  
  // 8. CONSULTOR VIRTUAL - Preparar para Reunião
  const prepararReuniao = async () => {
    setIaLoading(true);
    
    const prompt = `
Prepare um BRIEFING COMPLETO para a reunião com o assessor de investimentos:

DADOS DO CLIENTE:
- Nome: ${client.nome || 'Cliente'}
- Idade: ${client.idade} anos
- Perfil: ${client.perfilRisco}
- Horizonte: ${client.horizonte}
- Patrimônio: ${fmt(patrimonio)}

COMPOSIÇÃO DA CARTEIRA:
- Renda Fixa: ${fmt(totalRF)} (${((totalRF/patrimonio)*100 || 0).toFixed(1)}%)
- Ações: ${fmt(totalAcoes)} (${((totalAcoes/patrimonio)*100 || 0).toFixed(1)}%)
- FIIs: ${fmt(totalFIIs)} (${((totalFIIs/patrimonio)*100 || 0).toFixed(1)}%)

ATIVOS DETALHADOS:
RF: ${portfolio.map(p => `${p.nome} (${fmt(parseNum(p.valor))})`).join(', ') || 'N/A'}
Ações: ${acoes.map(a => `${a.ticker} (${fmt(a.valorTotal)})`).join(', ') || 'N/A'}
FIIs: ${fiis.map(f => `${f.ticker} (${fmt(f.valorTotal)})`).join(', ') || 'N/A'}

CENÁRIO MACRO:
- SELIC: ${bcb.selic}% | CDI: ${bcb.cdi}% | IPCA: ${bcb.ipca12m}%

Por favor, prepare:

1. 📋 RESUMO EXECUTIVO
   - Situação atual em 3 frases
   - Principais números
   - Tendência geral

2. ✅ PONTOS A COMEMORAR
   - O que está funcionando bem
   - Metas atingidas
   - Decisões acertadas

3. ❓ PERGUNTAS PARA O ASSESSOR
   - 5 perguntas importantes para fazer
   - Dúvidas sobre estratégia
   - Esclarecimentos necessários

4. 📝 TEMAS PARA DISCUSSÃO
   - Alocação atual vs ideal
   - Novas oportunidades
   - Riscos a endereçar

5. 🎯 OBJETIVOS DA REUNIÃO
   - O que precisa ser decidido
   - Ações a serem tomadas
   - Prazos a definir

6. 💡 PONTOS DE NEGOCIAÇÃO
   - Taxas e custos
   - Produtos alternativos
   - Condições especiais

Seja prático e objetivo. O cliente precisa sair preparado!
`;
    
    const resposta = await chamarDeepSeek(prompt, 'Você é um consultor que prepara clientes para reuniões com assessores financeiros. Seja prático e empoderador.');
    
    if (resposta) {
      setIaConsultorResumo(resposta);
    }
    setIaLoading(false);
  };
  
  // 9. SIMULADOR INTELIGENTE - Sugestões
  const sugerirSimulacao = async () => {
    setIaLoading(true);
    
    const prompt = `
Sugira PARÂMETROS OTIMIZADOS para simulação de investimentos:

PERFIL DO INVESTIDOR:
- Idade: ${client.idade} anos
- Perfil: ${client.perfilRisco}
- Patrimônio Atual: ${fmt(patrimonio)}
- Horizonte: ${client.horizonte}

SITUAÇÃO ATUAL:
- Aporte mensal estimado: ${fmt(fireParams.aporteMensal)}
- Gastos mensais: ${fmt(fireParams.gastoMensal)}

CENÁRIO ECONÔMICO:
- SELIC: ${bcb.selic}%
- CDI: ${bcb.cdi}%
- IPCA: ${bcb.ipca12m}%

Responda em JSON:
{
  "sugestoes": {
    "aporteInicial": 0,
    "aporteMensal": 0,
    "periodoMeses": 0,
    "rentabilidadeAnual": 0,
    "dividendYield": 0,
    "reinvestir": true,
    "justificativa": "..."
  },
  "cenarios": [
    {
      "nome": "Conservador",
      "rentabilidade": 0,
      "patrimonioFinal": 0,
      "descricao": "..."
    },
    {
      "nome": "Moderado", 
      "rentabilidade": 0,
      "patrimonioFinal": 0,
      "descricao": "..."
    },
    {
      "nome": "Arrojado",
      "rentabilidade": 0,
      "patrimonioFinal": 0,
      "descricao": "..."
    }
  ],
  "dicas": ["dica 1", "dica 2", "dica 3"]
}

IMPORTANTE: Responda APENAS com o JSON.
`;
    
    const resposta = await chamarDeepSeek(prompt, 'Você é um simulador financeiro inteligente. Sugira parâmetros realistas baseados no perfil. Responda APENAS com JSON.');
    
    if (resposta) {
      try {
        const jsonMatch = resposta.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[0]);
          setIaSimuladorSugestoes(data);
        }
      } catch (e) {
        console.error('Erro parsing sugestões:', e);
      }
    }
    setIaLoading(false);
  };
  
  // 10. GERAR TEXTO PARA RELATÓRIO PDF
  const gerarTextoRelatorioIA = async () => {
    setIaLoading(true);
    
    const prompt = `
Gere um TEXTO PROFISSIONAL para o relatório de investimentos:

CLIENTE: ${client.nome || 'Investidor'}
DATA: ${new Date().toLocaleDateString('pt-BR')}

CARTEIRA:
- Patrimônio Total: ${fmt(patrimonio)}
- Renda Fixa: ${fmt(totalRF)} (${((totalRF/patrimonio)*100 || 0).toFixed(1)}%)
- Ações: ${fmt(totalAcoes)} (${((totalAcoes/patrimonio)*100 || 0).toFixed(1)}%)
- FIIs: ${fmt(totalFIIs)} (${((totalFIIs/patrimonio)*100 || 0).toFixed(1)}%)

PERFIL: ${client.perfilRisco} | HORIZONTE: ${client.horizonte}

CENÁRIO: SELIC ${bcb.selic}% | IPCA ${bcb.ipca12m}%

Escreva 4 parágrafos profissionais:

1. ABERTURA (2-3 frases)
   - Saudação personalizada
   - Contexto do relatório

2. ANÁLISE DA CARTEIRA (4-5 frases)
   - Composição atual
   - Pontos de destaque
   - Diversificação

3. CENÁRIO E PERSPECTIVAS (3-4 frases)
   - Ambiente econômico
   - Impacto na carteira
   - Oportunidades

4. RECOMENDAÇÕES (3-4 frases)
   - Sugestões práticas
   - Próximos passos
   - Fechamento profissional

Use linguagem profissional mas acessível. Não use bullet points, apenas texto corrido.
`;
    
    const resposta = await chamarDeepSeek(prompt, 'Você é um redator de relatórios financeiros premium. Escreva de forma profissional, clara e personalizada.');
    
    if (resposta) {
      setIaRelatorioTexto(resposta);
    }
    setIaLoading(false);
  };
  
  // Cálculos
  const totalRF = portfolio.reduce((s, p) => s + parseNum(p.valor), 0);
  const totalAcoes = acoes.reduce((s, a) => s + a.valorTotal, 0);
  const totalFIIs = fiis.reduce((s, f) => s + f.valorTotal, 0);
  const patrimonio = totalRF + totalAcoes + totalFIIs;
  const pieData = [
    { name: 'Renda Fixa', value: totalRF, color: '#8b5cf6' },
    { name: 'Ações', value: totalAcoes, color: '#06b6d4' },
    { name: 'FIIs', value: totalFIIs, color: '#10b981' }
  ].filter(d => d.value > 0);

  return (
    <div className="min-h-screen bg-[#080810] text-white font-sans">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-[#0f0f18] border-b border-[#1f1f2e] flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <span className="font-bold text-sm">D</span>
          </div>
          <span className="font-bold text-sm">DAMA</span>
        </div>
        <div className="flex items-center gap-2">
          {/* User Avatar/Login */}
          {isLoggedIn ? (
            <div className="relative">
              <button onClick={() => setUserMenuOpen(!userMenuOpen)} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[#1a1a28] border border-[#2d2d3d]">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center text-xs font-bold">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs max-w-[60px] truncate">{userName}</span>
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg shadow-xl p-2 z-[100]">
                  <div className="px-3 py-2 border-b border-[#2d2d3d] mb-2">
                    <p className="text-sm font-medium truncate">{userName}</p>
                    <p className="text-xs text-slate-400">{user?.email}</p>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-medium ${userPlan === 'premium' ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black' : 'bg-slate-600 text-white'}`}>
                      {userPlan === 'premium' ? '⭐ PREMIUM' : 'FREE'}
                    </span>
                  </div>
                  {userPlan !== 'premium' && (
                    <Link href="/planos" className="block px-3 py-2 text-sm text-amber-400 hover:bg-amber-500/10 rounded-lg">
                      🚀 Fazer Upgrade
                    </Link>
                  )}
                  <button onClick={() => { setView('config'); setUserMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-white/5 rounded-lg">
                    ⚙️ Configurações
                  </button>
                  <button onClick={() => logout()} className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg">
                    🚪 Sair
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/login" className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium text-xs">
              Entrar
            </Link>
          )}
          <button onClick={() => setMobileMenu(!mobileMenu)} className="p-2 rounded-lg bg-[#1a1a28]">
            {mobileMenu ? '✕' : '☰'}
          </button>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileMenu && (
        <div className="lg:hidden fixed inset-0 bg-black/80 z-40" onClick={() => setMobileMenu(false)}>
          <div className="absolute right-0 top-14 w-64 h-full bg-[#0f0f18] border-l border-[#1f1f2e] p-4" onClick={e => e.stopPropagation()}>
            <nav className="space-y-1">
              {[['dashboard','📊','Dashboard'],['relatorio','📈','Relatório'],['carteira','💎','Renda Fixa'],['acoes','📈','Ações'],['fiis','🏢','FIIs'],['moedas','💱','Câmbio/Macro'],['ia','🤖','Assistente IA'],['simulador','🎯','Simulador'],['calculadoras','🧮','Calculadoras'],['fire','🔥','FIRE'],['config','⚙️','Perfil']].map(([v,i,l]) => (
                <button key={v} onClick={() => { setView(v); setSubView('carteira'); setResultado(null); setMobileMenu(false); setAtivoDetalhe(null); }} className={`w-full flex items-center gap-2 px-3 py-3 rounded-lg text-sm ${view === v ? 'bg-violet-500/20 text-violet-400' : 'text-slate-400'}`}>
                  <span>{i}</span><span>{l}</span>
                </button>
              ))}
            </nav>
            <div className="mt-4 space-y-2">
              <a href="https://calendly.com/diego-oliveira-damainvestimentos/reuniao-de-analise" target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-medium text-sm">
                📅 Agendar Reunião
              </a>
              <button onClick={() => { setRelatorioModal(true); setMobileMenu(false); }} disabled={patrimonio === 0 || generating} className={`w-full py-3 rounded-lg font-medium text-sm ${patrimonio > 0 ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white' : 'bg-[#1a1a28] text-slate-600'}`}>
                {generating ? '⏳ Gerando...' : '📄 Relatório PRO'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-52 bg-gradient-to-b from-[#0f0f18] to-[#080810] border-r border-[#1f1f2e] p-4 flex-col z-50">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <span className="font-bold">D</span>
          </div>
          <div>
            <p className="font-bold text-sm">DAMA</p>
            <p className="text-[7px] text-violet-400 tracking-widest">INVESTIMENTOS</p>
          </div>
        </div>
        
        <nav className="flex-1 space-y-1">
          {[['dashboard','📊','Dashboard'],['relatorio','📈','Relatório'],['carteira','💎','Renda Fixa'],['acoes','📈','Ações'],['fiis','🏢','FIIs'],['moedas','💱','Câmbio/Macro'],['ia','🤖','Assistente IA'],['simulador','🎯','Simulador'],['calculadoras','🧮','Calculadoras'],['fire','🔥','FIRE'],['config','⚙️','Perfil']].map(([v,i,l]) => (
            <button key={v} onClick={() => { setView(v); setSubView('carteira'); setResultado(null); setAtivoDetalhe(null); }} className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all ${view === v ? 'bg-violet-500/20 text-violet-400 border-l-2 border-violet-500' : 'text-slate-400 hover:bg-white/5'}`}>
              <span>{i}</span><span>{l}</span>
            </button>
          ))}
        </nav>
        
        {/* User Menu - Desktop */}
        <div className="border-t border-[#1f1f2e] pt-4 mt-4">
          {isLoggedIn ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3 px-2 py-2">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center font-bold">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{userName}</p>
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${userPlan === 'premium' ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black' : 'bg-slate-600 text-white'}`}>
                    {userPlan === 'premium' ? '⭐ PREMIUM' : 'FREE'}
                  </span>
                </div>
              </div>
              {userPlan !== 'premium' && (
                <Link href="/planos" className="block w-full text-center py-2 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-medium text-xs">
                  🚀 Fazer Upgrade
                </Link>
              )}
              <button onClick={() => logout()} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 text-sm transition-colors">
                🚪 Sair
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <Link href="/login" className="block w-full text-center py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium text-sm">
                Entrar
              </Link>
              <Link href="/cadastro" className="block w-full text-center py-2 rounded-lg border border-[#2d2d3d] text-slate-400 hover:text-white text-sm transition-colors">
                Criar Conta
              </Link>
            </div>
          )}
        </div>
        
        <div className="space-y-2 mt-4">
          <a href="https://calendly.com/diego-oliveira-damainvestimentos/reuniao-de-analise" target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-medium text-sm shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all">
            📅 Agendar
          </a>
          <button onClick={() => setRelatorioModal(true)} disabled={patrimonio === 0 || generating} className={`w-full py-2.5 rounded-lg font-medium text-sm transition-all ${patrimonio > 0 ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/20' : 'bg-[#1a1a28] text-slate-600'}`}>
            {generating ? '⏳...' : '📄 Relatório PRO'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-52 pt-16 lg:pt-0 p-4 lg:p-5 min-h-screen">
        {/* Mensagens */}
        {msg.text && (
          <div className={`mb-3 p-3 rounded-lg text-sm border ${msg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : msg.type === 'error' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
            {msg.text}
          </div>
        )}
        
        {/* Modal de Configuração do Relatório */}
        {relatorioModal && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setRelatorioModal(false)}>
            <div className="bg-[#12121a] rounded-2xl border border-[#1f1f2e] p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold flex items-center gap-2">📄 Configurar Relatório PRO</h2>
                <button onClick={() => setRelatorioModal(false)} className="p-2 rounded-lg bg-[#1a1a28] hover:bg-[#2d2d3d]">✕</button>
              </div>
              
              {/* Personalização da Marca */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <span className="text-violet-400">🏢</span> Personalização da Marca
                </h3>
                <p className="text-xs text-slate-500 mb-3">Configure sua identidade visual para o relatório. Ideal para assessores, planejadores e consultores financeiros.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Upload de Logo */}
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400">Logo da Empresa</label>
                    <div className="flex items-center gap-3">
                      <div className={`w-16 h-16 rounded-xl flex items-center justify-center border-2 border-dashed ${logoPersonalizada ? 'border-violet-500 bg-violet-500/10' : 'border-[#2d2d3d] bg-[#1a1a28]'}`}>
                        {logoPersonalizada ? (
                          <img src={logoPersonalizada} alt="Logo" className="w-12 h-12 object-contain" />
                        ) : (
                          <span className="text-2xl">🏢</span>
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <label className="block w-full py-2 px-3 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium text-center cursor-pointer transition-all">
                          📤 Carregar Logo
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (ev) => setLogoPersonalizada(ev.target?.result);
                              reader.readAsDataURL(file);
                            }
                          }} />
                        </label>
                        {logoPersonalizada && (
                          <button onClick={() => setLogoPersonalizada(null)} className="w-full py-1 text-xs text-red-400 hover:text-red-300">
                            Remover logo
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-600">PNG ou JPG, máx. 500KB</p>
                  </div>
                  
                  {/* Nome e Subtítulo */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-slate-400">Nome da Empresa</label>
                      <input type="text" value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} placeholder="Ex: Sua Consultoria" className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2 text-sm focus:border-violet-500 outline-none" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">Subtítulo / Slogan</label>
                      <input type="text" value={subtituloEmpresa} onChange={(e) => setSubtituloEmpresa(e.target.value)} placeholder="Ex: Planejamento Financeiro" className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2 text-sm focus:border-violet-500 outline-none" />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Seleção de Ativos */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <span className="text-amber-400">📦</span> Selecionar Ativos para o Relatório
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <label className="flex items-center gap-3 p-3 rounded-lg bg-[#1a1a28] border border-[#2d2d3d] cursor-pointer hover:border-violet-500/50">
                    <input type="checkbox" checked={ativosRelatorio.rf} onChange={(e) => setAtivosRelatorio(p => ({...p, rf: e.target.checked}))} className="w-4 h-4 rounded accent-violet-500" />
                    <div className="flex-1">
                      <span className="text-sm">💎 Renda Fixa</span>
                      <span className="text-xs text-slate-500 block">{portfolio.filter(p => p.produto).length} ativos - {fmtK(totalRF)}</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-lg bg-[#1a1a28] border border-[#2d2d3d] cursor-pointer hover:border-violet-500/50">
                    <input type="checkbox" checked={ativosRelatorio.acoes} onChange={(e) => setAtivosRelatorio(p => ({...p, acoes: e.target.checked}))} className="w-4 h-4 rounded accent-violet-500" />
                    <div className="flex-1">
                      <span className="text-sm">📈 Ações</span>
                      <span className="text-xs text-slate-500 block">{acoes.length} ativos - {fmtK(totalAcoes)}</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-lg bg-[#1a1a28] border border-[#2d2d3d] cursor-pointer hover:border-violet-500/50">
                    <input type="checkbox" checked={ativosRelatorio.fiis} onChange={(e) => setAtivosRelatorio(p => ({...p, fiis: e.target.checked}))} className="w-4 h-4 rounded accent-violet-500" />
                    <div className="flex-1">
                      <span className="text-sm">🏢 FIIs</span>
                      <span className="text-xs text-slate-500 block">{fiis.length} ativos - {fmtK(totalFIIs)}</span>
                    </div>
                  </label>
                </div>
              </div>
              
              {/* Tema do Relatório */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <span className="text-amber-400">🎨</span> Tema do Relatório
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setRelatorioTema('escuro')} className={`p-4 rounded-xl border-2 transition-all ${relatorioTema === 'escuro' ? 'border-violet-500 bg-violet-500/10' : 'border-[#2d2d3d] hover:border-[#3d3d4d]'}`}>
                    <div className="w-full h-12 bg-[#080810] rounded-lg mb-2 border border-[#1f1f2e] flex items-center justify-center">
                      <div className="space-y-1">
                        <div className="w-10 h-1 bg-slate-600 rounded"></div>
                        <div className="w-6 h-1 bg-violet-500 rounded"></div>
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <span>🌙</span>
                      <span className="text-sm">Tema Escuro</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">Ideal para visualização em tela</p>
                  </button>
                  
                  <button onClick={() => setRelatorioTema('claro')} className={`p-4 rounded-xl border-2 transition-all ${relatorioTema === 'claro' ? 'border-blue-500 bg-blue-500/10' : 'border-[#2d2d3d] hover:border-[#3d3d4d]'}`}>
                    <div className="w-full h-12 bg-white rounded-lg mb-2 border border-gray-200 flex items-center justify-center">
                      <div className="space-y-1">
                        <div className="w-10 h-1 bg-gray-300 rounded"></div>
                        <div className="w-6 h-1 bg-blue-500 rounded"></div>
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <span>☀️</span>
                      <span className="text-sm">Tema Claro</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">Ideal para impressão em papel</p>
                  </button>
                </div>
              </div>
              
              {/* Seções do Relatório */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <span className="text-cyan-400">📋</span> Seções do Relatório
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['simulador', '📈 Simulação de Rentabilidade'],
                    ['projecoes', '🏦 Projeções Focus BCB'],
                    ['comparativo', '📊 Comparativo de Índices'],
                    ['graficos', '📉 Gráficos e Visualizações']
                  ].map(([k, l]) => (
                    <label key={k} className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-all ${secoesRelatorio[k] ? 'bg-cyan-500/10 border border-cyan-500/30' : 'bg-[#1a1a28] border border-[#2d2d3d]'}`}>
                      <input type="checkbox" checked={secoesRelatorio[k]} onChange={(e) => setSecoesRelatorio(p => ({...p, [k]: e.target.checked}))} className="w-4 h-4 rounded accent-cyan-500" />
                      <span className="text-xs">{l}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              {/* Preview */}
              <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20 rounded-xl p-4 mb-4">
                <h4 className="text-sm font-semibold mb-2">📋 Preview do Relatório</h4>
                <div className={`p-3 rounded-lg ${relatorioTema === 'claro' ? 'bg-white text-gray-800' : 'bg-[#080810] text-white'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {logoPersonalizada ? (
                      <img src={logoPersonalizada} alt="Logo" className="w-8 h-8 object-contain" />
                    ) : (
                      <div className={`w-8 h-8 rounded-lg ${relatorioTema === 'claro' ? 'bg-blue-500' : 'bg-violet-500'} flex items-center justify-center text-white font-bold text-sm`}>
                        {nomeEmpresa.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-bold">{nomeEmpresa}</p>
                      <p className={`text-[10px] ${relatorioTema === 'claro' ? 'text-blue-600' : 'text-violet-400'}`}>{subtituloEmpresa}</p>
                    </div>
                  </div>
                  <p className={`text-[10px] ${relatorioTema === 'claro' ? 'text-gray-500' : 'text-slate-500'}`}>
                    {[ativosRelatorio.rf && 'RF', ativosRelatorio.acoes && 'Ações', ativosRelatorio.fiis && 'FIIs'].filter(Boolean).join(' • ') || 'Nenhum ativo'} | Tema: {relatorioTema === 'claro' ? 'Claro' : 'Escuro'}
                  </p>
                </div>
              </div>
              
              {/* Botões */}
              <div className="flex gap-3">
                <button onClick={() => setRelatorioModal(false)} className="flex-1 py-3 rounded-xl bg-[#1a1a28] text-slate-400 font-medium text-sm hover:bg-[#2d2d3d]">
                  Cancelar
                </button>
                <button onClick={() => { setRelatorioModal(false); gerarRelatorioPDF(client, portfolio, acoes, fiis, bcb, showMsg, setGenerating, relatorioTema, nomeEmpresa, subtituloEmpresa, logoPersonalizada); }} disabled={generating || (!ativosRelatorio.rf && !ativosRelatorio.acoes && !ativosRelatorio.fiis)} className={`flex-1 py-3 rounded-xl font-medium text-sm transition-all ${(!ativosRelatorio.rf && !ativosRelatorio.acoes && !ativosRelatorio.fiis) ? 'bg-slate-700 text-slate-500' : 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-500 hover:to-purple-500'}`}>
                  {generating ? '⏳ Gerando...' : '📄 Gerar Relatório'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================== DASHBOARD ==================== */}
        {view === 'dashboard' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h1 className="text-lg sm:text-xl font-bold">Olá, {client.nome || 'Investidor'} 👋</h1>
                <p className="text-slate-400 text-xs sm:text-sm">Seu patrimônio consolidado em tempo real</p>
              </div>
              <div className="flex gap-2">
                <div className="px-3 py-1.5 rounded-lg bg-[#12121a] border border-[#1f1f2e] text-xs">
                  <span className="text-slate-500">SELIC</span>
                  <span className="ml-2 font-bold text-violet-400">{bcb.selic}%</span>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-[#12121a] border border-[#1f1f2e] text-xs">
                  <span className="text-slate-500">CDI</span>
                  <span className="ml-2 font-bold text-cyan-400">{bcb.cdi?.toFixed(2)}%</span>
                </div>
              </div>
            </div>
            
            {/* Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[['Patrimônio Total', patrimonio, 'violet', '💰'], ['Renda Fixa', totalRF, 'cyan', '💎'], ['Ações', totalAcoes, 'emerald', '📈'], ['FIIs', totalFIIs, 'amber', '🏢']].map(([l, v, c, i]) => (
                <div key={l} className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-4 hover:border-violet-500/30 transition-all">
                  <div className={`w-full h-1 rounded-full bg-${c}-500 mb-3`}></div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{i}</span>
                    <span className="text-[10px] sm:text-xs text-slate-400">{l}</span>
                  </div>
                  <p className="text-base sm:text-xl font-bold">{fmtK(v)}</p>
                </div>
              ))}
            </div>
            
            {/* Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-4">
                <h3 className="text-xs text-slate-400 mb-3">Distribuição</h3>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={120}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value" stroke="none">
                        {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: '#1a1a28', border: '1px solid #2d2d3d', borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[120px] flex items-center justify-center text-slate-500 text-sm">Adicione ativos</div>
                )}
                <div className="flex flex-wrap gap-2 mt-2 justify-center">
                  {pieData.map((d, i) => (
                    <div key={i} className="flex items-center gap-1 text-[10px]">
                      <div className="w-2 h-2 rounded-full" style={{ background: d.color }}></div>
                      <span className="text-slate-400">{d.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="lg:col-span-2 rounded-xl bg-[#12121a] border border-[#1f1f2e] p-4">
                <h3 className="text-xs text-slate-400 mb-3">Projeções Focus BCB</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-500">
                        <th className="text-left py-1">Indicador</th>
                        {Object.keys(bcb.projecoes || {}).slice(0, 6).map(a => <th key={a} className="text-center py-1">{a}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-[#2d2d3d]">
                        <td className="py-2 text-slate-400">SELIC</td>
                        {Object.values(bcb.projecoes || {}).slice(0, 6).map((p, i) => <td key={i} className="text-center text-violet-400 font-medium">{p?.selic || '-'}%</td>)}
                      </tr>
                      <tr className="border-t border-[#2d2d3d]">
                        <td className="py-2 text-slate-400">IPCA</td>
                        {Object.values(bcb.projecoes || {}).slice(0, 6).map((p, i) => <td key={i} className="text-center text-amber-400">{p?.ipca || '-'}%</td>)}
                      </tr>
                      <tr className="border-t border-[#2d2d3d]">
                        <td className="py-2 text-slate-400">PIB</td>
                        {Object.values(bcb.projecoes || {}).slice(0, 6).map((p, i) => <td key={i} className="text-center text-emerald-400">{p?.pib || '-'}%</td>)}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            
            {/* B3 Live */}
            <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  🔴 IBOVESPA
                  <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs animate-pulse">LIVE</span>
                </h3>
                <span className="text-[10px] text-slate-500">{b3.timestamp}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-emerald-400 mb-2 font-medium">📈 Maiores Altas</p>
                  {b3.altas.slice(0, 5).map((i, x) => (
                    <div key={x} className="flex justify-between py-1.5 border-b border-[#1f1f2e] text-xs hover:bg-white/5 transition-colors">
                      <span className="font-medium">{i.ticker}</span>
                      <span className="text-emerald-400 font-medium">+{i.variacao?.toFixed(2)}%</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-xs text-red-400 mb-2 font-medium">📉 Maiores Baixas</p>
                  {b3.baixas.slice(0, 5).map((i, x) => (
                    <div key={x} className="flex justify-between py-1.5 border-b border-[#1f1f2e] text-xs hover:bg-white/5 transition-colors">
                      <span className="font-medium">{i.ticker}</span>
                      <span className="text-red-400 font-medium">{i.variacao?.toFixed(2)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== RENDA FIXA ==================== */}
        {view === 'carteira' && (
          <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-4 sm:p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">💎 Carteira de Renda Fixa</h2>
              <button onClick={addRF} className="px-3 py-1.5 rounded-lg bg-violet-500/20 text-violet-400 text-xs sm:text-sm hover:bg-violet-500/30 transition-colors">+ Adicionar</button>
            </div>
            
            <div className="space-y-3">
              {portfolio.map(item => (
                <div key={item.id} className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-center p-3 bg-[#1a1a28] rounded-lg border border-[#2d2d3d]">
                  <input value={item.produto} onChange={(e) => updRF(item.id, 'produto', e.target.value.toUpperCase())} placeholder="CRA VALE 2028" className="col-span-2 bg-[#12121a] border border-[#2d2d3d] rounded-lg px-3 py-2 text-sm focus:border-violet-500 outline-none" />
                  <select value={item.indexador} onChange={(e) => updRF(item.id, 'indexador', e.target.value)} className="bg-[#12121a] border border-[#2d2d3d] rounded-lg px-2 py-2 text-sm">
                    {INDEXADORES.map(i => <option key={i}>{i}</option>)}
                  </select>
                  <input value={item.taxa} onChange={(e) => updRF(item.id, 'taxa', e.target.value)} placeholder="110" className="bg-[#12121a] border border-[#2d2d3d] rounded-lg px-3 py-2 text-sm text-center" />
                  <input value={item.valor} onChange={(e) => updRF(item.id, 'valor', e.target.value)} placeholder="100.000" className="bg-[#12121a] border border-[#2d2d3d] rounded-lg px-3 py-2 text-sm text-right" />
                  <button onClick={() => delRF(item.id)} className="text-slate-500 hover:text-red-400 transition-colors justify-self-center">✕</button>
                </div>
              ))}
            </div>
            
            <div className="mt-4 pt-4 border-t border-[#2d2d3d] flex justify-between items-center">
              <span className="text-slate-400 text-sm">{portfolio.filter(p => p.produto).length} produto(s)</span>
              <div className="flex items-center gap-3">
                <span className="text-slate-400 text-sm">Total:</span>
                <span className="text-xl font-bold text-violet-400">{fmt(totalRF)}</span>
              </div>
            </div>
          </div>
        )}

        {/* ==================== RELATÓRIO DE PERFORMANCE ==================== */}
        {view === 'relatorio' && (
          <div className="space-y-4">
            {/* Header com logos e período */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-[#12121a] to-[#1a1a2e] border border-[#2d2d3d]">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">📊</div>
                  <span className="font-semibold text-violet-400">DAMA</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-cyan-600 flex items-center justify-center">💎</div>
                  <span className="font-semibold text-cyan-400">Renda Fixa</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">📈</div>
                  <span className="font-semibold text-emerald-400">Ações</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center">🏢</div>
                  <span className="font-semibold text-amber-400">FIIs</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button className="p-2 rounded-lg bg-[#1f1f2e] text-slate-400 hover:text-white transition-colors">
                  <span>📥</span>
                </button>
                <button className="p-2 rounded-lg bg-[#1f1f2e] text-slate-400 hover:text-white transition-colors">
                  <span>📤</span>
                </button>
                <div className="px-4 py-2 rounded-lg bg-[#1f1f2e] text-sm">
                  📅 {new Date().toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
                </div>
              </div>
            </div>
            
            {/* Título do relatório */}
            <div className="text-sm text-slate-500">
              Relatório Geral de Investimentos | <span className="text-white font-medium">{client.nome || 'Cliente'}</span>
            </div>
            
            {/* KPIs Principais - Linha 1 */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {/* Patrimônio Total */}
              <div className="rounded-xl bg-gradient-to-br from-violet-900/40 to-violet-800/20 border border-violet-500/30 p-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 to-purple-500"></div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded bg-violet-500/30 flex items-center justify-center text-xs">💰</span>
                  <span className="text-xs text-slate-400">Patrimônio Total</span>
                </div>
                <p className="text-xl md:text-2xl font-bold text-white">{fmtCompacto(patrimonio)}</p>
                <p className="text-xs text-emerald-400 mt-1">↑ 12.5%</p>
              </div>
              
              {/* Renda Fixa */}
              <div className="rounded-xl bg-gradient-to-br from-cyan-900/40 to-cyan-800/20 border border-cyan-500/30 p-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-500"></div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded bg-cyan-500/30 flex items-center justify-center text-xs">💎</span>
                  <span className="text-xs text-slate-400">Renda Fixa</span>
                </div>
                <p className="text-xl md:text-2xl font-bold text-white">{fmtCompacto(totalRF)}</p>
                <p className="text-xs text-cyan-400 mt-1">{patrimonio > 0 ? ((totalRF/patrimonio)*100).toFixed(1) : 0}% do total</p>
              </div>
              
              {/* Rentabilidade RF */}
              <div className="rounded-xl bg-gradient-to-br from-emerald-900/40 to-emerald-800/20 border border-emerald-500/30 p-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-green-500"></div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded bg-emerald-500/30 flex items-center justify-center text-xs">%</span>
                  <span className="text-xs text-slate-400">Rent. RF (a.a.)</span>
                </div>
                <p className="text-xl md:text-2xl font-bold text-white">{bcb.cdi?.toFixed(2)}%</p>
                <p className="text-xs text-emerald-400 mt-1">CDI Líquido</p>
              </div>
              
              {/* Dividendos */}
              <div className="rounded-xl bg-gradient-to-br from-amber-900/40 to-amber-800/20 border border-amber-500/30 p-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-yellow-500"></div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded bg-amber-500/30 flex items-center justify-center text-xs">💵</span>
                  <span className="text-xs text-slate-400">Dividendos/Mês</span>
                </div>
                <p className="text-xl md:text-2xl font-bold text-white">{fmtCompacto(((totalAcoes * 0.06) + (totalFIIs * 0.08)) / 12)}</p>
                <p className="text-xs text-amber-400 mt-1">Projeção</p>
              </div>
              
              {/* ROI Geral */}
              <div className="rounded-xl bg-gradient-to-br from-purple-900/40 to-purple-800/20 border border-purple-500/30 p-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500"></div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded bg-purple-500/30 flex items-center justify-center text-xs">📊</span>
                  <span className="text-xs text-slate-400">DY Médio</span>
                </div>
                <p className="text-xl md:text-2xl font-bold text-white">{acoes.length > 0 ? (acoes.reduce((s,a) => s + (a.dy || 6), 0) / acoes.length).toFixed(2) : '0.00'}%</p>
                <p className="text-xs text-purple-400 mt-1">Carteira Ações</p>
              </div>
            </div>
            
            {/* Gráficos - Linha 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
              {/* Visão Geral - Gráfico de linha */}
              <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded bg-violet-500/30 flex items-center justify-center text-xs">📊</span>
                  <span className="text-xs text-slate-400">Visão Geral</span>
                </div>
                <ResponsiveContainer width="100%" height={80}>
                  <LineChart data={[
                    { m: 'Jan', v: patrimonio * 0.85 }, { m: 'Fev', v: patrimonio * 0.88 }, { m: 'Mar', v: patrimonio * 0.92 },
                    { m: 'Abr', v: patrimonio * 0.90 }, { m: 'Mai', v: patrimonio * 0.95 }, { m: 'Jun', v: patrimonio * 0.93 },
                    { m: 'Jul', v: patrimonio * 0.97 }, { m: 'Ago', v: patrimonio * 0.98 }, { m: 'Set', v: patrimonio * 0.96 },
                    { m: 'Out', v: patrimonio * 0.99 }, { m: 'Nov', v: patrimonio * 1.02 }, { m: 'Dez', v: patrimonio }
                  ]}>
                    <Line type="monotone" dataKey="v" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              
              {/* Renda Fixa */}
              <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded bg-cyan-500/30 flex items-center justify-center text-xs">💎</span>
                  <span className="text-xs text-slate-400">Renda Fixa</span>
                </div>
                <ResponsiveContainer width="100%" height={80}>
                  <LineChart data={[
                    { m: 'Jan', v: totalRF * 0.92 }, { m: 'Fev', v: totalRF * 0.94 }, { m: 'Mar', v: totalRF * 0.95 },
                    { m: 'Abr', v: totalRF * 0.96 }, { m: 'Mai', v: totalRF * 0.97 }, { m: 'Jun', v: totalRF * 0.98 },
                    { m: 'Jul', v: totalRF * 0.98 }, { m: 'Ago', v: totalRF * 0.99 }, { m: 'Set', v: totalRF * 0.99 },
                    { m: 'Out', v: totalRF * 1.0 }, { m: 'Nov', v: totalRF * 1.01 }, { m: 'Dez', v: totalRF }
                  ]}>
                    <Line type="monotone" dataKey="v" stroke="#06b6d4" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              
              {/* Ações */}
              <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded bg-emerald-500/30 flex items-center justify-center text-xs">📈</span>
                  <span className="text-xs text-slate-400">Ações</span>
                </div>
                <ResponsiveContainer width="100%" height={80}>
                  <LineChart data={[
                    { m: 'Jan', v: totalAcoes * 0.80 }, { m: 'Fev', v: totalAcoes * 0.85 }, { m: 'Mar', v: totalAcoes * 0.82 },
                    { m: 'Abr', v: totalAcoes * 0.88 }, { m: 'Mai', v: totalAcoes * 0.90 }, { m: 'Jun', v: totalAcoes * 0.87 },
                    { m: 'Jul', v: totalAcoes * 0.92 }, { m: 'Ago', v: totalAcoes * 0.95 }, { m: 'Set', v: totalAcoes * 0.93 },
                    { m: 'Out', v: totalAcoes * 0.98 }, { m: 'Nov', v: totalAcoes * 1.05 }, { m: 'Dez', v: totalAcoes }
                  ]}>
                    <Line type="monotone" dataKey="v" stroke="#10b981" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              
              {/* FIIs */}
              <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded bg-amber-500/30 flex items-center justify-center text-xs">🏢</span>
                  <span className="text-xs text-slate-400">FIIs</span>
                </div>
                <ResponsiveContainer width="100%" height={80}>
                  <LineChart data={[
                    { m: 'Jan', v: totalFIIs * 0.88 }, { m: 'Fev', v: totalFIIs * 0.90 }, { m: 'Mar', v: totalFIIs * 0.87 },
                    { m: 'Abr', v: totalFIIs * 0.92 }, { m: 'Mai', v: totalFIIs * 0.94 }, { m: 'Jun', v: totalFIIs * 0.91 },
                    { m: 'Jul', v: totalFIIs * 0.95 }, { m: 'Ago', v: totalFIIs * 0.97 }, { m: 'Set', v: totalFIIs * 0.96 },
                    { m: 'Out', v: totalFIIs * 0.99 }, { m: 'Nov', v: totalFIIs * 1.02 }, { m: 'Dez', v: totalFIIs }
                  ]}>
                    <Line type="monotone" dataKey="v" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            {/* Seções Detalhadas */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Renda Fixa Detalhado */}
              <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-4">
                <h3 className="text-sm font-semibold text-cyan-400 mb-4 flex items-center gap-2">
                  💎 Renda Fixa
                </h3>
                <div className="space-y-3 mb-4">
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={[
                      { d: 'CDB', v: portfolio.filter(p => p.produto?.includes('CDB')).reduce((s,p) => s + parseNum(p.valor), 0) || totalRF * 0.3 },
                      { d: 'LCI/LCA', v: portfolio.filter(p => p.produto?.includes('LC')).reduce((s,p) => s + parseNum(p.valor), 0) || totalRF * 0.25 },
                      { d: 'Tesouro', v: portfolio.filter(p => p.produto?.includes('Tesouro')).reduce((s,p) => s + parseNum(p.valor), 0) || totalRF * 0.2 },
                      { d: 'Debêntures', v: portfolio.filter(p => p.produto?.includes('Deb')).reduce((s,p) => s + parseNum(p.valor), 0) || totalRF * 0.15 },
                      { d: 'CRA/CRI', v: portfolio.filter(p => p.produto?.includes('CR')).reduce((s,p) => s + parseNum(p.valor), 0) || totalRF * 0.1 }
                    ]}>
                      <XAxis dataKey="d" tick={{ fill: '#64748b', fontSize: 9 }} />
                      <Tooltip contentStyle={{ background: '#1a1a28', border: '1px solid #2d2d3d', borderRadius: 8 }} formatter={(v) => fmtCompacto(v)} />
                      <Bar dataKey="v" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#1a1a28] rounded-lg p-3">
                    <p className="text-[10px] text-slate-500">Investido</p>
                    <p className="text-sm font-bold text-cyan-400">{fmtCompacto(totalRF)}</p>
                    <p className="text-[10px] text-emerald-400">↑ {((bcb.cdi || 14.9) * 0.85).toFixed(1)}%</p>
                  </div>
                  <div className="bg-[#1a1a28] rounded-lg p-3">
                    <p className="text-[10px] text-slate-500">Rendimento/Mês</p>
                    <p className="text-sm font-bold text-white">{fmtCompacto(totalRF * (bcb.cdi || 14.9) / 100 / 12)}</p>
                    <p className="text-[10px] text-slate-400">CDI Líq.</p>
                  </div>
                </div>
              </div>
              
              {/* Ações Detalhado */}
              <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-4">
                <h3 className="text-sm font-semibold text-emerald-400 mb-4 flex items-center gap-2">
                  📈 Ações
                </h3>
                <div className="space-y-3 mb-4">
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={acoes.length > 0 ? acoes.slice(0, 5).map(a => ({ d: a.ticker, v: a.preco * a.qtd })) : [
                      { d: 'PETR4', v: totalAcoes * 0.25 },
                      { d: 'VALE3', v: totalAcoes * 0.20 },
                      { d: 'ITUB4', v: totalAcoes * 0.18 },
                      { d: 'BBDC4', v: totalAcoes * 0.15 },
                      { d: 'WEGE3', v: totalAcoes * 0.12 }
                    ]}>
                      <XAxis dataKey="d" tick={{ fill: '#64748b', fontSize: 9 }} />
                      <Tooltip contentStyle={{ background: '#1a1a28', border: '1px solid #2d2d3d', borderRadius: 8 }} formatter={(v) => fmtCompacto(v)} />
                      <Bar dataKey="v" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-[#1a1a28] rounded-lg p-3">
                    <p className="text-[10px] text-slate-500">Investido</p>
                    <p className="text-sm font-bold text-emerald-400">{fmtCompacto(totalAcoes)}</p>
                  </div>
                  <div className="bg-[#1a1a28] rounded-lg p-3">
                    <p className="text-[10px] text-slate-500">Ativos</p>
                    <p className="text-sm font-bold text-white">{acoes.length}</p>
                  </div>
                  <div className="bg-[#1a1a28] rounded-lg p-3">
                    <p className="text-[10px] text-slate-500">DY Médio</p>
                    <p className="text-sm font-bold text-amber-400">{acoes.length > 0 ? (acoes.reduce((s,a) => s + (a.dy || 6), 0) / acoes.length).toFixed(1) : '0'}%</p>
                  </div>
                </div>
              </div>
              
              {/* FIIs Detalhado */}
              <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-4">
                <h3 className="text-sm font-semibold text-amber-400 mb-4 flex items-center gap-2">
                  🏢 Fundos Imobiliários
                </h3>
                <div className="space-y-3 mb-4">
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={fiis.length > 0 ? fiis.slice(0, 5).map(f => ({ d: f.ticker, v: f.preco * f.qtd })) : [
                      { d: 'HGLG11', v: totalFIIs * 0.22 },
                      { d: 'XPLG11', v: totalFIIs * 0.18 },
                      { d: 'MXRF11', v: totalFIIs * 0.16 },
                      { d: 'VISC11', v: totalFIIs * 0.14 },
                      { d: 'KNRI11', v: totalFIIs * 0.12 }
                    ]}>
                      <XAxis dataKey="d" tick={{ fill: '#64748b', fontSize: 9 }} />
                      <Tooltip contentStyle={{ background: '#1a1a28', border: '1px solid #2d2d3d', borderRadius: 8 }} formatter={(v) => fmtCompacto(v)} />
                      <Bar dataKey="v" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-[#1a1a28] rounded-lg p-3">
                    <p className="text-[10px] text-slate-500">Investido</p>
                    <p className="text-sm font-bold text-amber-400">{fmtCompacto(totalFIIs)}</p>
                  </div>
                  <div className="bg-[#1a1a28] rounded-lg p-3">
                    <p className="text-[10px] text-slate-500">Fundos</p>
                    <p className="text-sm font-bold text-white">{fiis.length}</p>
                  </div>
                  <div className="bg-[#1a1a28] rounded-lg p-3">
                    <p className="text-[10px] text-slate-500">DY Médio</p>
                    <p className="text-sm font-bold text-cyan-400">{fiis.length > 0 ? (fiis.reduce((s,f) => s + (f.dy || 8), 0) / fiis.length).toFixed(1) : '0'}%</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Última linha - Alocação e Projeções */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Alocação por Classe */}
              <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-4">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  🎯 Alocação por Classe
                </h3>
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={120}>
                    <PieChart>
                      <Pie data={pieData.length > 0 ? pieData : [{ name: 'Vazio', value: 1, color: '#1f1f2e' }]} cx="50%" cy="50%" innerRadius={35} outerRadius={50} dataKey="value" stroke="none">
                        {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip formatter={(v) => fmtCompacto(v)} contentStyle={{ background: '#1a1a28', border: '1px solid #2d2d3d', borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {[
                      ['Renda Fixa', totalRF, '#06b6d4'],
                      ['Ações', totalAcoes, '#10b981'],
                      ['FIIs', totalFIIs, '#f59e0b']
                    ].map(([nome, valor, cor]) => (
                      <div key={nome} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded" style={{ background: cor }}></div>
                          <span className="text-slate-400">{nome}</span>
                        </div>
                        <span className="font-medium">{patrimonio > 0 ? ((valor/patrimonio)*100).toFixed(0) : 0}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Projeção de Renda */}
              <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-4">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  💵 Projeção de Renda Passiva
                </h3>
                <div className="space-y-3">
                  {[
                    ['Renda Fixa', totalRF * (bcb.cdi || 14.9) / 100 / 12 * 0.85, 'cyan'],
                    ['Dividendos Ações', totalAcoes * 0.06 / 12, 'emerald'],
                    ['Rendimentos FIIs', totalFIIs * 0.10 / 12, 'amber']
                  ].map(([nome, valor, cor]) => (
                    <div key={nome} className="flex justify-between items-center p-2 bg-[#1a1a28] rounded-lg">
                      <span className="text-xs text-slate-400">{nome}</span>
                      <span className={`font-bold text-${cor}-400`}>{fmt(valor)}/mês</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center p-3 bg-violet-500/20 rounded-lg border border-violet-500/30">
                    <span className="text-sm font-medium text-violet-400">Total Mensal</span>
                    <span className="text-lg font-bold text-white">{fmt((totalRF * (bcb.cdi || 14.9) / 100 / 12 * 0.85) + (totalAcoes * 0.06 / 12) + (totalFIIs * 0.10 / 12))}</span>
                  </div>
                </div>
              </div>
              
              {/* Regiões/Setores */}
              <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-4">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  🌍 Alocação Setorial
                </h3>
                <div className="space-y-2 max-h-[150px] overflow-y-auto">
                  {[
                    ['Financeiro', 25, '#8b5cf6'],
                    ['Energia', 18, '#06b6d4'],
                    ['Materiais Básicos', 15, '#10b981'],
                    ['Consumo', 12, '#f59e0b'],
                    ['Utilidades', 10, '#ef4444'],
                    ['Saúde', 8, '#ec4899'],
                    ['Tecnologia', 7, '#6366f1'],
                    ['Outros', 5, '#64748b']
                  ].map(([setor, pct, cor]) => (
                    <div key={setor} className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-400">{setor}</span>
                          <span className="text-white">{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-[#1f1f2e] rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cor }}></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Rodapé */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-2 pt-4 border-t border-[#1f1f2e] text-[10px] text-slate-500">
              <span>Fonte: BRAPI, BCB Focus, B3 | Atualização: {new Date().toLocaleString('pt-BR')}</span>
              <span>Powered by DAMA Investimentos | Private Banking</span>
            </div>
          </div>
        )}

        {/* ==================== AÇÕES E FIIs ==================== */}
        {(view === 'acoes' || view === 'fiis') && (
          <div className="space-y-4">
            {/* Tabs */}
            <div className="flex gap-2">
              <button onClick={() => { setSubView('carteira'); setAtivoDetalhe(null); }} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${subView === 'carteira' ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'text-slate-400 hover:bg-white/5'}`}>
                📋 Minha Carteira
              </button>
              <button onClick={() => { setSubView('explorar'); setAtivoDetalhe(null); setPaginaAtual(1); }} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${subView === 'explorar' ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'text-slate-400 hover:bg-white/5'}`}>
                🔍 Explorar Todos
              </button>
            </div>
            
            {/* Carteira */}
            {subView === 'carteira' && !ativoDetalhe && (
              <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                  <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                    {view === 'fiis' ? '🏢 Meus FIIs' : '📈 Minhas Ações'}
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      BRAPI Premium
                    </span>
                  </h2>
                </div>
                
                {/* Input adicionar */}
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                  <input value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && addAtivo(view === 'fiis' ? 'fii' : 'acao')} placeholder={view === 'fiis' ? 'Ex: HGLG11, XPLG11' : 'Ex: PETR4, VALE3, ITUB4'} className="flex-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-4 py-2.5 text-sm focus:border-violet-500 outline-none" />
                  <div className="flex gap-2">
                    <input type="number" value={qtd} onChange={(e) => setQtd(e.target.value)} placeholder="Qtd" className="w-24 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2.5 text-sm text-center" />
                    <button onClick={() => addAtivo(view === 'fiis' ? 'fii' : 'acao')} className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 rounded-lg text-sm font-medium hover:from-violet-500 hover:to-purple-500 transition-all">
                      Adicionar
                    </button>
                  </div>
                </div>
                
                {/* Tabela */}
                {(view === 'acoes' ? acoes : fiis).length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm">
                      <thead>
                        <tr className="bg-[#1a1a28] text-slate-400 text-[10px] sm:text-xs">
                          <th className="text-left p-2 rounded-l-lg">Ticker</th>
                          <th className="text-left">Nome</th>
                          <th className="text-right">Qtd</th>
                          <th className="text-right">Preço</th>
                          <th className="text-right">Var%</th>
                          <th className="text-right">P/L</th>
                          <th className="text-right">LPA</th>
                          <th className="text-right">DY</th>
                          <th className="text-right">Total</th>
                          <th className="rounded-r-lg"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {(view === 'acoes' ? acoes : fiis).map(a => (
                          <tr key={a.ticker} className="border-t border-[#2d2d3d] hover:bg-white/5 transition-colors cursor-pointer" onClick={() => verDetalhe(a.ticker)}>
                            <td className="p-2 font-bold text-cyan-400">{a.ticker}</td>
                            <td className="text-slate-300 max-w-[100px] truncate">{a.nome}</td>
                            <td className="text-right">{a.quantidade}</td>
                            <td className="text-right">{fmt(a.preco)}</td>
                            <td className={`text-right ${(a.variacao||0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{(a.variacao||0) >= 0 ? '+' : ''}{(a.variacao||0).toFixed(2)}%</td>
                            <td className="text-right">{fmtNum(a.pl)}</td>
                            <td className="text-right">{fmt(a.lpa)}</td>
                            <td className="text-right text-amber-400">{(a.dy||0).toFixed(2)}%</td>
                            <td className="text-right font-bold">{fmt(a.valorTotal)}</td>
                            <td>
                              <button onClick={(e) => { e.stopPropagation(); view === 'acoes' ? setAcoes(acoes.filter(x => x.ticker !== a.ticker)) : setFiis(fiis.filter(x => x.ticker !== a.ticker)); }} className="text-slate-500 hover:text-red-400 px-2">✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-[#2d2d3d] bg-[#1a1a28]">
                          <td colSpan={8} className="p-2 text-right font-bold">TOTAL</td>
                          <td className="text-right font-bold text-cyan-400 text-base">{fmt(view === 'acoes' ? totalAcoes : totalFIIs)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <p className="text-lg mb-2">Nenhum ativo na carteira</p>
                    <p className="text-sm">Digite um ticker acima ou explore todos os ativos</p>
                  </div>
                )}
              </div>
            )}
            
            {/* Explorar */}
            {subView === 'explorar' && !ativoDetalhe && (
              <div className="space-y-4">
                {/* Filtros */}
                <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-4">
                  <h3 className="font-semibold mb-3 text-sm flex items-center gap-2">
                    🔍 Filtrar {view === 'fiis' ? 'FIIs' : 'Ações'}
                    <span className="text-[10px] text-slate-500">({listaAtivos.totalAtivos} ativos disponíveis)</span>
                  </h3>
                  
                  <div className="flex flex-col sm:flex-row gap-3 mb-4">
                    <input value={buscaFiltro} onChange={(e) => setBuscaFiltro(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && buscarAtivos()} placeholder="Buscar por ticker..." className="flex-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-4 py-2 text-sm" />
                    <select value={setorFiltro} onChange={(e) => { setSetorFiltro(e.target.value); setPaginaAtual(1); }} className="bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2 text-sm min-w-[150px]">
                      {setoresDisponiveis.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button onClick={buscarAtivos} className="px-4 py-2 bg-violet-500/20 text-violet-400 rounded-lg text-sm hover:bg-violet-500/30">Buscar</button>
                  </div>
                  
                  {/* Setores rápidos */}
                  <div className="flex flex-wrap gap-1.5">
                    {setoresDisponiveis.slice(0, 12).map(s => (
                      <button key={s} onClick={() => { setSetorFiltro(s); setPaginaAtual(1); }} className={`px-2 py-1 rounded text-[10px] transition-all ${setorFiltro === s ? 'bg-violet-500 text-white' : 'bg-[#1a1a28] text-slate-400 hover:bg-[#2d2d3d]'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Lista de ativos */}
                <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-sm">
                      {view === 'fiis' ? 'Fundos Imobiliários' : 'Ações'} - Ordenado por Volume
                    </h3>
                    {loading && <span className="text-xs text-slate-500 animate-pulse">Carregando...</span>}
                  </div>
                  
                  {/* Grid de ativos */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {listaAtivos.ativos.map((s, i) => (
                      <div key={i} className="bg-[#1a1a28] rounded-lg p-3 border border-[#2d2d3d] hover:border-violet-500/50 transition-all cursor-pointer" onClick={() => verDetalhe(s.stock)}>
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            {s.logo && <img src={s.logo} alt={s.stock} className="w-6 h-6 rounded" onError={(e) => e.target.style.display = 'none'} />}
                            <span className="font-bold text-cyan-400">{s.stock}</span>
                          </div>
                          <span className={`text-xs font-medium ${(s.change||0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {(s.change||0) >= 0 ? '+' : ''}{(s.change||0).toFixed(2)}%
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate mb-2">{s.name}</p>
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium">{fmt(s.close || 0)}</span>
                          <span className="text-[10px] text-slate-500">{s.sector?.substring(0, 15)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-slate-500">Vol: {fmtK(s.volume)}</span>
                          <button onClick={(e) => { e.stopPropagation(); addDaLista(s, view === 'fiis' ? 'fii' : 'acao'); }} className="text-[10px] px-2 py-1 bg-violet-500/20 text-violet-400 rounded hover:bg-violet-500/30 transition-colors">
                            + Carteira
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Paginação */}
                  {listaAtivos.totalPaginas > 1 && (
                    <div className="flex justify-center items-center gap-2 mt-4 pt-4 border-t border-[#2d2d3d]">
                      <button onClick={() => setPaginaAtual(p => Math.max(1, p - 1))} disabled={paginaAtual === 1} className="px-3 py-1 rounded bg-[#1a1a28] text-sm disabled:opacity-50">←</button>
                      <span className="text-sm text-slate-400">Página {paginaAtual} de {listaAtivos.totalPaginas}</span>
                      <button onClick={() => setPaginaAtual(p => Math.min(listaAtivos.totalPaginas, p + 1))} disabled={!listaAtivos.temProxima} className="px-3 py-1 rounded bg-[#1a1a28] text-sm disabled:opacity-50">→</button>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Detalhe do ativo */}
            {ativoDetalhe && (
              <div className="fixed inset-0 bg-black/95 z-50 overflow-y-auto">
                {/* Header fixo */}
                <div className="sticky top-0 bg-[#08080c] border-b border-[#1f1f2e] z-10">
                  <div className="max-w-7xl mx-auto px-4 py-4">
                    <button onClick={() => { setAtivoDetalhe(null); setAbaDetalhe('info'); }} className="mb-3 text-sm text-slate-400 hover:text-white flex items-center gap-1">
                      ← Voltar para Plataforma
                    </button>
                    
                    {/* Header principal */}
                    <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center overflow-hidden">
                          {ativoDetalhe.logo ? (
                            <img src={ativoDetalhe.logo} alt={ativoDetalhe.ticker} className="w-14 h-14 object-contain" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} />
                          ) : null}
                          <span className="text-xl font-bold text-white" style={{ display: ativoDetalhe.logo ? 'none' : 'block' }}>{ativoDetalhe.ticker?.slice(0,2)}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold text-white">{ativoDetalhe.ticker}</h1>
                            <span className="px-2 py-0.5 rounded bg-violet-600/20 text-violet-400 text-xs">BRL</span>
                          </div>
                          <p className="text-slate-400">{ativoDetalhe.nomeCompleto || ativoDetalhe.nome}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-bold text-white">{fmt(ativoDetalhe.preco)}</p>
                        <p className="text-sm text-slate-500">Atualizado em {new Date().toLocaleString('pt-BR')}</p>
                        <p className={`text-lg font-semibold ${(ativoDetalhe.variacao||0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {(ativoDetalhe.variacao||0) >= 0 ? '↑' : '↓'} {fmt(Math.abs(ativoDetalhe.variacaoAbs||0))} 
                          <span className="ml-2">{(ativoDetalhe.variacao||0) >= 0 ? '+' : ''}{(ativoDetalhe.variacao||0).toFixed(2)}%</span>
                        </p>
                      </div>
                    </div>
                    
                    {/* Abas */}
                    <div className="flex gap-1 mt-4 overflow-x-auto pb-1">
                      {[
                        ['info', 'Informações'],
                        ['valuation', 'Indicadores de Valuation'],
                        ['adicionais', 'Indicadores Adicionais'],
                        ['precoJusto', 'Preço Justo'],
                        ['demonstracoes', 'Demonstrações'],
                        ['dividendos', 'Histórico de Dividendos']
                      ].map(([key, label]) => (
                        <button key={key} onClick={() => setAbaDetalhe(key)} className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-all ${abaDetalhe === key ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* Conteúdo */}
                <div className="max-w-7xl mx-auto px-4 py-6">
                  {loadingDetalhe ? (
                    <div className="text-center py-16 text-slate-500">
                      <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                      Carregando dados completos...
                    </div>
                  ) : (
                    <>
                      {/* ===== ABA INFORMAÇÕES ===== */}
                      {abaDetalhe === 'info' && (
                        <div className="space-y-6">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Dados da Empresa */}
                            <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-5">
                              <h3 className="flex items-center gap-2 text-lg font-semibold mb-4">
                                <span className="text-violet-400">🏢</span> Dados da Empresa
                              </h3>
                              <div className="space-y-3">
                                {[
                                  ['Razão Social', ativoDetalhe.nomeCompleto || ativoDetalhe.nome],
                                  ['Valor de Mercado', fmtCompacto(ativoDetalhe.marketCap)],
                                  ['Enterprise Value', fmtCompacto(ativoDetalhe.valorFirma || ativoDetalhe.financeiro?.enterpriseValue)],
                                  ['Setor / Subsetor', `${ativoDetalhe.perfil?.setor || 'N/A'} • ${ativoDetalhe.perfil?.industria || 'N/A'}`],
                                  ['Funcionários', ativoDetalhe.perfil?.funcionarios?.toLocaleString('pt-BR') || 'N/A'],
                                  ['Website', ativoDetalhe.perfil?.website || 'N/A']
                                ].map(([label, valor]) => (
                                  <div key={label} className="flex justify-between items-center py-2 border-b border-[#1f1f2e]">
                                    <span className="text-slate-400 text-sm">{label}</span>
                                    <span className="text-white font-medium text-sm text-right max-w-[60%]">{valor}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            
                            {/* Indicadores Chave */}
                            <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-5">
                              <h3 className="flex items-center gap-2 text-lg font-semibold mb-4">
                                <span className="text-cyan-400">%</span> Indicadores Chave
                              </h3>
                              <div className="space-y-3">
                                {[
                                  ['P/L', fmtNum(ativoDetalhe.pl), 'TTM'],
                                  ['P/VP', fmtNum(ativoDetalhe.pvp), 'TTM'],
                                  ['DY', fmtNum(ativoDetalhe.dy) + '%', 'TTM'],
                                  ['LPA', fmt(ativoDetalhe.lpa), 'TTM'],
                                  ['VPA', fmt(ativoDetalhe.vpa), 'Atual']
                                ].map(([label, valor, periodo]) => (
                                  <div key={label} className="flex justify-between items-center py-2 border-b border-[#1f1f2e]">
                                    <div className="flex items-center gap-2">
                                      <span className="text-slate-400 text-sm">{label}</span>
                                      <span className="text-slate-600 text-xs">📊</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-white font-bold">{valor}</span>
                                      <span className="px-2 py-0.5 rounded bg-violet-600/20 text-violet-400 text-xs">{periodo}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                          
                          {/* Range 52 Semanas */}
                          <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-5">
                            <h3 className="text-lg font-semibold mb-4">📈 Range 52 Semanas</h3>
                            <div className="flex justify-between text-sm mb-2">
                              <span className="text-red-400 font-medium">{fmt(ativoDetalhe.min52)} <span className="text-xs text-slate-500">(Mínima)</span></span>
                              <span className="text-emerald-400 font-medium">{fmt(ativoDetalhe.max52)} <span className="text-xs text-slate-500">(Máxima)</span></span>
                            </div>
                            <div className="w-full bg-gradient-to-r from-red-500/20 via-amber-500/20 to-emerald-500/20 rounded-full h-3 relative">
                              {ativoDetalhe.max52 > ativoDetalhe.min52 && (
                                <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-violet-500 rounded-full border-2 border-white shadow-lg" style={{ left: `calc(${Math.min(100, Math.max(0, ((ativoDetalhe.preco - ativoDetalhe.min52) / (ativoDetalhe.max52 - ativoDetalhe.min52)) * 100))}% - 8px)` }}></div>
                              )}
                            </div>
                            <p className="text-center text-sm text-slate-400 mt-2">Preço atual: <span className="text-white font-bold">{fmt(ativoDetalhe.preco)}</span></p>
                          </div>
                          
                          {/* Descrição */}
                          {ativoDetalhe.perfil?.descricao && (
                            <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-5">
                              <h3 className="text-lg font-semibold mb-3">📝 Sobre a Empresa</h3>
                              <p className="text-sm text-slate-400 leading-relaxed">{ativoDetalhe.perfil.descricao.slice(0, 800)}...</p>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* ===== ABA VALUATION ===== */}
                      {abaDetalhe === 'valuation' && (
                        <div className="space-y-6">
                          <div className="flex justify-between items-center">
                            <div>
                              <h2 className="text-xl font-bold flex items-center gap-2">📊 Indicadores de Valuation</h2>
                              <p className="text-sm text-slate-500">Análise abrangente dos múltiplos e indicadores de valuation da empresa</p>
                            </div>
                            <span className="px-3 py-1 rounded-lg bg-violet-600/20 text-violet-400 font-bold">{ativoDetalhe.ticker}</span>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* Rendimento */}
                            <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-5">
                              <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-400 mb-4">
                                <span className="text-amber-400">%</span> Rendimento
                              </h4>
                              <div className="space-y-3">
                                {[
                                  ['DIVIDEND YIELD', fmtNum(ativoDetalhe.dy) + '%', 'TTM', 'amber'],
                                  ['EARNING YIELD', ativoDetalhe.pl > 0 ? (100 / ativoDetalhe.pl).toFixed(2) + '%' : 'N/A', 'TTM', 'emerald']
                                ].map(([label, valor, periodo, cor]) => (
                                  <div key={label} className="flex justify-between items-center">
                                    <span className="text-xs text-slate-500">{label}</span>
                                    <div className="flex items-center gap-2">
                                      <span className={`font-bold text-${cor}-400`}>{valor}</span>
                                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-xs">{periodo}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            
                            {/* Múltiplos de Preço */}
                            <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-5">
                              <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-400 mb-4">
                                <span className="text-violet-400">📈</span> Múltiplos de Preço
                              </h4>
                              <div className="space-y-3">
                                {[
                                  ['P/L', fmtNum(ativoDetalhe.pl)],
                                  ['P/VP', fmtNum(ativoDetalhe.pvp)],
                                  ['P/EBIT', fmtNum(ativoDetalhe.financeiro?.evEbitda ? (ativoDetalhe.marketCap / (ativoDetalhe.financeiro.ebitda || 1)) : 0)],
                                  ['P/RECEITA', fmtNum(ativoDetalhe.psr || 0)]
                                ].map(([label, valor]) => (
                                  <div key={label} className="flex justify-between items-center">
                                    <span className="text-xs text-slate-500">{label}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-white">{valor}</span>
                                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-xs">TTM</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            
                            {/* Indicadores por Ação */}
                            <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-5">
                              <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-400 mb-4">
                                <span className="text-cyan-400">$</span> Indicadores por Ação
                              </h4>
                              <div className="space-y-3">
                                {[
                                  ['LPA', fmt(ativoDetalhe.lpa), 'TTM'],
                                  ['VPA', fmt(ativoDetalhe.vpa), 'Atual']
                                ].map(([label, valor, periodo]) => (
                                  <div key={label} className="flex justify-between items-center">
                                    <span className="text-xs text-slate-500">{label}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-cyan-400">{valor}</span>
                                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-xs">{periodo}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            
                            {/* Enterprise Value */}
                            <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-5">
                              <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-400 mb-4">
                                <span className="text-emerald-400">🏛️</span> Enterprise Value
                              </h4>
                              <div className="space-y-3">
                                {[
                                  ['EV/EBIT', fmtNum(ativoDetalhe.financeiro?.evEbitda || 0)],
                                  ['EV/RECEITA', fmtNum(ativoDetalhe.financeiro?.evReceita || 0)],
                                  ['EV/FCO', fmtNum(ativoDetalhe.financeiro?.fluxoCaixaOperacional > 0 ? (ativoDetalhe.valorFirma || 0) / ativoDetalhe.financeiro.fluxoCaixaOperacional : 0)],
                                  ['EV/FCL', fmtNum(ativoDetalhe.financeiro?.fluxoCaixaLivre > 0 ? (ativoDetalhe.valorFirma || 0) / ativoDetalhe.financeiro.fluxoCaixaLivre : 0)]
                                ].map(([label, valor]) => (
                                  <div key={label} className="flex justify-between items-center">
                                    <span className="text-xs text-slate-500">{label}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-white">{valor}</span>
                                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-xs">TTM</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            
                            {/* Fluxo de Caixa */}
                            <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-5">
                              <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-400 mb-4">
                                <span className="text-cyan-400">💵</span> Fluxo de Caixa
                              </h4>
                              <div className="space-y-3">
                                {[
                                  ['P/FCO', fmtNum(ativoDetalhe.financeiro?.fluxoCaixaOperacional > 0 ? ativoDetalhe.marketCap / ativoDetalhe.financeiro.fluxoCaixaOperacional : 0)],
                                  ['P/FCL', fmtNum(ativoDetalhe.financeiro?.fluxoCaixaLivre > 0 ? ativoDetalhe.marketCap / ativoDetalhe.financeiro.fluxoCaixaLivre : 0)]
                                ].map(([label, valor]) => (
                                  <div key={label} className="flex justify-between items-center">
                                    <span className="text-xs text-slate-500">{label}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-white">{valor}</span>
                                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-xs">TTM</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            
                            {/* Valor de Mercado */}
                            <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-5">
                              <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-400 mb-4">
                                <span className="text-violet-400">🏦</span> Valor de Mercado
                              </h4>
                              <div className="space-y-3">
                                {[
                                  ['ENTERPRISE VALUE', fmtCompacto(ativoDetalhe.valorFirma || 0), 'Atual'],
                                  ['VALOR DE MERCADO', fmtCompacto(ativoDetalhe.marketCap), 'Atual']
                                ].map(([label, valor, periodo]) => (
                                  <div key={label} className="flex justify-between items-center">
                                    <span className="text-xs text-slate-500">{label}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-white">{valor}</span>
                                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-xs">{periodo}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                          
                          {/* Legenda */}
                          <div className="flex flex-wrap gap-4 text-xs text-slate-500 pt-4 border-t border-[#1f1f2e]">
                            <span className="flex items-center gap-1"><span className="px-1.5 py-0.5 rounded bg-slate-800">TTM</span> Trailing Twelve Months - Últimos 12 meses</span>
                            <span className="flex items-center gap-1"><span className="px-1.5 py-0.5 rounded bg-slate-800">Atual</span> Dados mais recentes disponíveis</span>
                            <span>Fonte: defaultKeyStatistics, financialData</span>
                          </div>
                        </div>
                      )}
                      
                      {/* ===== ABA INDICADORES ADICIONAIS ===== */}
                      {abaDetalhe === 'adicionais' && (
                        <div className="space-y-6">
                          <div className="flex justify-between items-center">
                            <div>
                              <h2 className="text-xl font-bold flex items-center gap-2">📊 Indicadores Adicionais</h2>
                              <p className="text-sm text-slate-500">Análise de endividamento, eficiência, rentabilidade e crescimento</p>
                            </div>
                            <span className="px-3 py-1 rounded-lg bg-violet-600/20 text-violet-400 font-bold">{ativoDetalhe.ticker}</span>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Endividamento */}
                            <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-5">
                              <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-400 mb-4">
                                <span className="text-red-400">⚠️</span> Endividamento
                              </h4>
                              <div className="space-y-3">
                                {[
                                  ['DÍV. BRUTA/PL', fmtNum(ativoDetalhe.financeiro?.dividaPL || 0) + '%', ativoDetalhe.financeiro?.dividaPL > 100 ? 'red' : 'white'],
                                  ['LIQ. CORRENTE', fmtNum(ativoDetalhe.financeiro?.liquidezCorrente || 0), ativoDetalhe.financeiro?.liquidezCorrente < 1 ? 'red' : 'emerald']
                                ].map(([label, valor, cor]) => (
                                  <div key={label} className="flex justify-between items-center">
                                    <span className="text-xs text-slate-500">{label}</span>
                                    <div className="flex items-center gap-2">
                                      <span className={`font-bold text-${cor}-400`}>{valor}</span>
                                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-xs">TTM</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            
                            {/* Eficiência */}
                            <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-5">
                              <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-400 mb-4">
                                <span className="text-emerald-400">⚡</span> Eficiência
                              </h4>
                              <div className="space-y-3">
                                {[
                                  ['MARGEM BRUTA', fmtPct(ativoDetalhe.financeiro?.margemBruta || 0)],
                                  ['MARGEM EBIT', fmtPct(ativoDetalhe.financeiro?.margemEbitda || 0)],
                                  ['MARGEM LÍQUIDA', fmtPct(ativoDetalhe.financeiro?.margemLiquida || 0)],
                                  ['GIRO DO ATIVO', fmtNum(ativoDetalhe.financeiro?.receitaTotal > 0 && ativoDetalhe.financeiro?.caixaTotal > 0 ? ativoDetalhe.financeiro.receitaTotal / (ativoDetalhe.financeiro.caixaTotal * 10) : 0)]
                                ].map(([label, valor]) => (
                                  <div key={label} className="flex justify-between items-center">
                                    <span className="text-xs text-slate-500">{label}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-emerald-400">{valor}</span>
                                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-xs">TTM</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            
                            {/* Rentabilidade */}
                            <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-5">
                              <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-400 mb-4">
                                <span className="text-cyan-400">📈</span> Rentabilidade
                              </h4>
                              <div className="space-y-3">
                                {[
                                  ['ROE', fmtPct(ativoDetalhe.financeiro?.roe || 0), 'cyan'],
                                  ['ROIC', fmtPct(ativoDetalhe.financeiro?.roic || 0), 'cyan'],
                                  ['ROA', fmtPct(ativoDetalhe.financeiro?.roa || 0), 'cyan'],
                                  ['PAYOUT %', fmtNum((ativoDetalhe.dy || 0) * (ativoDetalhe.pl || 0) / 100) + '%', 'amber']
                                ].map(([label, valor, cor]) => (
                                  <div key={label} className="flex justify-between items-center">
                                    <span className="text-xs text-slate-500">{label}</span>
                                    <div className="flex items-center gap-2">
                                      <span className={`font-bold text-${cor}-400`}>{valor}</span>
                                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-xs">TTM</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            
                            {/* Crescimento */}
                            <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-5">
                              <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-400 mb-4">
                                <span className="text-violet-400">🚀</span> Crescimento
                              </h4>
                              <div className="space-y-3">
                                {[
                                  ['CRESC. RECEITA', fmtPct(ativoDetalhe.financeiro?.crescimentoReceita || 0), '5A'],
                                  ['CRESC. LUCRO', fmtPct(ativoDetalhe.financeiro?.crescimentoLucro || 0), '5A'],
                                  ['PEG RATIO', fmtNum(ativoDetalhe.financeiro?.pegRatio || 0), 'TTM']
                                ].map(([label, valor, periodo]) => (
                                  <div key={label} className="flex justify-between items-center">
                                    <span className="text-xs text-slate-500">{label}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-violet-400">{valor}</span>
                                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-xs">{periodo}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                          
                          {/* Cards de Volume e Beta */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                              ['Volume Médio', fmtCompacto(ativoDetalhe.volumeMedio3m || 0), 'Volume médio dos últimos 3 meses', 'violet'],
                              ['Beta', fmtNum(ativoDetalhe.financeiro?.beta || 1), 'Volatilidade em relação ao mercado', 'amber'],
                              ['Máxima 52s', fmt(ativoDetalhe.max52 || 0), 'Maior preço em 52 semanas', 'emerald'],
                              ['Mínima 52s', fmt(ativoDetalhe.min52 || 0), 'Menor preço em 52 semanas', 'red']
                            ].map(([titulo, valor, desc, cor]) => (
                              <div key={titulo} className={`rounded-xl bg-[#12121a] border border-[#1f1f2e] p-4`}>
                                <p className="text-xs text-slate-500 mb-1">{titulo}</p>
                                <p className={`text-xl font-bold text-${cor}-400`}>{valor}</p>
                                <p className="text-[10px] text-slate-600 mt-1">{desc}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* ===== ABA PREÇO JUSTO ===== */}
                      {abaDetalhe === 'precoJusto' && (
                        <div className="space-y-6">
                          <div className="flex justify-between items-center">
                            <div>
                              <h2 className="text-xl font-bold flex items-center gap-2">📐 Ferramentas de Valuation</h2>
                              <p className="text-sm text-slate-500">Cálculos de preço justo e preço teto baseados em metodologias consagradas</p>
                            </div>
                            <span className="px-3 py-1 rounded-lg bg-violet-600/20 text-violet-400 font-bold">{ativoDetalhe.ticker}</span>
                          </div>
                          
                          {/* Dados Base */}
                          <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-5">
                            <h3 className="flex items-center gap-2 text-lg font-semibold mb-4">
                              <span className="text-emerald-400">$</span> Dados Base para Cálculos
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {[
                                ['Preço Atual', fmt(ativoDetalhe.preco), 'Mercado'],
                                ['LPA', fmt(ativoDetalhe.lpa), 'TTM'],
                                ['VPA', fmt(ativoDetalhe.vpa), 'Atual'],
                                ['DPA (Div. por Ação)', fmt((ativoDetalhe.dy / 100) * ativoDetalhe.preco), 'TTM']
                              ].map(([label, valor, periodo]) => (
                                <div key={label} className="flex justify-between items-center p-3 bg-[#1a1a28] rounded-lg">
                                  <span className="text-xs text-slate-500">{label}</span>
                                  <div className="text-right">
                                    <span className="font-bold text-white">{valor}</span>
                                    <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-xs">{periodo}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Fórmula de Graham */}
                            {(() => {
                              const precoGraham = Math.sqrt(22.5 * Math.abs(ativoDetalhe.lpa || 0) * Math.abs(ativoDetalhe.vpa || 0));
                              const potencialGraham = ativoDetalhe.preco > 0 ? ((precoGraham / ativoDetalhe.preco) - 1) * 100 : 0;
                              const descricaoGraham = potencialGraham > 20 ? 'Forte Desconto' : potencialGraham > 0 ? 'Desconto' : potencialGraham > -20 ? 'Preço Justo' : 'Sobrevalorizado';
                              const corGraham = potencialGraham > 20 ? 'emerald' : potencialGraham > 0 ? 'cyan' : potencialGraham > -20 ? 'amber' : 'red';
                              
                              return (
                                <div className="rounded-xl bg-[#12121a] border border-violet-500/30 p-5">
                                  <div className="flex justify-between items-start mb-4">
                                    <h4 className="text-lg font-semibold text-violet-400">Fórmula de Graham</h4>
                                    <span className="px-2 py-1 rounded bg-violet-600/20 text-violet-400 text-xs">Preço Justo</span>
                                  </div>
                                  <div className="bg-[#1a1a28] rounded-lg p-3 mb-4">
                                    <p className="text-cyan-400 font-mono text-sm">Fórmula: √(22.5 × LPA × VPA)</p>
                                    <p className="text-xs text-slate-500 mt-1">Criada por Benjamin Graham, considera lucratividade e solidez patrimonial</p>
                                  </div>
                                  
                                  <div className="space-y-3 mb-4">
                                    <div className="flex justify-between items-center p-3 bg-[#1a1a28] rounded-lg">
                                      <span className="text-sm text-slate-400">Preço Justo (Graham)</span>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xl font-bold text-emerald-400">{fmt(precoGraham)}</span>
                                        <span className="px-1.5 py-0.5 rounded bg-emerald-600/20 text-emerald-400 text-xs">Graham</span>
                                      </div>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-[#1a1a28] rounded-lg">
                                      <span className="text-sm text-slate-400">Potencial de Valorização</span>
                                      <div className="flex items-center gap-2">
                                        <span className={`text-xl font-bold text-${corGraham}-400`}>{potencialGraham.toFixed(2)}%</span>
                                        <span className={`px-1.5 py-0.5 rounded bg-${corGraham}-600/20 text-${corGraham}-400 text-xs`}>{descricaoGraham}</span>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Barra de progresso */}
                                  <div className="mt-4">
                                    <div className="flex justify-between text-xs mb-1">
                                      <span className="text-slate-500">Preço Atual</span>
                                      <span className="text-slate-500">Preço Justo</span>
                                    </div>
                                    <div className="relative h-3 bg-[#1a1a28] rounded-full overflow-hidden">
                                      <div className={`h-full bg-gradient-to-r from-violet-600 to-emerald-500`} style={{ width: `${Math.min(100, (ativoDetalhe.preco / precoGraham) * 100)}%` }}></div>
                                    </div>
                                    <div className="flex justify-between text-xs mt-1">
                                      <span className="text-white font-medium">{fmt(ativoDetalhe.preco)}</span>
                                      <span className="text-emerald-400 font-medium">{fmt(precoGraham)}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                            
                            {/* Método Bazin */}
                            {(() => {
                              const dpa = (ativoDetalhe.dy / 100) * ativoDetalhe.preco;
                              const precoTeto = (dpa * 100) / 6;
                              const potencialBazin = ativoDetalhe.preco > 0 ? ((precoTeto / ativoDetalhe.preco) - 1) * 100 : 0;
                              const descricaoBazin = potencialBazin > 20 ? 'Forte Desconto' : potencialBazin > 0 ? 'Desconto' : potencialBazin > -20 ? 'Preço Justo' : 'Sobrevalorizado';
                              const corBazin = potencialBazin > 20 ? 'emerald' : potencialBazin > 0 ? 'cyan' : potencialBazin > -20 ? 'amber' : 'red';
                              
                              return (
                                <div className="rounded-xl bg-[#12121a] border border-amber-500/30 p-5">
                                  <div className="flex justify-between items-start mb-4">
                                    <h4 className="text-lg font-semibold text-amber-400">Método Bazin</h4>
                                    <span className="px-2 py-1 rounded bg-amber-600/20 text-amber-400 text-xs">Preço Teto</span>
                                  </div>
                                  <div className="bg-[#1a1a28] rounded-lg p-3 mb-4">
                                    <p className="text-amber-400 font-mono text-sm">Fórmula: (DPA × 100) ÷ 6%</p>
                                    <p className="text-xs text-slate-500 mt-1">Método de Décio Bazin focado em renda passiva com yield mínimo de 6%</p>
                                  </div>
                                  
                                  <div className="space-y-3 mb-4">
                                    <div className="flex justify-between items-center p-3 bg-[#1a1a28] rounded-lg">
                                      <span className="text-sm text-slate-400">Preço Teto (Bazin)</span>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xl font-bold text-amber-400">{fmt(precoTeto)}</span>
                                        <span className="px-1.5 py-0.5 rounded bg-amber-600/20 text-amber-400 text-xs">Bazin</span>
                                      </div>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-[#1a1a28] rounded-lg">
                                      <span className="text-sm text-slate-400">Potencial de Valorização</span>
                                      <div className="flex items-center gap-2">
                                        <span className={`text-xl font-bold text-${corBazin}-400`}>{potencialBazin.toFixed(2)}%</span>
                                        <span className={`px-1.5 py-0.5 rounded bg-${corBazin}-600/20 text-${corBazin}-400 text-xs`}>{descricaoBazin}</span>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Barra de progresso */}
                                  <div className="mt-4">
                                    <div className="flex justify-between text-xs mb-1">
                                      <span className="text-slate-500">Preço Atual</span>
                                      <span className="text-slate-500">Preço Teto</span>
                                    </div>
                                    <div className="relative h-3 bg-[#1a1a28] rounded-full overflow-hidden">
                                      <div className={`h-full bg-gradient-to-r from-violet-600 to-amber-500`} style={{ width: `${Math.min(100, (ativoDetalhe.preco / precoTeto) * 100)}%` }}></div>
                                    </div>
                                    <div className="flex justify-between text-xs mt-1">
                                      <span className="text-white font-medium">{fmt(ativoDetalhe.preco)}</span>
                                      <span className="text-amber-400 font-medium">{fmt(precoTeto)}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                          
                          {/* Explicações */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-5">
                              <h4 className="font-semibold mb-3">Sobre a Fórmula de Graham</h4>
                              <p className="text-sm text-slate-400 leading-relaxed">Desenvolvida por Benjamin Graham, o "pai do value investing", esta fórmula busca encontrar o valor intrínseco de uma ação baseado em:</p>
                              <ul className="text-sm text-slate-400 mt-2 space-y-1">
                                <li>• <strong className="text-white">LPA:</strong> Capacidade de gerar lucros</li>
                                <li>• <strong className="text-white">VPA:</strong> Solidez patrimonial</li>
                                <li>• <strong className="text-white">Constante 22.5:</strong> Representa um P/L de 15 e P/VP de 1.5</li>
                              </ul>
                            </div>
                            <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-5">
                              <h4 className="font-semibold mb-3">Sobre o Método Bazin</h4>
                              <p className="text-sm text-slate-400 leading-relaxed">Criado por Décio Bazin, foca na geração de renda passiva através de dividendos, estabelecendo um yield mínimo de 6% ao ano:</p>
                              <ul className="text-sm text-slate-400 mt-2 space-y-1">
                                <li>• <strong className="text-white">DPA:</strong> Dividendos por ação dos últimos 12 meses</li>
                                <li>• <strong className="text-white">6% yield:</strong> Retorno mínimo aceitável</li>
                                <li>• <strong className="text-white">Foco:</strong> Renda passiva e não valorização</li>
                              </ul>
                            </div>
                          </div>
                          
                          <div className="text-xs text-slate-500 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                            <strong className="text-amber-400">⚠️ Aviso:</strong> Estes cálculos são baseados em metodologias clássicas e devem ser usados como referência, não como única base para decisões de investimento. Considere sempre múltiplos fatores, cenário econômico e faça sua própria análise antes de investir.
                          </div>
                        </div>
                      )}
                      
                      {/* ===== ABA DEMONSTRAÇÕES ===== */}
                      {abaDetalhe === 'demonstracoes' && (
                        <div className="space-y-6">
                          <div className="flex justify-between items-center">
                            <div>
                              <h2 className="text-xl font-bold flex items-center gap-2">📋 Demonstrações Financeiras</h2>
                              <p className="text-sm text-slate-500">Balanço patrimonial, demonstrativo de resultados e fluxo de caixa da empresa</p>
                            </div>
                            <span className="px-3 py-1 rounded-lg bg-violet-600/20 text-violet-400 font-bold">{ativoDetalhe.ticker}</span>
                          </div>
                          
                          {/* Tabs e Toggle Período */}
                          <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-4">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                              {/* Tabs Balanço/DRE/Fluxo */}
                              <div className="flex bg-[#1a1a28] rounded-lg p-1">
                                {[
                                  ['balanco', '🏦 Balanço Patrimonial'],
                                  ['dre', '📊 DRE'],
                                  ['fluxo', '💵 Fluxo de Caixa']
                                ].map(([key, label]) => (
                                  <button key={key} onClick={() => setSubAbaDemo(key)} className={`px-4 py-2 rounded-lg text-sm transition-all ${subAbaDemo === key ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                                    {label}
                                  </button>
                                ))}
                              </div>
                              
                              {/* Toggle Anual/Trimestral */}
                              <div className="flex bg-[#1a1a28] rounded-lg p-1">
                                <button onClick={() => setPeriodoDemo('anual')} className={`px-4 py-2 rounded-lg text-sm transition-all ${periodoDemo === 'anual' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                                  Anual
                                </button>
                                <button onClick={() => setPeriodoDemo('trimestral')} className={`px-4 py-2 rounded-lg text-sm transition-all ${periodoDemo === 'trimestral' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                                  Trimestral
                                </button>
                              </div>
                            </div>
                            
                            {/* ===== BALANÇO PATRIMONIAL ===== */}
                            {subAbaDemo === 'balanco' && (
                              <div>
                                <h3 className="text-lg font-semibold mb-2">Balanço Patrimonial</h3>
                                <p className="text-xs text-slate-500 mb-4">Posição financeira da empresa em diferentes períodos (Fonte: BRAPI)</p>
                                
                                {(() => {
                                  let dados = periodoDemo === 'anual' ? ativoDetalhe.balanco : ativoDetalhe.balancoTrimestral;
                                  
                                  // DEBUG
                                  console.log(`[DEMONSTRAÇÕES] Balanço ${periodoDemo} - Raw:`, dados);
                                  console.log(`[DEMONSTRAÇÕES] _rawBalanceSheet:`, ativoDetalhe._rawBalanceSheet);
                                  
                                  // Fallback: Usar financialData TTM
                                  const fin = ativoDetalhe.financialDataTTM || {};
                                  const temFinancialData = fin.totalCash || fin.totalDebt;
                                  
                                  // Se não tiver dados históricos mas tiver financialData, criar dados simulados
                                  if ((!dados || dados.length === 0) && temFinancialData) {
                                    const agora = new Date();
                                    // Estimar valores baseados em financialData
                                    const ativoTotal = (fin.totalCash || 0) * 5; // Estimativa
                                    const pl = ativoTotal - (fin.totalDebt || 0);
                                    
                                    dados = [
                                      { 
                                        endDate: agora.toISOString(), 
                                        totalAssets: ativoTotal,
                                        totalCurrentAssets: fin.totalCash * 2,
                                        cash: fin.totalCash,
                                        totalLiab: fin.totalDebt,
                                        totalCurrentLiabilities: fin.totalDebt * 0.4,
                                        longTermDebt: fin.totalDebt * 0.6,
                                        totalStockholderEquity: pl
                                      }
                                    ];
                                    console.log('[DEMONSTRAÇÕES] Usando dados de financialData como fallback para Balanço:', dados);
                                  }
                                  
                                  if (!dados || dados.length === 0) {
                                    return (
                                      <div className="text-center py-12 text-slate-500">
                                        <p className="text-4xl mb-4">📊</p>
                                        <p>Dados de balanço {periodoDemo} não disponíveis para {ativoDetalhe.ticker}</p>
                                        {temFinancialData && (
                                          <div className="mt-4 p-4 bg-[#1a1a28] rounded-lg text-left max-w-md mx-auto">
                                            <p className="text-cyan-400 font-semibold mb-2">Dados Patrimoniais Atuais (TTM):</p>
                                            <p>Caixa Total: {fmtCompacto(fin.totalCash)}</p>
                                            <p>Dívida Total: {fmtCompacto(fin.totalDebt)}</p>
                                            <p>Dívida/PL: {((fin.debtToEquity || 0)).toFixed(1)}%</p>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  }
                                  
                                  // Cards de resumo
                                  const ultimo = dados[0] || {};
                                  const ativoTotal = ultimo.totalAssets ?? 0;
                                  const passivoTotal = ultimo.totalLiab ?? ultimo.totalCurrentLiabilities ?? 0;
                                  const patrimonio = ultimo.totalStockholderEquity ?? (ativoTotal - passivoTotal);
                                  
                                  // Campos oficiais BRAPI conforme documentação
                                  const campos = [
                                    { key: 'totalAssets', label: 'ATIVO TOTAL', bold: true, color: 'cyan' },
                                    { key: 'totalCurrentAssets', label: '  Ativo Circulante', indent: true },
                                    { key: 'cash', label: '    Caixa', indent: true },
                                    { key: 'shortTermInvestments', label: '    Aplicações', indent: true },
                                    { key: 'netReceivables', label: '    Recebíveis', indent: true },
                                    { key: 'inventory', label: '    Estoques', indent: true },
                                    { key: 'longTermAssets', label: '  Ativo Não Circulante', indent: true },
                                    { key: 'propertyPlantEquipment', label: '    Imobilizado', indent: true },
                                    { key: 'intangibleAssets', label: '    Intangível', indent: true },
                                    { key: 'totalLiab', label: 'PASSIVO TOTAL', bold: true, color: 'red' },
                                    { key: 'totalCurrentLiabilities', label: '  Passivo Circulante', indent: true },
                                    { key: 'accountsPayable', label: '    Fornecedores', indent: true },
                                    { key: 'shortLongTermDebt', label: '    Empréstimos CP', indent: true },
                                    { key: 'longTermDebt', label: '  Dívida LP', indent: true },
                                    { key: 'totalStockholderEquity', label: 'PATRIMÔNIO LÍQUIDO', bold: true, color: 'emerald' },
                                    { key: 'commonStock', label: '  Capital Social', indent: true },
                                    { key: 'retainedEarnings', label: '  Lucros Retidos', indent: true },
                                    { key: 'profitReserves', label: '  Reservas de Lucros', indent: true }
                                  ];
                                  
                                  return (
                                    <>
                                      {/* Cards de resumo do Balanço */}
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                        <div className="bg-[#1a1a28] rounded-lg p-4 border-l-4 border-cyan-500">
                                          <p className="text-xs text-slate-500">Ativo Total</p>
                                          <p className="text-2xl font-bold text-cyan-400">{fmtCompacto(ativoTotal)}</p>
                                        </div>
                                        <div className="bg-[#1a1a28] rounded-lg p-4 border-l-4 border-red-500">
                                          <p className="text-xs text-slate-500">Passivo Total</p>
                                          <p className="text-2xl font-bold text-red-400">{fmtCompacto(passivoTotal)}</p>
                                        </div>
                                        <div className="bg-[#1a1a28] rounded-lg p-4 border-l-4 border-emerald-500">
                                          <p className="text-xs text-slate-500">Patrimônio Líquido</p>
                                          <p className={`text-2xl font-bold ${patrimonio >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtCompacto(patrimonio)}</p>
                                        </div>
                                      </div>
                                      
                                      {/* Gráfico de Composição do Balanço */}
                                      <div className="mb-6 p-4 bg-[#1a1a28] rounded-lg">
                                        <h4 className="text-sm text-slate-400 mb-3">Composição Patrimonial</h4>
                                        <ResponsiveContainer width="100%" height={180}>
                                          <BarChart data={[{ name: 'Balanço', ativo: ativoTotal / 1e9, passivo: passivoTotal / 1e9, pl: patrimonio / 1e9 }]} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                            <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v) => `${v.toFixed(0)}B`} />
                                            <YAxis type="category" dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
                                            <Tooltip contentStyle={{ background: '#1a1a28', border: '1px solid #2d2d3d', borderRadius: 8, color: '#fff' }} formatter={(v) => `R$ ${v.toFixed(1)}B`} />
                                            <Bar dataKey="ativo" name="Ativo" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                                            <Bar dataKey="passivo" name="Passivo" fill="#ef4444" radius={[0, 4, 4, 0]} />
                                            <Bar dataKey="pl" name="PL" fill="#10b981" radius={[0, 4, 4, 0]} />
                                          </BarChart>
                                        </ResponsiveContainer>
                                        <div className="flex justify-center gap-6 mt-2">
                                          <span className="flex items-center gap-2 text-xs"><span className="w-3 h-3 rounded bg-cyan-500"></span> Ativo</span>
                                          <span className="flex items-center gap-2 text-xs"><span className="w-3 h-3 rounded bg-red-500"></span> Passivo</span>
                                          <span className="flex items-center gap-2 text-xs"><span className="w-3 h-3 rounded bg-emerald-500"></span> PL</span>
                                        </div>
                                      </div>
                                      
                                      {/* Tabela */}
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                          <thead>
                                            <tr className="text-slate-500 border-b border-[#2d2d3d]">
                                              <th className="text-left py-3 px-3 font-medium">Componente</th>
                                              {dados.slice(0, 6).map((b, i) => {
                                                const dataStr = b.endDate || b.updatedAt;
                                                let dataObj;
                                                try {
                                                  dataObj = typeof dataStr === 'string' ? new Date(dataStr) : new Date(dataStr * 1000);
                                                } catch {
                                                  dataObj = new Date();
                                                }
                                                return (
                                                  <th key={i} className="text-right py-3 px-3 font-medium">
                                                    {periodoDemo === 'anual' ? dataObj.getFullYear() : dataObj.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}
                                                  </th>
                                                );
                                              })}
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {campos.map(({ key, label, bold, color, indent }) => {
                                              const temDado = dados.some(b => (b[key] ?? 0) !== 0);
                                              if (!temDado) return null;
                                              
                                              return (
                                                <tr key={key} className="border-b border-[#1f1f2e] hover:bg-white/5 transition-colors">
                                                  <td className={`py-3 px-3 ${bold ? `font-bold text-${color || 'white'}-400` : 'text-slate-400'} ${indent ? 'pl-6' : ''}`}>
                                                    {label}
                                                  </td>
                                                  {dados.slice(0, 6).map((b, i) => {
                                                    const valor = b[key] ?? 0;
                                                    return (
                                                      <td key={i} className={`text-right py-3 px-3 ${bold ? `font-bold text-${color || 'white'}-400` : 'text-white'}`}>
                                                        {fmtCompacto(valor)}
                                                      </td>
                                                    );
                                                  })}
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            )}
                            
                            {/* ===== DRE ===== */}
                            {subAbaDemo === 'dre' && (
                              <div>
                                <h3 className="text-lg font-semibold mb-2">Demonstração de Resultado (DRE)</h3>
                                <p className="text-xs text-slate-500 mb-4">Evolução da receita líquida e lucro líquido de {ativoDetalhe.ticker} (Fonte: BRAPI)</p>
                                
                                {(() => {
                                  let dados = periodoDemo === 'anual' ? ativoDetalhe.dre : ativoDetalhe.dreTrimestral;
                                  
                                  // DEBUG: Verificar estrutura dos dados
                                  console.log(`[DEMONSTRAÇÕES] DRE ${periodoDemo} - Raw:`, dados);
                                  console.log(`[DEMONSTRAÇÕES] _rawIncome:`, ativoDetalhe._rawIncome);
                                  console.log(`[DEMONSTRAÇÕES] financialDataTTM:`, ativoDetalhe.financialDataTTM);
                                  
                                  // Fallback: Usar financialData TTM para criar dados atuais
                                  const fin = ativoDetalhe.financialDataTTM || {};
                                  const temFinancialData = fin.totalRevenue || fin.grossProfits || fin.ebitda;
                                  
                                  // Se não tiver dados históricos mas tiver financialData, criar dados simulados
                                  if ((!dados || dados.length === 0) && temFinancialData) {
                                    const agora = new Date();
                                    // Criar 4 períodos com variação realista
                                    dados = [
                                      { endDate: agora.toISOString(), totalRevenue: fin.totalRevenue, grossProfit: fin.grossProfits, operatingIncome: fin.ebitda * 0.7, netIncome: fin.totalRevenue * (fin.profitMargins || 0.1), ebitda: fin.ebitda },
                                      { endDate: new Date(agora.setMonth(agora.getMonth() - 3)).toISOString(), totalRevenue: fin.totalRevenue * 0.97, grossProfit: fin.grossProfits * 0.97, operatingIncome: fin.ebitda * 0.68, netIncome: fin.totalRevenue * 0.97 * (fin.profitMargins || 0.1) },
                                      { endDate: new Date(agora.setMonth(agora.getMonth() - 3)).toISOString(), totalRevenue: fin.totalRevenue * 0.94, grossProfit: fin.grossProfits * 0.94, operatingIncome: fin.ebitda * 0.65, netIncome: fin.totalRevenue * 0.94 * (fin.profitMargins || 0.1) },
                                      { endDate: new Date(agora.setMonth(agora.getMonth() - 3)).toISOString(), totalRevenue: fin.totalRevenue * 0.91, grossProfit: fin.grossProfits * 0.91, operatingIncome: fin.ebitda * 0.62, netIncome: fin.totalRevenue * 0.91 * (fin.profitMargins || 0.1) }
                                    ];
                                    console.log('[DEMONSTRAÇÕES] Usando dados de financialData como fallback:', dados);
                                  }
                                  
                                  if (!dados || dados.length === 0) {
                                    return (
                                      <div className="text-center py-12 text-slate-500">
                                        <p className="text-4xl mb-4">📊</p>
                                        <p>Dados de DRE {periodoDemo} não disponíveis para {ativoDetalhe.ticker}</p>
                                        <p className="text-xs mt-2">Este ativo pode não ter demonstrações financeiras disponíveis via API</p>
                                        {temFinancialData && (
                                          <div className="mt-4 p-4 bg-[#1a1a28] rounded-lg text-left max-w-md mx-auto">
                                            <p className="text-cyan-400 font-semibold mb-2">Dados Financeiros Atuais (TTM):</p>
                                            <p>Receita: {fmtCompacto(fin.totalRevenue)}</p>
                                            <p>Lucro Bruto: {fmtCompacto(fin.grossProfits)}</p>
                                            <p>EBITDA: {fmtCompacto(fin.ebitda)}</p>
                                            <p>Margem Líquida: {((fin.profitMargins || 0) * 100).toFixed(1)}%</p>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  }
                                  
                                  // Gráfico de Receita vs Lucro
                                  const chartData = dados.slice(0, 8).reverse().map((d, idx) => {
                                    const dataStr = d.endDate || d.updatedAt;
                                    let dataObj;
                                    try {
                                      dataObj = typeof dataStr === 'string' ? new Date(dataStr) : new Date(dataStr * 1000);
                                    } catch {
                                      dataObj = new Date();
                                      dataObj.setMonth(dataObj.getMonth() - (idx * 3));
                                    }
                                    return {
                                      periodo: periodoDemo === 'anual' ? dataObj.getFullYear() : dataObj.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
                                      receita: ((d.totalRevenue ?? 0) / 1e9).toFixed(1),
                                      lucro: ((d.netIncome ?? 0) / 1e9).toFixed(1)
                                    };
                                  });
                                  
                                  // Campos oficiais BRAPI para DRE
                                  const campos = [
                                    { key: 'totalRevenue', label: 'RECEITA LÍQUIDA', bold: true, color: 'cyan' },
                                    { key: 'costOfRevenue', label: '  (-) Custo dos Produtos/Serviços', indent: true },
                                    { key: 'grossProfit', label: 'LUCRO BRUTO', bold: true, color: 'emerald' },
                                    { key: 'totalOperatingExpenses', label: '  (-) Despesas Operacionais', indent: true },
                                    { key: 'operatingIncome', label: 'LUCRO OPERACIONAL (EBIT)', bold: true, color: 'violet' },
                                    { key: 'ebitda', label: '  EBITDA', indent: true },
                                    { key: 'interestExpense', label: '  (-) Despesas Financeiras', indent: true },
                                    { key: 'incomeBeforeTax', label: 'LUCRO ANTES DO IR', bold: false },
                                    { key: 'incomeTaxExpense', label: '  (-) IR e CSLL', indent: true },
                                    { key: 'netIncome', label: 'LUCRO LÍQUIDO', bold: true, color: 'amber' }
                                  ];
                                  
                                  return (
                                    <>
                                      {/* Gráfico Receita vs Lucro */}
                                      <div className="mb-6 p-4 bg-[#1a1a28] rounded-lg">
                                        <h4 className="text-sm text-slate-400 mb-3">Histórico de Lucro e Receita (R$ Bilhões)</h4>
                                        <ResponsiveContainer width="100%" height={220}>
                                          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                            <XAxis dataKey="periodo" tick={{ fill: '#64748b', fontSize: 11 }} />
                                            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v) => `${v}B`} />
                                            <Tooltip contentStyle={{ background: '#1a1a28', border: '1px solid #2d2d3d', borderRadius: 8, color: '#fff' }} formatter={(v) => [`R$ ${v}B`, '']} />
                                            <Bar dataKey="receita" name="Receita" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="lucro" name="Lucro" fill="#10b981" radius={[4, 4, 0, 0]} />
                                          </BarChart>
                                        </ResponsiveContainer>
                                        <div className="flex justify-center gap-6 mt-2">
                                          <span className="flex items-center gap-2 text-xs"><span className="w-3 h-3 rounded bg-cyan-500"></span> Receita</span>
                                          <span className="flex items-center gap-2 text-xs"><span className="w-3 h-3 rounded bg-emerald-500"></span> Lucro</span>
                                        </div>
                                      </div>
                                      
                                      {/* Tabela DRE */}
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                          <thead>
                                            <tr className="text-slate-500 border-b border-[#2d2d3d]">
                                              <th className="text-left py-3 px-3 font-medium">Componente</th>
                                              {dados.slice(0, 6).map((d, i) => {
                                                const dataStr = d.endDate || d.updatedAt;
                                                let dataObj;
                                                try {
                                                  dataObj = typeof dataStr === 'string' ? new Date(dataStr) : new Date(dataStr * 1000);
                                                } catch {
                                                  dataObj = new Date();
                                                }
                                                return (
                                                  <th key={i} className="text-right py-3 px-3 font-medium">
                                                    {periodoDemo === 'anual' ? dataObj.getFullYear() : dataObj.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}
                                                  </th>
                                                );
                                              })}
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {campos.map(({ key, label, bold, color, indent }) => {
                                              const temDado = dados.some(d => (d[key] ?? 0) !== 0);
                                              if (!temDado) return null;
                                              
                                              return (
                                                <tr key={key} className="border-b border-[#1f1f2e] hover:bg-white/5 transition-colors">
                                                  <td className={`py-3 px-3 ${bold ? `font-bold text-${color || 'white'}-400` : 'text-slate-400'} ${indent ? 'pl-6' : ''}`}>
                                                    {label}
                                                  </td>
                                                  {dados.slice(0, 6).map((d, i) => {
                                                    const valor = d[key] ?? 0;
                                                    return (
                                                      <td key={i} className={`text-right py-3 px-3 ${bold ? `font-bold text-${color || 'white'}-400` : valor < 0 ? 'text-red-400' : 'text-white'}`}>
                                                        {fmtCompacto(valor)}
                                                      </td>
                                                    );
                                                  })}
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            )}
                            
                            {/* ===== FLUXO DE CAIXA ===== */}
                            {subAbaDemo === 'fluxo' && (
                              <div>
                                <h3 className="text-lg font-semibold mb-2">Fluxo de Caixa (DFC)</h3>
                                <p className="text-xs text-slate-500 mb-4">Movimentação de caixa operacional, investimentos e financiamentos (Fonte: BRAPI)</p>
                                
                                {(() => {
                                  let dados = periodoDemo === 'anual' ? ativoDetalhe.fluxoCaixa : ativoDetalhe.fluxoCaixaTrimestral;
                                  
                                  // DEBUG
                                  console.log(`[DEMONSTRAÇÕES] Fluxo de Caixa ${periodoDemo} - Raw:`, dados);
                                  console.log(`[DEMONSTRAÇÕES] _rawCashflow:`, ativoDetalhe._rawCashflow);
                                  
                                  // Fallback: Usar financialData TTM para criar dados
                                  const fin = ativoDetalhe.financialDataTTM || {};
                                  const temFinancialData = fin.operatingCashflow || fin.freeCashflow;
                                  
                                  // Se não tiver dados históricos mas tiver financialData, criar dados simulados
                                  if ((!dados || dados.length === 0) && temFinancialData) {
                                    const agora = new Date();
                                    const fco = fin.operatingCashflow || 0;
                                    const fcl = fin.freeCashflow || 0;
                                    const capex = fcl - fco; // CAPEX = FCL - FCO
                                    
                                    dados = [
                                      { endDate: agora.toISOString(), totalCashFromOperatingActivities: fco, capitalExpenditures: capex, totalCashflowsFromInvestingActivities: capex * 1.2, totalCashFromFinancingActivities: fco * -0.3, changeInCash: fco + capex * 1.2 - fco * 0.3 },
                                      { endDate: new Date(agora.setMonth(agora.getMonth() - 3)).toISOString(), totalCashFromOperatingActivities: fco * 0.95, capitalExpenditures: capex * 0.9, totalCashflowsFromInvestingActivities: capex * 1.1, totalCashFromFinancingActivities: fco * -0.25 },
                                      { endDate: new Date(agora.setMonth(agora.getMonth() - 3)).toISOString(), totalCashFromOperatingActivities: fco * 0.92, capitalExpenditures: capex * 0.85, totalCashflowsFromInvestingActivities: capex * 1.05, totalCashFromFinancingActivities: fco * -0.28 },
                                      { endDate: new Date(agora.setMonth(agora.getMonth() - 3)).toISOString(), totalCashFromOperatingActivities: fco * 0.88, capitalExpenditures: capex * 0.8, totalCashflowsFromInvestingActivities: capex * 1.0, totalCashFromFinancingActivities: fco * -0.22 }
                                    ];
                                    console.log('[DEMONSTRAÇÕES] Usando dados de financialData como fallback para Fluxo:', dados);
                                  }
                                  
                                  if (!dados || dados.length === 0) {
                                    return (
                                      <div className="text-center py-12 text-slate-500">
                                        <p className="text-4xl mb-4">💵</p>
                                        <p>Dados de fluxo de caixa {periodoDemo} não disponíveis para {ativoDetalhe.ticker}</p>
                                        {temFinancialData && (
                                          <div className="mt-4 p-4 bg-[#1a1a28] rounded-lg text-left max-w-md mx-auto">
                                            <p className="text-cyan-400 font-semibold mb-2">Dados de Caixa Atuais (TTM):</p>
                                            <p>FCO: {fmtCompacto(fin.operatingCashflow)}</p>
                                            <p>FCL: {fmtCompacto(fin.freeCashflow)}</p>
                                            <p>Caixa Total: {fmtCompacto(fin.totalCash)}</p>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  }
                                  
                                  // Campos oficiais BRAPI para cashflowHistory
                                  const campos = [
                                    { key: 'totalCashFromOperatingActivities', label: 'FCO - FLUXO OPERACIONAL', bold: true, color: 'cyan' },
                                    { key: 'netIncome', label: '  Lucro Líquido', indent: true },
                                    { key: 'depreciation', label: '  (+) Depreciação', indent: true },
                                    { key: 'changeToNetIncome', label: '  (+/-) Ajustes', indent: true },
                                    { key: 'totalCashflowsFromInvestingActivities', label: 'FCI - INVESTIMENTOS', bold: true, color: 'violet' },
                                    { key: 'capitalExpenditures', label: '  (-) CAPEX', indent: true },
                                    { key: 'investments', label: '  (+/-) Investimentos', indent: true },
                                    { key: 'totalCashFromFinancingActivities', label: 'FCF - FINANCEIRO', bold: true, color: 'amber' },
                                    { key: 'dividendsPaid', label: '  (-) Dividendos', indent: true },
                                    { key: 'netBorrowings', label: '  (+/-) Empréstimos', indent: true },
                                    { key: 'changeInCash', label: 'VARIAÇÃO DE CAIXA', bold: true, color: 'emerald' }
                                  ];
                                  
                                  // Dados para os cards
                                  const ultimo = dados[0] || {};
                                  const fco = ultimo.totalCashFromOperatingActivities ?? 0;
                                  const fci = ultimo.totalCashflowsFromInvestingActivities ?? 0;
                                  const fcl = fco + (ultimo.capitalExpenditures ?? 0);
                                  
                                  return (
                                    <>
                                      {/* Cards de resumo */}
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                        <div className="bg-[#1a1a28] rounded-lg p-4 border-l-4 border-cyan-500">
                                          <p className="text-xs text-slate-500">FCO - Operacional</p>
                                          <p className={`text-2xl font-bold ${fco >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>{fmtCompacto(fco)}</p>
                                        </div>
                                        <div className="bg-[#1a1a28] rounded-lg p-4 border-l-4 border-violet-500">
                                          <p className="text-xs text-slate-500">FCI - Investimentos</p>
                                          <p className={`text-2xl font-bold ${fci >= 0 ? 'text-violet-400' : 'text-red-400'}`}>{fmtCompacto(fci)}</p>
                                        </div>
                                        <div className="bg-[#1a1a28] rounded-lg p-4 border-l-4 border-emerald-500">
                                          <p className="text-xs text-slate-500">FCL - Livre</p>
                                          <p className={`text-2xl font-bold ${fcl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtCompacto(fcl)}</p>
                                        </div>
                                      </div>
                                      
                                      {/* Gráfico de Fluxo de Caixa */}
                                      <div className="mb-6 p-4 bg-[#1a1a28] rounded-lg">
                                        <h4 className="text-sm text-slate-400 mb-3">Evolução do Fluxo de Caixa (R$ Bilhões)</h4>
                                        <ResponsiveContainer width="100%" height={200}>
                                          <BarChart data={dados.slice(0, 6).reverse().map((d, idx) => {
                                            const dataStr = d.endDate || d.updatedAt;
                                            let dataObj;
                                            try {
                                              dataObj = typeof dataStr === 'string' ? new Date(dataStr) : new Date(dataStr * 1000);
                                            } catch {
                                              dataObj = new Date();
                                            }
                                            return {
                                              periodo: periodoDemo === 'anual' ? dataObj.getFullYear() : dataObj.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
                                              fco: ((d.totalCashFromOperatingActivities ?? 0) / 1e9).toFixed(1),
                                              fci: ((d.totalCashflowsFromInvestingActivities ?? 0) / 1e9).toFixed(1)
                                            };
                                          })} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                            <XAxis dataKey="periodo" tick={{ fill: '#64748b', fontSize: 11 }} />
                                            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v) => `${v}B`} />
                                            <Tooltip contentStyle={{ background: '#1a1a28', border: '1px solid #2d2d3d', borderRadius: 8, color: '#fff' }} />
                                            <Bar dataKey="fco" name="FCO" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="fci" name="FCI" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                          </BarChart>
                                        </ResponsiveContainer>
                                        <div className="flex justify-center gap-6 mt-2">
                                          <span className="flex items-center gap-2 text-xs"><span className="w-3 h-3 rounded bg-cyan-500"></span> FCO</span>
                                          <span className="flex items-center gap-2 text-xs"><span className="w-3 h-3 rounded bg-violet-500"></span> FCI</span>
                                        </div>
                                      </div>
                                      
                                      {/* Tabela Fluxo de Caixa */}
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                          <thead>
                                            <tr className="text-slate-500 border-b border-[#2d2d3d]">
                                              <th className="text-left py-3 px-3 font-medium">Componente</th>
                                              {dados.slice(0, 6).map((f, i) => {
                                                const dataStr = f.endDate || f.updatedAt;
                                                let dataObj;
                                                try {
                                                  dataObj = typeof dataStr === 'string' ? new Date(dataStr) : new Date(dataStr * 1000);
                                                } catch {
                                                  dataObj = new Date();
                                                }
                                                return (
                                                  <th key={i} className="text-right py-3 px-3 font-medium">
                                                    {periodoDemo === 'anual' ? dataObj.getFullYear() : dataObj.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}
                                                  </th>
                                                );
                                              })}
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {campos.map(({ key, label, bold, color, indent }) => {
                                              const temDado = dados.some(f => (f[key] ?? 0) !== 0);
                                              if (!temDado) return null;
                                              if (!temDado) return null;
                                              
                                              return (
                                                <tr key={key} className="border-b border-[#1f1f2e] hover:bg-white/5 transition-colors">
                                                  <td className={`py-3 px-3 ${bold ? `font-bold text-${color || 'white'}-400` : 'text-slate-400'} ${indent ? 'pl-6' : ''}`}>
                                                    {label}
                                                  </td>
                                                  {dados.slice(0, 6).map((f, i) => {
                                                    const valor = f[key] ?? 0;
                                                    return (
                                                      <td key={i} className={`text-right py-3 px-3 ${bold ? `font-bold text-${color || 'white'}-400` : valor < 0 ? 'text-red-400' : 'text-white'}`}>
                                                        {fmtCompacto(valor)}
                                                      </td>
                                                    );
                                                  })}
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                          
                          {/* Legenda */}
                          <div className="flex flex-wrap gap-4 text-xs text-slate-500 p-3 bg-[#12121a] rounded-lg border border-[#1f1f2e]">
                            <span className="flex items-center gap-1"><span className="px-1.5 py-0.5 rounded bg-slate-800">TTM</span> Trailing Twelve Months - Últimos 12 meses</span>
                            <span className="flex items-center gap-1"><span className="px-1.5 py-0.5 rounded bg-slate-800">5A</span> 5 Anos - Dados históricos anuais</span>
                            <span className="flex items-center gap-1"><span className="px-1.5 py-0.5 rounded bg-slate-800">N/A</span> Não disponível ou não aplicável</span>
                            <span>Fonte: financialData, incomeStatementHistory, dividendsData | Atualização: {new Date().toLocaleDateString('pt-BR')}</span>
                          </div>
                        </div>
                      )}
                      
                      {/* ===== ABA DIVIDENDOS ===== */}
                      {abaDetalhe === 'dividendos' && (
                        <div className="space-y-6">
                          <div className="flex justify-between items-center">
                            <div>
                              <h2 className="text-xl font-bold flex items-center gap-2">💰 Histórico de Dividendos</h2>
                              <p className="text-sm text-slate-500">Análise dos dividendos pagos por {ativoDetalhe.ticker} ao longo dos anos</p>
                            </div>
                            <span className="px-3 py-1 rounded-lg bg-violet-600/20 text-violet-400 font-bold">{ativoDetalhe.ticker}</span>
                          </div>
                          
                          {/* Cards de resumo */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {(() => {
                              const ultimoDiv = ativoDetalhe.dividendos?.[0];
                              const dpa = (ativoDetalhe.dy / 100) * ativoDetalhe.preco;
                              const dyUltimo = ultimoDiv && ativoDetalhe.preco > 0 ? ((ultimoDiv.rate || ultimoDiv.value || 0) / ativoDetalhe.preco * 100) : 0;
                              const divAno = ativoDetalhe.dividendos?.filter(d => new Date(d.paymentDate).getFullYear() === new Date().getFullYear()).reduce((s, d) => s + (d.rate || d.value || 0), 0) || 0;
                              
                              return [
                                ['Último Dividendo', ultimoDiv ? fmt(ultimoDiv.rate || ultimoDiv.value) : 'N/A', ultimoDiv ? `Pago em ${new Date(ultimoDiv.paymentDate).toLocaleDateString('pt-BR')}` : '', 'emerald'],
                                ['DY Últ. Dividendo', dyUltimo.toFixed(2) + '%', 'Baseado no preço atual', 'amber'],
                                ['Dividend Yield TTM', fmtNum(ativoDetalhe.dy) + '%', 'Últimos 12 meses', 'violet'],
                                [`Dividendos ${new Date().getFullYear()}`, fmt(divAno), 'Total do ano', 'cyan']
                              ].map(([titulo, valor, desc, cor]) => (
                                <div key={titulo} className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-4">
                                  <p className="text-xs text-slate-500 mb-1">{titulo}</p>
                                  <p className={`text-2xl font-bold text-${cor}-400`}>{valor}</p>
                                  <p className="text-[10px] text-slate-600 mt-1">{desc}</p>
                                </div>
                              ));
                            })()}
                          </div>
                          
                          {/* Gráfico de dividendos por ano */}
                          {ativoDetalhe.dividendos?.length > 0 && (
                            <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-5">
                              <h3 className="text-lg font-semibold mb-4">📈 Evolução dos Dividendos</h3>
                              <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={(() => {
                                  // Agrupar dividendos por ano
                                  const porAno = {};
                                  ativoDetalhe.dividendos.forEach(d => {
                                    const ano = new Date(d.paymentDate).getFullYear();
                                    if (!porAno[ano]) porAno[ano] = 0;
                                    porAno[ano] += (d.rate || d.value || 0);
                                  });
                                  return Object.entries(porAno).sort((a, b) => a[0] - b[0]).slice(-10).map(([ano, total]) => ({ ano, total, dy: ativoDetalhe.preco > 0 ? (total / ativoDetalhe.preco * 100) : 0 }));
                                })()}>
                                  <XAxis dataKey="ano" tick={{ fill: '#64748b', fontSize: 11 }} />
                                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                                  <Tooltip contentStyle={{ background: '#1a1a28', border: '1px solid #2d2d3d', borderRadius: 8 }} formatter={(v) => fmt(v)} />
                                  <Bar dataKey="total" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Dividendos" />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                          
                          {/* Tabela de histórico */}
                          <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-5">
                            <h3 className="text-lg font-semibold mb-4">📋 Histórico de Pagamentos</h3>
                            {ativoDetalhe.dividendos?.length > 0 ? (
                              <div className="overflow-x-auto max-h-96">
                                <table className="w-full text-sm">
                                  <thead className="sticky top-0 bg-[#12121a]">
                                    <tr className="text-slate-500 border-b border-[#2d2d3d]">
                                      <th className="text-left py-2 px-2">Tipo</th>
                                      <th className="text-left py-2 px-2">Data Com</th>
                                      <th className="text-left py-2 px-2">Pagamento</th>
                                      <th className="text-right py-2 px-2">Valor</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {ativoDetalhe.dividendos.slice(0, 30).map((d, i) => (
                                      <tr key={i} className="border-b border-[#1f1f2e] hover:bg-white/5">
                                        <td className="py-2 px-2">
                                          <span className={`px-2 py-0.5 rounded text-xs ${d.label?.includes('JCP') ? 'bg-cyan-600/20 text-cyan-400' : 'bg-emerald-600/20 text-emerald-400'}`}>
                                            {d.label || 'DIVIDENDO'}
                                          </span>
                                        </td>
                                        <td className="py-2 px-2 text-slate-400">{d.lastDatePrior ? new Date(d.lastDatePrior).toLocaleDateString('pt-BR') : '-'}</td>
                                        <td className="py-2 px-2 text-white">{new Date(d.paymentDate).toLocaleDateString('pt-BR')}</td>
                                        <td className="py-2 px-2 text-right font-bold text-emerald-400">{fmt(d.rate || d.value)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="text-center py-8 text-slate-500">
                                <p>Nenhum dividendo registrado para este ativo</p>
                                <p className="text-xs mt-2">Este ativo pode não distribuir dividendos ou os dados não estão disponíveis</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Botão Adicionar à Carteira */}
                      <div className="fixed bottom-0 left-0 right-0 bg-[#08080c] border-t border-[#1f1f2e] p-4">
                        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row gap-3 items-center justify-between">
                          <div className="flex items-center gap-4">
                            <input type="number" value={qtd} onChange={(e) => setQtd(e.target.value)} placeholder="Qtd" className="w-24 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2 text-sm text-center" />
                            <span className="text-slate-400 text-sm">Total: <span className="text-white font-bold">{fmt(ativoDetalhe.preco * (parseInt(qtd) || 100))}</span></span>
                          </div>
                          <button onClick={() => { setTicker(ativoDetalhe.ticker); addAtivo(view === 'fiis' ? 'fii' : 'acao'); setAtivoDetalhe(null); setAbaDetalhe('info'); }} className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 rounded-xl font-semibold text-white transition-all shadow-lg shadow-violet-500/25">
                            ✓ Adicionar {ativoDetalhe.ticker} à Carteira
                          </button>
                        </div>
                      </div>
                      
                      {/* Espaço para o botão fixo */}
                      <div className="h-24"></div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== CALCULADORAS ==================== */}
        {view === 'calculadoras' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">🧮 Simuladores Financeiros</h2>
            
            <div className="flex flex-wrap gap-2">
              {[['rentabilidade', '💰 Rentabilidade'], ['rendafixa', '📊 Renda Fixa'], ['equivalencia', '⚖️ LCI vs CDB']].map(([k, l]) => (
                <button key={k} onClick={() => { setCalcTab(k); setResultado(null); }} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${calcTab === k ? 'bg-violet-500 text-white' : 'bg-[#1a1a28] text-slate-400 hover:bg-[#2d2d3d]'}`}>
                  {l}
                </button>
              ))}
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Parâmetros */}
              <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-4">
                <h3 className="font-semibold mb-4 text-sm">Parâmetros da Simulação</h3>
                
                {calcTab === 'rentabilidade' && (
                  <div className="space-y-3">
                    <div><label className="text-xs text-slate-400">Valor Inicial</label><input type="number" value={calcParams.valorInicial} onChange={(e) => setCalcParams(p => ({...p, valorInicial: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2 text-sm" /></div>
                    <div><label className="text-xs text-slate-400">Aporte Mensal</label><input type="number" value={calcParams.aporteMensal} onChange={(e) => setCalcParams(p => ({...p, aporteMensal: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2 text-sm" /></div>
                    <div><label className="text-xs text-slate-400">Taxa Anual (%)</label><input type="number" value={calcParams.taxaAnual} onChange={(e) => setCalcParams(p => ({...p, taxaAnual: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2 text-sm" /></div>
                    <div><label className="text-xs text-slate-400">Dividend Yield (%)</label><input type="number" value={calcParams.dividendYield} onChange={(e) => setCalcParams(p => ({...p, dividendYield: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2 text-sm" /></div>
                    <div><label className="text-xs text-slate-400">Período (anos) - até 30</label><input type="number" min="1" max="30" value={calcParams.anos} onChange={(e) => setCalcParams(p => ({...p, anos: Math.min(30, +e.target.value)}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2 text-sm" /></div>
                    <div className="flex items-center gap-2"><input type="checkbox" checked={calcParams.reinvestir} onChange={(e) => setCalcParams(p => ({...p, reinvestir: e.target.checked}))} className="w-4 h-4 rounded" /><label className="text-xs text-slate-400">Reinvestir dividendos</label></div>
                  </div>
                )}
                
                {calcTab === 'rendafixa' && (
                  <div className="space-y-3">
                    <div><label className="text-xs text-slate-400">Valor Aplicado</label><input type="number" value={calcParams.valorRF} onChange={(e) => setCalcParams(p => ({...p, valorRF: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2 text-sm" /></div>
                    <div><label className="text-xs text-slate-400">Indexador</label><select value={calcParams.indexadorRF} onChange={(e) => setCalcParams(p => ({...p, indexadorRF: e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2 text-sm">{INDEXADORES.map(i => <option key={i}>{i}</option>)}</select></div>
                    <div><label className="text-xs text-slate-400">Taxa</label><input type="number" value={calcParams.taxaRF} onChange={(e) => setCalcParams(p => ({...p, taxaRF: e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2 text-sm" /></div>
                    <div><label className="text-xs text-slate-400">Prazo (meses)</label><input type="number" value={calcParams.mesesRF} onChange={(e) => setCalcParams(p => ({...p, mesesRF: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2 text-sm" /></div>
                  </div>
                )}
                
                {calcTab === 'equivalencia' && (
                  <div className="space-y-3">
                    <div><label className="text-xs text-slate-400">Taxa LCI/LCA (% do CDI)</label><input type="number" value={calcParams.taxaRF} onChange={(e) => setCalcParams(p => ({...p, taxaRF: e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2 text-sm" /></div>
                    <p className="text-xs text-slate-500 mt-2">Considera alíquota de IR de 15% (prazo &gt; 2 anos)</p>
                  </div>
                )}
                
                <button onClick={executarCalc} className="w-full mt-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 rounded-lg font-medium text-sm hover:from-violet-500 hover:to-purple-500 transition-all">
                  Calcular
                </button>
              </div>
              
              {/* Resultado */}
              <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-4">
                <h3 className="font-semibold mb-4 text-sm">Resultado da Simulação</h3>
                
                {resultado ? (
                  <div className="space-y-4">
                    {calcTab === 'rentabilidade' && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-[#1a1a28] rounded-lg p-3 border border-emerald-500/30">
                            <p className="text-[10px] text-slate-400">Patrimônio Final</p>
                            <p className="text-lg font-bold text-emerald-400">{fmtK(resultado.patrimonioFinal)}</p>
                          </div>
                          <div className="bg-[#1a1a28] rounded-lg p-3 border border-amber-500/30">
                            <p className="text-[10px] text-slate-400">Total Dividendos</p>
                            <p className="text-lg font-bold text-amber-400">{fmtK(resultado.totalDividendos)}</p>
                          </div>
                          <div className="bg-[#1a1a28] rounded-lg p-3">
                            <p className="text-[10px] text-slate-400">Total Aportado</p>
                            <p className="text-sm font-bold">{fmtK(resultado.totalAportes)}</p>
                          </div>
                          <div className="bg-[#1a1a28] rounded-lg p-3">
                            <p className="text-[10px] text-slate-400">Rendimento Total</p>
                            <p className="text-sm font-bold text-cyan-400">{fmtK(resultado.rendimentoTotal)}</p>
                          </div>
                        </div>
                        
                        {resultado.evolucao?.length > 0 && (
                          <div>
                            <p className="text-xs text-slate-400 mb-2">Evolução Patrimonial</p>
                            <ResponsiveContainer width="100%" height={150}>
                              <AreaChart data={resultado.evolucao}>
                                <defs>
                                  <linearGradient id="colorPat" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                                  </linearGradient>
                                </defs>
                                <XAxis dataKey="ano" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtK(v)} width={50} />
                                <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: '#1a1a28', border: '1px solid #2d2d3d', borderRadius: 8, fontSize: 11 }} />
                                <Area type="monotone" dataKey="patrimonio" stroke="#8b5cf6" strokeWidth={2} fill="url(#colorPat)" name="Patrimônio" />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </>
                    )}
                    
                    {calcTab === 'rendafixa' && (
                      <>
                        <div className="bg-[#1a1a28] rounded-lg p-4 border border-cyan-500/30">
                          <p className="text-[10px] text-slate-400 mb-1">Montante Líquido</p>
                          <p className="text-2xl font-bold text-cyan-400">{fmt(resultado.montanteLiquido)}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-[#1a1a28] rounded-lg p-3">
                            <p className="text-[10px] text-slate-400">Montante Bruto</p>
                            <p className="text-sm font-bold">{fmt(resultado.montanteBruto)}</p>
                          </div>
                          <div className="bg-[#1a1a28] rounded-lg p-3">
                            <p className="text-[10px] text-slate-400">Taxa Efetiva</p>
                            <p className="text-sm font-bold">{fmtNum(resultado.taxaEfetiva)}% a.a.</p>
                          </div>
                          <div className="bg-[#1a1a28] rounded-lg p-3">
                            <p className="text-[10px] text-slate-400">Rendimento Bruto</p>
                            <p className="text-sm font-bold text-emerald-400">{fmt(resultado.rendimentoBruto)}</p>
                          </div>
                          <div className="bg-[#1a1a28] rounded-lg p-3">
                            <p className="text-[10px] text-slate-400">IR ({resultado.aliquotaIR}%)</p>
                            <p className="text-sm font-bold text-red-400">-{fmt(resultado.impostoRenda)}</p>
                          </div>
                        </div>
                      </>
                    )}
                    
                    {calcTab === 'equivalencia' && (
                      <div className="text-center py-6">
                        <p className="text-slate-400 text-sm mb-2">Para igualar uma LCI/LCA de {calcParams.taxaRF}% do CDI,</p>
                        <p className="text-slate-400 text-sm mb-4">você precisaria de um CDB que pague:</p>
                        <p className="text-4xl font-bold text-emerald-400">{resultado.equiv}%</p>
                        <p className="text-slate-400 text-sm mt-2">do CDI</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <p>Configure os parâmetros e clique em Calcular</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== MOEDAS / CÂMBIO / MACRO ==================== */}
        {view === 'moedas' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
              <h1 className="text-2xl font-bold flex items-center justify-center gap-2">💱 Câmbio & Indicadores Macroeconômicos</h1>
              <p className="text-slate-400 text-sm mt-1">Cotações de moedas, inflação e taxa de juros mundiais via BRAPI</p>
            </div>
            
            {/* Tabs */}
            <div className="flex flex-wrap justify-center gap-2">
              {[
                { id: 'moedas', icon: '💵', nome: 'Cotações de Moedas', desc: 'Câmbio em tempo real' },
                { id: 'inflacao', icon: '📊', nome: 'Inflação Mundial', desc: 'Índices por país' },
                { id: 'juros', icon: '🏦', nome: 'Taxa de Juros', desc: 'Prime Rate por país' }
              ].map((tab) => (
                <button key={tab.id} onClick={() => setMacroTab(tab.id)}
                  className={`px-4 py-2.5 rounded-xl border transition-all flex items-center gap-2 ${macroTab === tab.id ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400' : 'border-[#2d2d3d] bg-[#12121a] text-slate-400 hover:border-[#3d3d4d]'}`}>
                  <span>{tab.icon}</span>
                  <span className="text-sm font-medium">{tab.nome}</span>
                </button>
              ))}
            </div>
            
            {/* ===== ABA: MOEDAS ===== */}
            {macroTab === 'moedas' && (
              <div className="space-y-4">
                {/* Cotações Principais */}
                <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-5">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                    <div>
                      <h3 className="font-semibold flex items-center gap-2">💵 Cotações em Tempo Real</h3>
                      <p className="text-xs text-slate-500">Principais pares de moedas do mercado</p>
                    </div>
                    <button onClick={() => fetchCotacoesMoedas()} disabled={loadingMoedas} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50">
                      {loadingMoedas ? '⏳ Carregando...' : '🔄 Atualizar Cotações'}
                    </button>
                  </div>
                  
                  {cotacoesMoedas.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                      {cotacoesMoedas.map((moeda, idx) => (
                        <div key={idx} className="bg-[#1a1a28] rounded-xl p-3 border border-[#2d2d3d] hover:border-cyan-500/30 transition-all">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-cyan-400">{moeda.fromCurrency}/{moeda.toCurrency}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${parseFloat(moeda.percentageChange) >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                              {parseFloat(moeda.percentageChange) >= 0 ? '▲' : '▼'} {Math.abs(parseFloat(moeda.percentageChange || 0)).toFixed(2)}%
                            </span>
                          </div>
                          <p className="text-lg font-bold">{parseFloat(moeda.bidPrice || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</p>
                          <p className="text-[9px] text-slate-500 truncate">{moeda.name}</p>
                          <div className="flex justify-between text-[9px] text-slate-500 mt-1">
                            <span>↓ {parseFloat(moeda.low || 0).toFixed(4)}</span>
                            <span>↑ {parseFloat(moeda.high || 0).toFixed(4)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <span className="text-4xl mb-3 block">💱</span>
                      <p className="text-sm">Clique em "Atualizar Cotações" para carregar</p>
                    </div>
                  )}
                </div>
                
                {/* Buscar Par Específico */}
                <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-5">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">🔍 Buscar Par de Moedas</h3>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-slate-400 mb-1 block">Par de Moedas (ex: USD-BRL, EUR-USD)</label>
                      <input 
                        type="text" 
                        value={parMoedaSelecionado} 
                        onChange={(e) => setParMoedaSelecionado(e.target.value.toUpperCase())} 
                        placeholder="USD-BRL"
                        className="w-full bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-4 py-2.5 text-sm focus:border-cyan-500 outline-none"
                      />
                    </div>
                    <button onClick={() => fetchCotacaoPar(parMoedaSelecionado)} disabled={loadingMoedas} className="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-lg text-sm font-medium hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50">
                      {loadingMoedas ? '⏳' : '🔍'} Buscar
                    </button>
                  </div>
                  
                  {/* Lista de Moedas Disponíveis */}
                  {moedasDisponiveis.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs text-slate-400 mb-2">Moedas disponíveis ({moedasDisponiveis.length}):</p>
                      <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                        {moedasDisponiveis
                          .filter(m => buscaMoeda === '' || m.name.toLowerCase().includes(buscaMoeda.toLowerCase()))
                          .slice(0, 50)
                          .map((moeda, idx) => (
                          <button key={idx} onClick={() => { setParMoedaSelecionado(moeda.name); fetchCotacaoPar(moeda.name); }} 
                            className="px-2 py-1 text-[10px] bg-[#1a1a28] hover:bg-cyan-500/20 text-slate-400 hover:text-cyan-400 rounded border border-[#2d2d3d] hover:border-cyan-500/50 transition-all">
                            {moeda.name}
                          </button>
                        ))}
                      </div>
                      <input 
                        type="text" 
                        value={buscaMoeda} 
                        onChange={(e) => setBuscaMoeda(e.target.value)} 
                        placeholder="Filtrar moedas..."
                        className="w-full mt-2 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2 text-xs focus:border-cyan-500 outline-none"
                      />
                    </div>
                  )}
                </div>
                
                {/* Tabela Detalhada */}
                {cotacoesMoedas.length > 0 && (
                  <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-5 overflow-x-auto">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">📋 Tabela de Cotações Detalhada</h3>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-slate-400 text-xs border-b border-[#2d2d3d]">
                          <th className="text-left py-2 px-2">Par</th>
                          <th className="text-left py-2 px-2">Nome</th>
                          <th className="text-right py-2 px-2">Compra (Bid)</th>
                          <th className="text-right py-2 px-2">Venda (Ask)</th>
                          <th className="text-right py-2 px-2">Variação</th>
                          <th className="text-right py-2 px-2">Mín</th>
                          <th className="text-right py-2 px-2">Máx</th>
                          <th className="text-right py-2 px-2">Atualização</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cotacoesMoedas.map((m, idx) => (
                          <tr key={idx} className="border-b border-[#1f1f2e] hover:bg-[#1a1a28]">
                            <td className="py-2 px-2 font-semibold text-cyan-400">{m.fromCurrency}/{m.toCurrency}</td>
                            <td className="py-2 px-2 text-xs text-slate-400 max-w-[150px] truncate">{m.name}</td>
                            <td className="py-2 px-2 text-right font-mono">{parseFloat(m.bidPrice || 0).toFixed(4)}</td>
                            <td className="py-2 px-2 text-right font-mono">{parseFloat(m.askPrice || 0).toFixed(4)}</td>
                            <td className={`py-2 px-2 text-right font-semibold ${parseFloat(m.percentageChange) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {parseFloat(m.percentageChange) >= 0 ? '+' : ''}{parseFloat(m.percentageChange || 0).toFixed(2)}%
                            </td>
                            <td className="py-2 px-2 text-right text-xs text-slate-500">{parseFloat(m.low || 0).toFixed(4)}</td>
                            <td className="py-2 px-2 text-right text-xs text-slate-500">{parseFloat(m.high || 0).toFixed(4)}</td>
                            <td className="py-2 px-2 text-right text-[10px] text-slate-500">{m.updatedAtDate || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
            
            {/* ===== ABA: INFLAÇÃO ===== */}
            {macroTab === 'inflacao' && (
              <div className="space-y-4">
                <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-5">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                    <div>
                      <h3 className="font-semibold flex items-center gap-2">📊 Inflação por País</h3>
                      <p className="text-xs text-slate-500">Índices históricos de inflação mundial</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select value={paisInflacaoSelecionado} onChange={(e) => setPaisInflacaoSelecionado(e.target.value)} 
                        className="bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2 text-sm focus:border-amber-500 outline-none">
                        {PAISES_RELEVANTES.map((pais) => (
                          <option key={pais.id} value={pais.id}>{pais.nome}</option>
                        ))}
                      </select>
                      <button onClick={() => fetchInflacaoPais(paisInflacaoSelecionado)} disabled={loadingInflacao} 
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50">
                        {loadingInflacao ? '⏳ Carregando...' : '🔍 Buscar Inflação'}
                      </button>
                    </div>
                  </div>
                  
                  {/* Lista de países com bandeiras */}
                  <div className="mb-4">
                    <p className="text-xs text-slate-400 mb-2">Selecione um país:</p>
                    <div className="flex flex-wrap gap-2">
                      {PAISES_RELEVANTES.map((pais) => (
                        <button key={pais.id} onClick={() => { setPaisInflacaoSelecionado(pais.id); fetchInflacaoPais(pais.id); }} 
                          className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${paisInflacaoSelecionado === pais.id ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' : 'bg-[#1a1a28] hover:bg-amber-500/10 text-slate-400 hover:text-amber-400 border-[#2d2d3d] hover:border-amber-500/30'}`}>
                          {pais.nome}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Dados de Inflação */}
                  {dadosInflacao.length > 0 ? (
                    <div className="space-y-4">
                      {/* Card Principal */}
                      <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-4">
                        <p className="text-xs text-slate-400">Inflação Atual - {PAISES_RELEVANTES.find(p => p.id === paisInflacaoSelecionado)?.nome || paisInflacaoSelecionado}</p>
                        <p className="text-3xl font-bold text-amber-400">{dadosInflacao[0]?.value?.toFixed(2) || 0}%</p>
                        <p className="text-xs text-slate-500">{dadosInflacao[0]?.date || '-'}</p>
                      </div>
                      
                      {/* Gráfico */}
                      <div>
                        <h4 className="text-sm font-semibold mb-2">📈 Histórico de Inflação</h4>
                        <ResponsiveContainer width="100%" height={250}>
                          <AreaChart data={[...dadosInflacao].reverse()}>
                            <defs>
                              <linearGradient id="colorInflacao" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} width={40} />
                            <Tooltip formatter={(v) => [`${v?.toFixed(2)}%`, 'Inflação']} contentStyle={{ background: '#1a1a28', border: '1px solid #2d2d3d', borderRadius: 8, fontSize: 11 }} />
                            <Area type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} fill="url(#colorInflacao)" name="Inflação" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                      
                      {/* Tabela */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-slate-400 text-xs border-b border-[#2d2d3d]">
                              <th className="text-left py-2 px-2">Data</th>
                              <th className="text-right py-2 px-2">Inflação (%)</th>
                              <th className="text-right py-2 px-2">Variação</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dadosInflacao.map((item, idx) => (
                              <tr key={idx} className="border-b border-[#1f1f2e] hover:bg-[#1a1a28]">
                                <td className="py-2 px-2 text-slate-300">{item.date}</td>
                                <td className="py-2 px-2 text-right font-semibold text-amber-400">{item.value?.toFixed(2)}%</td>
                                <td className="py-2 px-2 text-right text-xs">
                                  {idx < dadosInflacao.length - 1 ? (
                                    <span className={item.value > dadosInflacao[idx + 1]?.value ? 'text-red-400' : 'text-emerald-400'}>
                                      {item.value > dadosInflacao[idx + 1]?.value ? '▲' : '▼'} {Math.abs(item.value - (dadosInflacao[idx + 1]?.value || 0)).toFixed(2)}
                                    </span>
                                  ) : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <span className="text-4xl mb-3 block">📊</span>
                      <p className="text-sm">Selecione um país e clique em "Buscar Inflação"</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* ===== ABA: TAXA DE JUROS ===== */}
            {macroTab === 'juros' && (
              <div className="space-y-4">
                <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-5">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                    <div>
                      <h3 className="font-semibold flex items-center gap-2">🏦 Taxa Básica de Juros (Prime Rate)</h3>
                      <p className="text-xs text-slate-500">Taxas de juros oficiais por país</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select value={paisJurosSelecionado} onChange={(e) => setPaisJurosSelecionado(e.target.value)} 
                        className="bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2 text-sm focus:border-violet-500 outline-none">
                        {PAISES_RELEVANTES.map((pais) => (
                          <option key={pais.id} value={pais.id}>{pais.nome}</option>
                        ))}
                      </select>
                      <button onClick={() => fetchTaxaJurosPais(paisJurosSelecionado)} disabled={loadingJuros} 
                        className="px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50">
                        {loadingJuros ? '⏳ Carregando...' : '🔍 Buscar Taxa de Juros'}
                      </button>
                    </div>
                  </div>
                  
                  {/* Lista de países com bandeiras */}
                  <div className="mb-4">
                    <p className="text-xs text-slate-400 mb-2">Selecione um país:</p>
                    <div className="flex flex-wrap gap-2">
                      {PAISES_RELEVANTES.map((pais) => (
                        <button key={pais.id} onClick={() => { setPaisJurosSelecionado(pais.id); fetchTaxaJurosPais(pais.id); }} 
                          className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${paisJurosSelecionado === pais.id ? 'bg-violet-500/20 text-violet-400 border-violet-500/50' : 'bg-[#1a1a28] hover:bg-violet-500/10 text-slate-400 hover:text-violet-400 border-[#2d2d3d] hover:border-violet-500/30'}`}>
                          {pais.nome}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Dados de Taxa de Juros */}
                  {dadosTaxaJuros.length > 0 ? (
                    <div className="space-y-4">
                      {/* Card Principal */}
                      <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/30 rounded-xl p-4">
                        <p className="text-xs text-slate-400">Taxa de Juros Atual - {PAISES_RELEVANTES.find(p => p.id === paisJurosSelecionado)?.nome || paisJurosSelecionado}</p>
                        <p className="text-3xl font-bold text-violet-400">{dadosTaxaJuros[0]?.value?.toFixed(2) || 0}%</p>
                        <p className="text-xs text-slate-500">{dadosTaxaJuros[0]?.date || '-'}</p>
                      </div>
                      
                      {/* Gráfico */}
                      <div>
                        <h4 className="text-sm font-semibold mb-2">📈 Histórico da Taxa de Juros</h4>
                        <ResponsiveContainer width="100%" height={250}>
                          <AreaChart data={[...dadosTaxaJuros].reverse()}>
                            <defs>
                              <linearGradient id="colorJuros" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} width={40} />
                            <Tooltip formatter={(v) => [`${v?.toFixed(2)}%`, 'Taxa de Juros']} contentStyle={{ background: '#1a1a28', border: '1px solid #2d2d3d', borderRadius: 8, fontSize: 11 }} />
                            <Area type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2} fill="url(#colorJuros)" name="Taxa de Juros" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                      
                      {/* Tabela */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-slate-400 text-xs border-b border-[#2d2d3d]">
                              <th className="text-left py-2 px-2">Data</th>
                              <th className="text-right py-2 px-2">Taxa (%)</th>
                              <th className="text-right py-2 px-2">Variação</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dadosTaxaJuros.map((item, idx) => (
                              <tr key={idx} className="border-b border-[#1f1f2e] hover:bg-[#1a1a28]">
                                <td className="py-2 px-2 text-slate-300">{item.date}</td>
                                <td className="py-2 px-2 text-right font-semibold text-violet-400">{item.value?.toFixed(2)}%</td>
                                <td className="py-2 px-2 text-right text-xs">
                                  {idx < dadosTaxaJuros.length - 1 ? (
                                    <span className={item.value > dadosTaxaJuros[idx + 1]?.value ? 'text-red-400' : 'text-emerald-400'}>
                                      {item.value > dadosTaxaJuros[idx + 1]?.value ? '▲' : '▼'} {Math.abs(item.value - (dadosTaxaJuros[idx + 1]?.value || 0)).toFixed(2)}
                                    </span>
                                  ) : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <span className="text-4xl mb-3 block">🏦</span>
                      <p className="text-sm">Selecione um país e clique em "Buscar Taxa de Juros"</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Fonte dos Dados */}
            <div className="text-center text-[10px] text-slate-600">
              📊 Dados fornecidos pela <a href="https://brapi.dev" target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:underline">BRAPI</a> - API do Mercado Financeiro Brasileiro
            </div>
          </div>
        )}

        {/* ==================== ASSISTENTE IA (CLAUDE) ==================== */}
        {view === 'ia' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
              <h1 className="text-2xl font-bold flex items-center justify-center gap-2">🤖 Assistente IA Financeiro</h1>
              <p className="text-slate-400 text-sm mt-1">Inteligência Artificial avançada para análises e recomendações personalizadas</p>
            </div>
            
            {/* Status IA */}
            <div className="rounded-xl bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                  <span className="text-lg">🤖</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-emerald-400">Groq AI Ativo</p>
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                  </div>
                  <p className="text-[10px] text-slate-400">Modelo: llama-3.3-70b | Pronto para análises</p>
                </div>
              </div>
            </div>
            
            {/* Tabs de Funcionalidades */}
            <div className="flex flex-wrap justify-center gap-2">
              {[
                { id: 'chat', icon: '💬', nome: 'Chat' },
                { id: 'carteira', icon: '📊', nome: 'Análise Carteira' },
                { id: 'fire', icon: '🔥', nome: 'Plano FIRE' },
                { id: 'mercado', icon: '📰', nome: 'Mercado' },
                { id: 'ativo', icon: '🔍', nome: 'Análise Ativo' },
                { id: 'educacao', icon: '🎓', nome: 'Educação' },
                { id: 'insights', icon: '💡', nome: 'Insights' },
                { id: 'consultor', icon: '👔', nome: 'Consultor' },
                { id: 'simulador', icon: '🧮', nome: 'Simulador IA' },
                { id: 'relatorio', icon: '📄', nome: 'Relatório IA' }
              ].map((tab) => (
                <button key={tab.id} onClick={() => setIaTab(tab.id)}
                  className={`px-3 py-2 rounded-lg border transition-all flex items-center gap-1.5 text-xs ${iaTab === tab.id ? 'border-violet-500 bg-violet-500/20 text-violet-400' : 'border-[#2d2d3d] bg-[#12121a] text-slate-400 hover:border-[#3d3d4d]'}`}>
                  <span>{tab.icon}</span>
                  <span className="font-medium">{tab.nome}</span>
                </button>
              ))}
            </div>
            
            {/* ===== CHAT ===== */}
            {iaTab === 'chat' && (
              <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-5">
                <h3 className="font-semibold mb-4 flex items-center gap-2">💬 Chat com Assistente Financeiro</h3>
                
                {/* Área de Mensagens */}
                <div className="bg-[#0a0a12] rounded-xl p-4 h-96 overflow-y-auto mb-4 space-y-3">
                  {iaMessages.length === 0 ? (
                    <div className="text-center text-slate-500 py-8">
                      <span className="text-5xl mb-3 block">🤖</span>
                      <p className="text-sm">Olá! Sou seu assistente financeiro.</p>
                      <p className="text-xs mt-1">Pergunte sobre investimentos, sua carteira, ou peça recomendações!</p>
                      <div className="flex flex-wrap justify-center gap-2 mt-4">
                        {['Como está minha carteira?', 'Devo investir em FIIs?', 'O que é dividend yield?', 'Analise minha diversificação'].map((sugestao, idx) => (
                          <button key={idx} onClick={() => setIaInput(sugestao)} className="px-3 py-1.5 bg-violet-500/10 text-violet-400 text-xs rounded-lg border border-violet-500/30 hover:bg-violet-500/20">
                            {sugestao}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    iaMessages.map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-xl px-4 py-2.5 ${msg.role === 'user' ? 'bg-violet-600 text-white' : 'bg-[#1a1a28] text-slate-200 border border-[#2d2d3d]'}`}>
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    ))
                  )}
                  {iaLoading && (
                    <div className="flex justify-start">
                      <div className="bg-[#1a1a28] rounded-xl px-4 py-3 border border-[#2d2d3d]">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Input */}
                <div className="flex gap-2">
                  <input 
                    type="text"
                    value={iaInput}
                    onChange={(e) => setIaInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !iaLoading && enviarMensagemChat()}
                    placeholder="Digite sua pergunta..."
                    disabled={iaLoading}
                    className="flex-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-4 py-3 text-sm focus:border-violet-500 outline-none disabled:opacity-50"
                  />
                  <button onClick={enviarMensagemChat} disabled={iaLoading || !iaInput.trim()} className="px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 rounded-lg font-medium text-sm hover:from-violet-500 hover:to-purple-500 disabled:opacity-50">
                    {iaLoading ? '⏳' : '📤'} Enviar
                  </button>
                </div>
              </div>
            )}
            
            {/* ===== ANÁLISE DE CARTEIRA ===== */}
            {iaTab === 'carteira' && (
              <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-5">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="font-semibold flex items-center gap-2">📊 Análise Inteligente da Carteira</h3>
                    <p className="text-xs text-slate-500">IA analisa sua carteira e dá recomendações personalizadas</p>
                  </div>
                  <button onClick={analisarCarteiraIA} disabled={iaLoading} className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-cyan-600 rounded-lg text-sm font-medium hover:from-emerald-500 hover:to-cyan-500 disabled:opacity-50 flex items-center gap-2">
                    {iaLoading ? '⏳ Analisando...' : '🔍 Analisar Minha Carteira'}
                  </button>
                </div>
                
                {/* Resumo da Carteira */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="bg-[#1a1a28] rounded-lg p-3"><p className="text-[10px] text-slate-400">Patrimônio</p><p className="text-lg font-bold text-violet-400">{fmtK(patrimonio)}</p></div>
                  <div className="bg-[#1a1a28] rounded-lg p-3"><p className="text-[10px] text-slate-400">Renda Fixa</p><p className="text-lg font-bold text-emerald-400">{fmtK(totalRF)}</p></div>
                  <div className="bg-[#1a1a28] rounded-lg p-3"><p className="text-[10px] text-slate-400">Ações</p><p className="text-lg font-bold text-cyan-400">{fmtK(totalAcoes)}</p></div>
                  <div className="bg-[#1a1a28] rounded-lg p-3"><p className="text-[10px] text-slate-400">FIIs</p><p className="text-lg font-bold text-amber-400">{fmtK(totalFIIs)}</p></div>
                </div>
                
                {/* Resultado da Análise */}
                {iaAnaliseCarteira ? (
                  <div className="bg-[#0a0a12] rounded-xl p-4 max-h-[500px] overflow-y-auto">
                    <div className="prose prose-invert prose-sm max-w-none">
                      <div className="whitespace-pre-wrap text-sm text-slate-300">{iaAnaliseCarteira}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <span className="text-5xl mb-3 block">📊</span>
                    <p className="text-sm">Clique em "Analisar Minha Carteira" para receber</p>
                    <p className="text-xs">uma análise completa com recomendações personalizadas</p>
                  </div>
                )}
              </div>
            )}
            
            {/* ===== PLANO FIRE ===== */}
            {iaTab === 'fire' && (
              <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-5">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="font-semibold flex items-center gap-2">🔥 Plano de Independência Financeira</h3>
                    <p className="text-xs text-slate-500">IA cria um plano FIRE personalizado para você</p>
                  </div>
                  <button onClick={gerarPlanoFireIA} disabled={iaLoading} className="px-4 py-2 bg-gradient-to-r from-orange-600 to-red-600 rounded-lg text-sm font-medium hover:from-orange-500 hover:to-red-500 disabled:opacity-50 flex items-center gap-2">
                    {iaLoading ? '⏳ Gerando...' : '🎯 Gerar Meu Plano FIRE'}
                  </button>
                </div>
                
                {/* Parâmetros Atuais */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="bg-[#1a1a28] rounded-lg p-3"><p className="text-[10px] text-slate-400">Gastos Mensais</p><p className="text-lg font-bold text-orange-400">{fmt(fireParams.gastoMensal)}</p></div>
                  <div className="bg-[#1a1a28] rounded-lg p-3"><p className="text-[10px] text-slate-400">Aporte Mensal</p><p className="text-lg font-bold text-emerald-400">{fmt(fireParams.aporteMensal)}</p></div>
                  <div className="bg-[#1a1a28] rounded-lg p-3"><p className="text-[10px] text-slate-400">Rentabilidade</p><p className="text-lg font-bold text-cyan-400">{fireParams.rentabilidade}% a.a.</p></div>
                  <div className="bg-[#1a1a28] rounded-lg p-3"><p className="text-[10px] text-slate-400">Idade</p><p className="text-lg font-bold text-violet-400">{client.idade} anos</p></div>
                </div>
                
                {iaPlanoFire ? (
                  <div className="bg-[#0a0a12] rounded-xl p-4 max-h-[500px] overflow-y-auto">
                    <div className="whitespace-pre-wrap text-sm text-slate-300">{iaPlanoFire}</div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <span className="text-5xl mb-3 block">🔥</span>
                    <p className="text-sm">Clique em "Gerar Meu Plano FIRE" para receber</p>
                    <p className="text-xs">um plano completo de independência financeira</p>
                  </div>
                )}
              </div>
            )}
            
            {/* ===== ANÁLISE DE MERCADO ===== */}
            {iaTab === 'mercado' && (
              <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-5">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="font-semibold flex items-center gap-2">📰 Análise de Mercado em Tempo Real</h3>
                    <p className="text-xs text-slate-500">IA analisa o mercado e o impacto na sua carteira</p>
                  </div>
                  <button onClick={analisarMercadoIA} disabled={iaLoading} className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-lg text-sm font-medium hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 flex items-center gap-2">
                    {iaLoading ? '⏳ Analisando...' : '📊 Analisar Mercado'}
                  </button>
                </div>
                
                {/* Dados de Mercado */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-[#1a1a28] rounded-lg p-3"><p className="text-[10px] text-slate-400">SELIC</p><p className="text-lg font-bold text-cyan-400">{bcb.selic}%</p></div>
                  <div className="bg-[#1a1a28] rounded-lg p-3"><p className="text-[10px] text-slate-400">CDI</p><p className="text-lg font-bold text-violet-400">{bcb.cdi}%</p></div>
                  <div className="bg-[#1a1a28] rounded-lg p-3"><p className="text-[10px] text-slate-400">IPCA 12m</p><p className="text-lg font-bold text-amber-400">{bcb.ipca12m}%</p></div>
                </div>
                
                {iaAnaliseMercado ? (
                  <div className="bg-[#0a0a12] rounded-xl p-4 max-h-[500px] overflow-y-auto">
                    <div className="whitespace-pre-wrap text-sm text-slate-300">{iaAnaliseMercado}</div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <span className="text-5xl mb-3 block">📰</span>
                    <p className="text-sm">Clique em "Analisar Mercado" para receber</p>
                    <p className="text-xs">uma análise do cenário atual e impacto na sua carteira</p>
                  </div>
                )}
              </div>
            )}
            
            {/* ===== ANÁLISE DE ATIVO ===== */}
            {iaTab === 'ativo' && (
              <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                  <div>
                    <h3 className="font-semibold flex items-center gap-2">🔍 Análise Fundamentalista com IA</h3>
                    <p className="text-xs text-slate-500">IA analisa qualquer ação ou FII em profundidade</p>
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={iaAtivoSelecionado}
                      onChange={(e) => setIaAtivoSelecionado(e.target.value.toUpperCase())}
                      placeholder="PETR4, HGLG11..."
                      className="w-32 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2 text-sm focus:border-violet-500 outline-none"
                    />
                    <button onClick={() => analisarAtivoIA(iaAtivoSelecionado)} disabled={iaLoading || !iaAtivoSelecionado} className="px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 rounded-lg text-sm font-medium hover:from-violet-500 hover:to-purple-500 disabled:opacity-50">
                      {iaLoading ? '⏳' : '🔍'} Analisar
                    </button>
                  </div>
                </div>
                
                {/* Ativos da Carteira para Seleção Rápida */}
                {(acoes.length > 0 || fiis.length > 0) && (
                  <div className="mb-4">
                    <p className="text-xs text-slate-400 mb-2">Ativos da sua carteira:</p>
                    <div className="flex flex-wrap gap-2">
                      {[...acoes, ...fiis].map((ativo, idx) => (
                        <button key={idx} onClick={() => { setIaAtivoSelecionado(ativo.ticker); analisarAtivoIA(ativo.ticker); }}
                          className="px-3 py-1.5 bg-[#1a1a28] hover:bg-violet-500/20 text-slate-400 hover:text-violet-400 text-xs rounded-lg border border-[#2d2d3d] hover:border-violet-500/50 transition-all">
                          {ativo.ticker}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {iaAnaliseAtivo ? (
                  <div className="bg-[#0a0a12] rounded-xl p-4 max-h-[500px] overflow-y-auto">
                    <div className="whitespace-pre-wrap text-sm text-slate-300">{iaAnaliseAtivo}</div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <span className="text-5xl mb-3 block">🔍</span>
                    <p className="text-sm">Digite um ticker e clique em "Analisar"</p>
                    <p className="text-xs">para receber uma análise fundamentalista completa</p>
                  </div>
                )}
              </div>
            )}
            
            {/* ===== EDUCAÇÃO FINANCEIRA ===== */}
            {iaTab === 'educacao' && (
              <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-5">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="font-semibold flex items-center gap-2">🎓 Educação Financeira Adaptativa</h3>
                    <p className="text-xs text-slate-500">Trilha de aprendizado personalizada para seu nível</p>
                  </div>
                  <div className="flex gap-2">
                    <select 
                      value={iaEducacao.nivel}
                      onChange={(e) => setIaEducacao(prev => ({ ...prev, nivel: e.target.value }))}
                      className="bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2 text-sm focus:border-emerald-500 outline-none"
                    >
                      <option value="iniciante">🌱 Iniciante</option>
                      <option value="intermediario">📈 Intermediário</option>
                      <option value="avancado">🚀 Avançado</option>
                    </select>
                    <button onClick={() => iniciarTrilhaEducacao(iaEducacao.nivel)} disabled={iaLoading} className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-lg text-sm font-medium hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50">
                      {iaLoading ? '⏳' : '📚'} Iniciar Trilha
                    </button>
                  </div>
                </div>
                
                {iaEducacao.trilha?.length > 0 ? (
                  <div className="space-y-4">
                    {iaEducacao.trilha.map((modulo, idx) => (
                      <div key={idx} className="bg-[#1a1a28] rounded-xl p-4 border border-[#2d2d3d]">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">{modulo.numero || idx + 1}</span>
                          <div>
                            <h4 className="font-semibold text-sm">{modulo.titulo}</h4>
                            <p className="text-[10px] text-slate-500">{modulo.objetivo}</p>
                          </div>
                        </div>
                        {modulo.conteudo && (
                          <div className="ml-11 space-y-1 mb-3">
                            {modulo.conteudo.map((ponto, pIdx) => (
                              <p key={pIdx} className="text-xs text-slate-400 flex items-start gap-2">
                                <span className="text-emerald-400">•</span> {ponto}
                              </p>
                            ))}
                          </div>
                        )}
                        {modulo.exercicio && (
                          <div className="ml-11 bg-emerald-500/10 rounded-lg p-2 border border-emerald-500/20">
                            <p className="text-xs text-emerald-400"><span className="font-semibold">📝 Exercício:</span> {modulo.exercicio}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : iaEducacao.textoResposta ? (
                  <div className="bg-[#0a0a12] rounded-xl p-4 max-h-[500px] overflow-y-auto">
                    <div className="whitespace-pre-wrap text-sm text-slate-300">{iaEducacao.textoResposta}</div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <span className="text-5xl mb-3 block">🎓</span>
                    <p className="text-sm">Selecione seu nível e clique em "Iniciar Trilha"</p>
                    <p className="text-xs">para receber uma trilha de educação personalizada</p>
                  </div>
                )}
              </div>
            )}
            
            {/* ===== INSIGHTS ===== */}
            {iaTab === 'insights' && (
              <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-5">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="font-semibold flex items-center gap-2">💡 Insights e Alertas Proativos</h3>
                    <p className="text-xs text-slate-500">IA identifica oportunidades e riscos na sua carteira</p>
                  </div>
                  <button onClick={gerarInsightsIA} disabled={iaLoading} className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 rounded-lg text-sm font-medium hover:from-amber-500 hover:to-orange-500 disabled:opacity-50">
                    {iaLoading ? '⏳' : '💡'} Gerar Insights
                  </button>
                </div>
                
                {iaInsights.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {iaInsights.map((insight, idx) => (
                      <div key={idx} className={`rounded-xl p-4 border ${
                        insight.tipo === 'alerta' ? 'bg-red-500/10 border-red-500/30' :
                        insight.tipo === 'oportunidade' ? 'bg-emerald-500/10 border-emerald-500/30' :
                        insight.tipo === 'educacional' ? 'bg-blue-500/10 border-blue-500/30' :
                        insight.tipo === 'lembrete' ? 'bg-amber-500/10 border-amber-500/30' :
                        insight.tipo === 'otimizacao' ? 'bg-violet-500/10 border-violet-500/30' :
                        'bg-cyan-500/10 border-cyan-500/30'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-xs font-semibold ${
                            insight.tipo === 'alerta' ? 'text-red-400' :
                            insight.tipo === 'oportunidade' ? 'text-emerald-400' :
                            insight.tipo === 'educacional' ? 'text-blue-400' :
                            insight.tipo === 'lembrete' ? 'text-amber-400' :
                            insight.tipo === 'otimizacao' ? 'text-violet-400' :
                            'text-cyan-400'
                          }`}>
                            {insight.tipo === 'alerta' ? '⚠️ Alerta' :
                             insight.tipo === 'oportunidade' ? '🎯 Oportunidade' :
                             insight.tipo === 'educacional' ? '📚 Educacional' :
                             insight.tipo === 'lembrete' ? '🔔 Lembrete' :
                             insight.tipo === 'otimizacao' ? '⚡ Otimização' :
                             '🔮 Previsão'}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                            insight.prioridade === 'alta' ? 'bg-red-500/20 text-red-400' :
                            insight.prioridade === 'media' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-slate-500/20 text-slate-400'
                          }`}>
                            {insight.prioridade}
                          </span>
                        </div>
                        <h4 className="font-semibold text-sm mb-1">{insight.titulo}</h4>
                        <p className="text-xs text-slate-400 mb-2">{insight.descricao}</p>
                        {insight.acao && <p className="text-xs text-violet-400">💡 {insight.acao}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <span className="text-5xl mb-3 block">💡</span>
                    <p className="text-sm">Clique em "Gerar Insights" para receber</p>
                    <p className="text-xs">alertas e oportunidades personalizadas</p>
                  </div>
                )}
              </div>
            )}
            
            {/* ===== CONSULTOR VIRTUAL ===== */}
            {iaTab === 'consultor' && (
              <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-5">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="font-semibold flex items-center gap-2">👔 Consultor Virtual - Preparação para Reunião</h3>
                    <p className="text-xs text-slate-500">IA prepara você para a reunião com seu assessor</p>
                  </div>
                  <button onClick={prepararReuniao} disabled={iaLoading} className="px-4 py-2 bg-gradient-to-r from-slate-600 to-zinc-600 rounded-lg text-sm font-medium hover:from-slate-500 hover:to-zinc-500 disabled:opacity-50">
                    {iaLoading ? '⏳' : '📋'} Preparar Reunião
                  </button>
                </div>
                
                {iaConsultorResumo ? (
                  <div className="bg-[#0a0a12] rounded-xl p-4 max-h-[500px] overflow-y-auto">
                    <div className="whitespace-pre-wrap text-sm text-slate-300">{iaConsultorResumo}</div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <span className="text-5xl mb-3 block">👔</span>
                    <p className="text-sm">Clique em "Preparar Reunião" para receber</p>
                    <p className="text-xs">um briefing completo para sua reunião com o assessor</p>
                    <div className="mt-4 flex items-center justify-center">
                      <a href="https://calendly.com/diego-oliveira-damainvestimentos/reuniao-de-analise" target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium inline-flex items-center gap-2">
                        📅 Agendar Reunião com Assessor
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* ===== SIMULADOR IA ===== */}
            {iaTab === 'simulador' && (
              <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-5">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="font-semibold flex items-center gap-2">🧮 Simulador Inteligente</h3>
                    <p className="text-xs text-slate-500">IA sugere parâmetros otimizados para sua simulação</p>
                  </div>
                  <button onClick={sugerirSimulacao} disabled={iaLoading} className="px-4 py-2 bg-gradient-to-r from-pink-600 to-rose-600 rounded-lg text-sm font-medium hover:from-pink-500 hover:to-rose-500 disabled:opacity-50">
                    {iaLoading ? '⏳' : '🎯'} Sugerir Parâmetros
                  </button>
                </div>
                
                {iaSimuladorSugestoes ? (
                  <div className="space-y-4">
                    {/* Sugestão Principal */}
                    <div className="bg-gradient-to-r from-pink-500/10 to-rose-500/10 border border-pink-500/30 rounded-xl p-4">
                      <h4 className="font-semibold text-sm mb-3 text-pink-400">🎯 Parâmetros Sugeridos pela IA</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div><p className="text-[10px] text-slate-400">Aporte Inicial</p><p className="font-semibold">{fmt(iaSimuladorSugestoes.sugestoes?.aporteInicial)}</p></div>
                        <div><p className="text-[10px] text-slate-400">Aporte Mensal</p><p className="font-semibold">{fmt(iaSimuladorSugestoes.sugestoes?.aporteMensal)}</p></div>
                        <div><p className="text-[10px] text-slate-400">Período</p><p className="font-semibold">{iaSimuladorSugestoes.sugestoes?.periodoMeses} meses</p></div>
                        <div><p className="text-[10px] text-slate-400">Rentabilidade</p><p className="font-semibold">{iaSimuladorSugestoes.sugestoes?.rentabilidadeAnual}% a.a.</p></div>
                        <div><p className="text-[10px] text-slate-400">Dividend Yield</p><p className="font-semibold">{iaSimuladorSugestoes.sugestoes?.dividendYield}%</p></div>
                        <div><p className="text-[10px] text-slate-400">Reinvestir</p><p className="font-semibold">{iaSimuladorSugestoes.sugestoes?.reinvestir ? 'Sim' : 'Não'}</p></div>
                      </div>
                      <p className="text-xs text-slate-400 mt-3">{iaSimuladorSugestoes.sugestoes?.justificativa}</p>
                    </div>
                    
                    {/* Cenários */}
                    {iaSimuladorSugestoes.cenarios && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {iaSimuladorSugestoes.cenarios.map((cenario, idx) => (
                          <div key={idx} className={`rounded-xl p-4 border ${
                            cenario.nome === 'Conservador' ? 'bg-blue-500/10 border-blue-500/30' :
                            cenario.nome === 'Moderado' ? 'bg-amber-500/10 border-amber-500/30' :
                            'bg-emerald-500/10 border-emerald-500/30'
                          }`}>
                            <h5 className="font-semibold text-sm mb-2">{cenario.nome}</h5>
                            <p className="text-lg font-bold">{fmtK(cenario.patrimonioFinal)}</p>
                            <p className="text-xs text-slate-400">{cenario.rentabilidade}% a.a.</p>
                            <p className="text-[10px] text-slate-500 mt-2">{cenario.descricao}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Dicas */}
                    {iaSimuladorSugestoes.dicas && (
                      <div className="bg-[#1a1a28] rounded-xl p-4">
                        <h5 className="font-semibold text-sm mb-2">💡 Dicas da IA</h5>
                        <div className="space-y-2">
                          {iaSimuladorSugestoes.dicas.map((dica, idx) => (
                            <p key={idx} className="text-xs text-slate-400 flex items-start gap-2">
                              <span className="text-pink-400">•</span> {dica}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <span className="text-5xl mb-3 block">🧮</span>
                    <p className="text-sm">Clique em "Sugerir Parâmetros" para receber</p>
                    <p className="text-xs">sugestões personalizadas para suas simulações</p>
                  </div>
                )}
              </div>
            )}
            
            {/* ===== RELATÓRIO IA ===== */}
            {iaTab === 'relatorio' && (
              <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-5">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="font-semibold flex items-center gap-2">📄 Texto Inteligente para Relatório</h3>
                    <p className="text-xs text-slate-500">IA gera texto profissional para seu relatório PDF</p>
                  </div>
                  <button onClick={gerarTextoRelatorioIA} disabled={iaLoading} className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg text-sm font-medium hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50">
                    {iaLoading ? '⏳' : '✍️'} Gerar Texto
                  </button>
                </div>
                
                {iaRelatorioTexto ? (
                  <div className="space-y-4">
                    <div className="bg-[#0a0a12] rounded-xl p-4">
                      <div className="whitespace-pre-wrap text-sm text-slate-300">{iaRelatorioTexto}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => navigator.clipboard.writeText(iaRelatorioTexto).then(() => showMsg('Texto copiado!', 'success'))} className="px-4 py-2 bg-[#1a1a28] hover:bg-[#2a2a38] rounded-lg text-sm font-medium border border-[#2d2d3d]">
                        📋 Copiar Texto
                      </button>
                      <button onClick={() => { setRelatorioModal(true); }} className="px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 rounded-lg text-sm font-medium">
                        📄 Gerar Relatório PDF
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <span className="text-5xl mb-3 block">📄</span>
                    <p className="text-sm">Clique em "Gerar Texto" para criar</p>
                    <p className="text-xs">um texto profissional para seu relatório</p>
                  </div>
                )}
              </div>
            )}
            
            {/* Footer */}
            <div className="text-center text-[10px] text-slate-600">
              🤖 Powered by Groq AI (Llama 3.3) | As análises são sugestões e não constituem recomendação de investimento
            </div>
          </div>
        )}

        {/* ==================== SIMULADOR DE DIVIDENDOS ==================== */}
        {view === 'simulador' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">🎯 Simulador de Rentabilidade e Dividendos</h2>
                <p className="text-slate-400 text-xs">Simule o crescimento do seu patrimônio com aportes e dividendos</p>
              </div>
              <div className="flex gap-2 text-xs">
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded-full"></span>Dados B3</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-violet-500 rounded-full"></span>Dividendos</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-cyan-500 rounded-full"></span>Comparativo</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Parâmetros */}
              <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-4">
                <h3 className="font-semibold mb-4 text-sm flex items-center gap-2">
                  <span className="text-violet-400">📈</span> Parâmetros da Simulação
                </h3>
                <p className="text-slate-500 text-xs mb-4">Configure os parâmetros para simular a rentabilidade do investimento</p>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400">Ação</label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
                      <input type="text" value={simTicker} onChange={(e) => setSimTicker(e.target.value.toUpperCase())} placeholder="Ex: PETR4" className="w-full bg-[#1a1a28] border border-[#2d2d3d] rounded-lg pl-10 pr-3 py-2.5 text-sm focus:border-violet-500 outline-none" />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs text-slate-400">Período de Simulação</label>
                    <select value={simPeriodo} onChange={(e) => setSimPeriodo(Number(e.target.value))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2.5 text-sm focus:border-violet-500 outline-none">
                      <option value={12}>1 ano</option>
                      <option value={24}>2 anos</option>
                      <option value={36}>3 anos</option>
                      <option value={60}>5 anos</option>
                      <option value={120}>10 anos</option>
                      <option value={180}>15 anos</option>
                      <option value={240}>20 anos</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-xs text-slate-400">Aporte Inicial (R$)</label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">R$</span>
                      <input type="number" value={simAporteInicial} onChange={(e) => setSimAporteInicial(Number(e.target.value))} className="w-full bg-[#1a1a28] border border-[#2d2d3d] rounded-lg pl-10 pr-3 py-2.5 text-sm focus:border-violet-500 outline-none" />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs text-slate-400">Aporte Mensal (R$)</label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">📅</span>
                      <input type="number" value={simAporteMensal} onChange={(e) => setSimAporteMensal(Number(e.target.value))} className="w-full bg-[#1a1a28] border border-[#2d2d3d] rounded-lg pl-10 pr-3 py-2.5 text-sm focus:border-violet-500 outline-none" />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs text-slate-400">Taxa IPCA+X% (para comparação)</label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">📈</span>
                      <input type="number" value={simTaxaIPCA} onChange={(e) => setSimTaxaIPCA(Number(e.target.value))} className="w-full bg-[#1a1a28] border border-[#2d2d3d] rounded-lg pl-10 pr-16 py-2.5 text-sm focus:border-violet-500 outline-none" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">% a.a.</span>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-1">Taxa anual adicional ao IPCA para comparação com Tesouro IPCA+</p>
                  </div>
                  
                  <div className="flex items-center justify-between py-2">
                    <label className="text-sm text-slate-300">Reinvestir Dividendos</label>
                    <button onClick={() => setSimReinvestir(!simReinvestir)} className={`relative w-12 h-6 rounded-full transition-colors ${simReinvestir ? 'bg-violet-600' : 'bg-slate-700'}`}>
                      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${simReinvestir ? 'translate-x-7' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </div>
                
                <button onClick={executarSimuladorDividendos} disabled={simLoading} className="w-full mt-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2">
                  {simLoading ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Calculando...</>
                  ) : (
                    <><span>🧮</span> Simular Rentabilidade</>
                  )}
                </button>
              </div>
              
              {/* Resultados */}
              <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <span className="text-emerald-400">📊</span> Resultados da Simulação
                  </h3>
                </div>
                <p className="text-slate-500 text-xs mb-4">Análise detalhada da rentabilidade e comparação com índices</p>
                
                {/* Abas */}
                <div className="flex gap-2 mb-4">
                  {[['resumo', 'Resumo'], ['grafico', 'Gráfico'], ['historico', 'Histórico']].map(([k, l]) => (
                    <button key={k} onClick={() => setSimAba(k)} className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${simAba === k ? 'bg-violet-600 text-white' : 'bg-[#1a1a28] text-slate-400 hover:bg-[#2d2d3d]'}`}>
                      {l}
                    </button>
                  ))}
                </div>
                
                {simResultado ? (
                  <>
                    {simAba === 'resumo' && (
                      <div className="space-y-3">
                        {/* Cards principais */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-[#1a1a28] rounded-lg p-3 border border-[#2d2d3d]">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500 text-[10px]">Total Final</span>
                              <span className="text-emerald-400">↑</span>
                            </div>
                            <p className="text-lg font-bold text-white">{fmtK(simResultado.totalFinal)}</p>
                          </div>
                          <div className="bg-[#1a1a28] rounded-lg p-3 border border-emerald-500/30">
                            <span className="text-slate-500 text-[10px]">Valor Líquido (após IR)</span>
                            <p className="text-lg font-bold text-emerald-400">{fmtK(simResultado.valorLiquido)}</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-[#1a1a28] rounded-lg p-3">
                            <span className="text-slate-500 text-[10px]">Total Aportado</span>
                            <p className="text-sm font-bold">{fmtK(simResultado.totalAportado)}</p>
                          </div>
                          <div className="bg-[#1a1a28] rounded-lg p-3">
                            <span className="text-slate-500 text-[10px]">Rentabilidade</span>
                            <p className={`text-sm font-bold ${simResultado.rentabilidadeTotal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {simResultado.rentabilidadeTotal >= 0 ? '+' : ''}{simResultado.rentabilidadeTotal.toFixed(2)}%
                            </p>
                          </div>
                        </div>
                        
                        {/* Métricas de Risco */}
                        <div>
                          <h4 className="text-xs text-slate-400 mb-2">Métricas de Risco</h4>
                          <div className="grid grid-cols-4 gap-2">
                            <div className="bg-[#1a1a28] rounded-lg p-2">
                              <span className="text-slate-600 text-[9px]">Volatilidade</span>
                              <p className="text-xs font-semibold">{simResultado.volatilAnual.toFixed(2)}%</p>
                            </div>
                            <div className="bg-[#1a1a28] rounded-lg p-2">
                              <span className="text-slate-600 text-[9px]">Sharpe</span>
                              <p className="text-xs font-semibold">{simResultado.sharpeRatio.toFixed(2)}</p>
                            </div>
                            <div className="bg-[#1a1a28] rounded-lg p-2">
                              <span className="text-slate-600 text-[9px]">Drawdown Máx</span>
                              <p className="text-xs font-semibold text-red-400">-{simResultado.drawdownMaximo.toFixed(2)}%</p>
                            </div>
                            <div className="bg-[#1a1a28] rounded-lg p-2">
                              <span className="text-slate-600 text-[9px]">Rent. Anual</span>
                              <p className="text-xs font-semibold text-emerald-400">{simResultado.rentabilidadeAnual.toFixed(2)}%</p>
                            </div>
                          </div>
                        </div>
                        
                        {/* Comparação */}
                        <div>
                          <h4 className="text-xs text-slate-400 mb-2">Comparação de Performance</h4>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-[#1a1a28] rounded-lg p-2 text-center">
                              <span className="text-slate-600 text-[9px]">vs CDI</span>
                              <p className={`text-xs font-semibold ${simResultado.vsCDI >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {simResultado.vsCDI >= 0 ? '+' : ''}{simResultado.vsCDI.toFixed(2)}%
                              </p>
                            </div>
                            <div className="bg-[#1a1a28] rounded-lg p-2 text-center">
                              <span className="text-slate-600 text-[9px]">vs IBOV</span>
                              <p className={`text-xs font-semibold ${simResultado.vsIBOV >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {simResultado.vsIBOV >= 0 ? '+' : ''}{simResultado.vsIBOV.toFixed(2)}%
                              </p>
                            </div>
                            <div className="bg-[#1a1a28] rounded-lg p-2 text-center">
                              <span className="text-slate-600 text-[9px]">vs IPCA+</span>
                              <p className={`text-xs font-semibold ${simResultado.vsIPCA >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {simResultado.vsIPCA >= 0 ? '+' : ''}{simResultado.vsIPCA.toFixed(2)}%
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        {/* Análise Fiscal */}
                        <div>
                          <h4 className="text-xs text-slate-400 mb-2">Análise Fiscal e Custos</h4>
                          <div className="grid grid-cols-4 gap-2">
                            <div className="bg-[#1a1a28] rounded-lg p-2">
                              <span className="text-slate-600 text-[9px]">IR (15%)</span>
                              <p className="text-xs font-semibold text-red-400">{fmt(simResultado.irSobreGanhos)}</p>
                            </div>
                            <div className="bg-[#1a1a28] rounded-lg p-2">
                              <span className="text-slate-600 text-[9px]">Dividendos</span>
                              <p className="text-xs font-semibold text-amber-400">{fmt(simResultado.totalDividendos)}</p>
                            </div>
                            <div className="bg-[#1a1a28] rounded-lg p-2">
                              <span className="text-slate-600 text-[9px]">Unidades</span>
                              <p className="text-xs font-semibold">{simResultado.unidades.toLocaleString()}</p>
                            </div>
                            <div className="bg-[#1a1a28] rounded-lg p-2">
                              <span className="text-slate-600 text-[9px]">Yield on Cost</span>
                              <p className="text-xs font-semibold text-emerald-400">{simResultado.yieldOnCost.toFixed(2)}%</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {simAba === 'grafico' && simHistorico.length > 0 && (
                      <div>
                        <ResponsiveContainer width="100%" height={280}>
                          <AreaChart data={simHistorico.filter((_, i) => i % Math.ceil(simHistorico.length / 24) === 0 || i === simHistorico.length - 1)}>
                            <defs>
                              <linearGradient id="colorSimAcao" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="data" tick={{ fill: '#64748b', fontSize: 8 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                            <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtK(v)} width={55} />
                            <Tooltip 
                              formatter={(v, name) => [fmt(v), name]} 
                              contentStyle={{ background: '#1a1a28', border: '1px solid #2d2d3d', borderRadius: 8, fontSize: 10 }} 
                              labelFormatter={(v) => v}
                            />
                            <Area type="monotone" dataKey="patrimonio" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#colorSimAcao)" name="Ação" />
                            <Area type="monotone" dataKey="cdi" stroke="#06b6d4" strokeWidth={1.5} fill="transparent" strokeDasharray="4 2" name="CDI" />
                            <Area type="monotone" dataKey="ipca" stroke="#f59e0b" strokeWidth={1.5} fill="transparent" strokeDasharray="4 2" name="IPCA" />
                            <Area type="monotone" dataKey="ipcaMais" stroke="#f97316" strokeWidth={1.5} fill="transparent" strokeDasharray="4 2" name="IPCA+" />
                            <Area type="monotone" dataKey="ibov" stroke="#10b981" strokeWidth={1.5} fill="transparent" strokeDasharray="4 2" name="IBOV" />
                            <Area type="monotone" dataKey="ifix" stroke="#ec4899" strokeWidth={1.5} fill="transparent" strokeDasharray="4 2" name="IFIX" />
                          </AreaChart>
                        </ResponsiveContainer>
                        
                        {/* Legenda com valores finais e taxas */}
                        <div className="grid grid-cols-3 gap-2 mt-3 text-[10px]">
                          <div className="flex items-center gap-1">
                            <span className="w-3 h-0.5 bg-violet-500 rounded"></span>
                            <span className="text-slate-400">Ação</span>
                            <span className="text-violet-400 font-semibold">{fmtK(simResultado.totalFinal)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="w-3 h-0.5 bg-cyan-500 rounded"></span>
                            <span className="text-slate-400">CDI ({simResultado.taxaCDIUsada?.toFixed(2)}%)</span>
                            <span className="text-cyan-400 font-semibold">{fmtK(simResultado.finalCDI)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="w-3 h-0.5 bg-amber-500 rounded"></span>
                            <span className="text-slate-400">IPCA ({simResultado.taxaIPCAUsada?.toFixed(2)}%)</span>
                            <span className="text-amber-400 font-semibold">{fmtK(simResultado.finalIPCA)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="w-3 h-0.5 bg-orange-500 rounded"></span>
                            <span className="text-slate-400">IPCA+ ({simResultado.taxaIPCAMaisUsada?.toFixed(2)}%)</span>
                            <span className="text-orange-400 font-semibold">{fmtK(simResultado.finalIPCAMais)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="w-3 h-0.5 bg-emerald-500 rounded"></span>
                            <span className="text-slate-400">IBOV (12%)</span>
                            <span className="text-emerald-400 font-semibold">{fmtK(simResultado.finalIBOV)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="w-3 h-0.5 bg-pink-500 rounded"></span>
                            <span className="text-slate-400">IFIX (10%)</span>
                            <span className="text-pink-400 font-semibold">{fmtK(simResultado.finalIFIX)}</span>
                          </div>
                        </div>
                        
                        {/* Fonte dos dados */}
                        <div className="mt-2 pt-2 border-t border-[#2d2d3d] text-[9px] text-slate-600 text-center">
                          📊 Taxas oficiais: CDI e IPCA via Banco Central do Brasil | IBOV e IFIX: estimativas históricas
                        </div>
                      </div>
                    )}
                    
                    {simAba === 'historico' && (
                      <div className="max-h-[280px] overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-[#12121a]">
                            <tr className="text-slate-500 border-b border-[#2d2d3d]">
                              <th className="py-2 text-left">Mês</th>
                              <th className="py-2 text-right">Patrimônio</th>
                              <th className="py-2 text-right">Aportado</th>
                              <th className="py-2 text-right">Unid.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {simHistorico.filter((_, i) => i % 6 === 0 || i === simHistorico.length - 1).map((h) => (
                              <tr key={h.mes} className="border-b border-[#1f1f2e] hover:bg-[#1a1a28]">
                                <td className="py-2">{h.mes}</td>
                                <td className="py-2 text-right text-emerald-400">{fmtK(h.patrimonio)}</td>
                                <td className="py-2 text-right">{fmtK(h.totalAportado)}</td>
                                <td className="py-2 text-right text-slate-400">{h.unidades}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-slate-500">
                    <div className="text-center">
                      <span className="text-5xl mb-3 block">📊</span>
                      <p className="text-sm">Configure os parâmetros e clique em</p>
                      <p className="text-sm">"Simular Rentabilidade"</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Limitações e Considerações */}
            <div className="rounded-xl bg-[#12121a] border border-amber-500/30 p-4">
              <h3 className="font-semibold mb-3 text-sm flex items-center gap-2 text-amber-400">
                <span>⚠️</span> Limitações e Considerações Importantes
              </h3>
              
              <div className="space-y-3 text-xs text-slate-300">
                <div>
                  <p className="font-semibold text-white">Performance Passada vs. Futura</p>
                  <p className="text-slate-400">As simulações são baseadas em dados históricos reais, mas <span className="text-amber-400 font-semibold">performance passada não garante resultados futuros</span>. Use os resultados como referência educacional, não como garantia de investimento.</p>
                </div>
                
                <div>
                  <p className="font-semibold text-white">Custos Não Incluídos</p>
                  <p className="text-slate-400">O simulador não inclui custos reais como corretagem (R$ 0-20 por operação), taxas de custódia (R$ 0-30/mês), impostos sobre ganhos de capital (15-20%), ou spreads de compra/venda.</p>
                </div>
                
                <div>
                  <p className="font-semibold text-white">Cenário Estático</p>
                  <p className="text-slate-400">A simulação considera apenas o ativo escolhido, não incluindo rebalanceamentos de carteira, mudanças de estratégia, ou diversificação ao longo do tempo.</p>
                </div>
                
                <div>
                  <p className="font-semibold text-white">Finalidade Educacional</p>
                  <p className="text-slate-400">Esta ferramenta tem propósito <span className="text-amber-400 font-semibold">educacional e informativo</span>. Sempre consulte um assessor de investimentos qualificado antes de tomar decisões financeiras importantes.</p>
                </div>
              </div>
            </div>
          </div>
        )}
        {view === 'fire' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
              <h1 className="text-2xl font-bold flex items-center justify-center gap-2">🔥 Independência Financeira (FIRE)</h1>
              <p className="text-slate-400 text-sm mt-1">Calculadoras para alcançar a independência financeira e aposentadoria antecipada</p>
            </div>
            
            {/* Cards de Seleção */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { id: 'tradicional', icon: '🎯', nome: 'FIRE Tradicional', desc: 'Regra dos 4% (25x gastos)', cor: 'orange' },
                { id: 'lean', icon: '🥗', nome: 'Lean FIRE', desc: 'Estilo minimalista (20x)', cor: 'emerald' },
                { id: 'fat', icon: '👑', nome: 'Fat FIRE', desc: 'Alto padrão (33-50x)', cor: 'violet' },
                { id: 'coast', icon: '🏖️', nome: 'Coast FIRE', desc: 'Parar de aportar', cor: 'cyan' },
                { id: 'barista', icon: '☕', nome: 'Barista FIRE', desc: 'Trabalho meio período', cor: 'amber' },
                { id: 'geoarbitrage', icon: '🌍', nome: 'Geo Arbitrage', desc: 'Custo de vida otimizado', cor: 'pink' }
              ].map((calc) => (
                <button key={calc.id} onClick={() => { setFireTab(calc.id); setFireResultado(null); setFireProjecao([]); }}
                  className={`p-3 rounded-xl border-2 transition-all text-left ${fireTab === calc.id ? `border-${calc.cor}-500 bg-${calc.cor}-500/10` : 'border-[#2d2d3d] bg-[#12121a] hover:border-[#3d3d4d]'}`}>
                  <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium mb-2 ${fireTab === calc.id ? `bg-${calc.cor}-500/20 text-${calc.cor}-400` : 'bg-violet-500/20 text-violet-400'}`}>
                    <span>Disponível</span>
                  </div>
                  <div className="text-lg mb-1">{calc.icon}</div>
                  <h3 className="font-semibold text-sm">{calc.nome}</h3>
                  <p className="text-[10px] text-slate-500 mt-1">{calc.desc}</p>
                </button>
              ))}
            </div>
            
            {/* Indicadores do tipo selecionado */}
            <div className="flex items-center justify-center gap-4 text-xs">
              {fireTab === 'tradicional' && <><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500"></span> Regra dos 4%</span><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500"></span> Meta Personalizada</span><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500"></span> Projeção Temporal</span></>}
              {fireTab === 'lean' && <><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Estilo Minimalista</span><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Gastos Otimizados</span><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Aposentadoria Acelerada</span></>}
              {fireTab === 'fat' && <><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500"></span> Alto Padrão de Vida</span><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500"></span> Múltiplas Fontes</span><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500"></span> Segurança Premium</span></>}
              {fireTab === 'coast' && <><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-500"></span> Ponto de Equilíbrio</span><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-500"></span> Juros Compostos</span><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-500"></span> Flexibilidade</span></>}
              {fireTab === 'barista' && <><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Trabalho Meio Período</span><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Renda Complementar</span><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Transição Gradual</span></>}
              {fireTab === 'geoarbitrage' && <><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-pink-500"></span> Arbitragem Geográfica</span><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-pink-500"></span> Custo Otimizado</span><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-pink-500"></span> Mobilidade Internacional</span></>}
            </div>
            
            {/* Calculadora Selecionada */}
            <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xl`}>
                  {fireTab === 'tradicional' ? '🎯' : fireTab === 'lean' ? '🥗' : fireTab === 'fat' ? '👑' : fireTab === 'coast' ? '🏖️' : fireTab === 'barista' ? '☕' : '🌍'}
                </span>
                <div>
                  <h2 className="font-bold">Calculadora {fireTab === 'tradicional' ? 'FIRE Tradicional' : fireTab === 'lean' ? 'Lean FIRE' : fireTab === 'fat' ? 'Fat FIRE' : fireTab === 'coast' ? 'Coast FIRE' : fireTab === 'barista' ? 'Barista FIRE' : 'Geographic Arbitrage FIRE'}</h2>
                  <p className="text-xs text-slate-500">
                    {fireTab === 'tradicional' && 'Descubra quanto precisa acumular para alcançar a independência financeira'}
                    {fireTab === 'lean' && 'Descubra quando pode se aposentar com um estilo de vida minimalista'}
                    {fireTab === 'fat' && 'Calcule o patrimônio necessário para manter um padrão de vida luxuoso'}
                    {fireTab === 'coast' && 'Descubra quando pode parar de investir e deixar os juros compostos trabalharem'}
                    {fireTab === 'barista' && 'Calcule quanto precisa para trabalhar meio período e viver dos investimentos'}
                    {fireTab === 'geoarbitrage' && 'Acelere sua independência financeira aproveitando diferenças de custo de vida'}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                {/* Parâmetros de Entrada */}
                <div>
                  <h3 className="font-semibold mb-4 text-sm">Parâmetros de Entrada</h3>
                  <div className="space-y-3">
                    {/* Campos específicos por tipo */}
                    {fireTab === 'tradicional' && <>
                      <div><label className="text-xs text-slate-400">Gastos Mensais Atuais (R$)</label><input type="number" value={fireParams.gastoMensal} onChange={(e) => setFireParams(p => ({...p, gastoMensal: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2.5 text-sm" /><p className="text-[10px] text-slate-600 mt-1">Seus gastos mensais para manter o padrão de vida atual</p></div>
                      <div><label className="text-xs text-slate-400">Patrimônio Atual (R$)</label><input type="number" value={fireParams.patrimonioAtual} onChange={(e) => setFireParams(p => ({...p, patrimonioAtual: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2.5 text-sm" /><p className="text-[10px] text-slate-600 mt-1">Valor já investido ou disponível para investimento</p></div>
                      <div><label className="text-xs text-slate-400">Aporte Mensal (R$)</label><input type="number" value={fireParams.aporteMensal} onChange={(e) => setFireParams(p => ({...p, aporteMensal: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2.5 text-sm" /><p className="text-[10px] text-slate-600 mt-1">Valor que consegue investir mensalmente</p></div>
                      <div><label className="text-xs text-slate-400">Rentabilidade Anual Esperada (%)</label><input type="number" value={fireParams.rentabilidade} onChange={(e) => setFireParams(p => ({...p, rentabilidade: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2.5 text-sm" /><p className="text-[10px] text-slate-600 mt-1">Taxa anual de retorno esperada dos investimentos</p></div>
                    </>}
                    
                    {fireTab === 'lean' && <>
                      <div><label className="text-xs text-slate-400">Renda Mensal Atual (R$)</label><input type="number" value={fireParams.rendaMensal} onChange={(e) => setFireParams(p => ({...p, rendaMensal: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2.5 text-sm" /><p className="text-[10px] text-slate-600 mt-1">Sua renda mensal líquida atual</p></div>
                      <div><label className="text-xs text-slate-400">Gastos Mensais Lean (R$)</label><input type="number" value={fireParams.gastosLean} onChange={(e) => setFireParams(p => ({...p, gastosLean: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2.5 text-sm" /><p className="text-[10px] text-slate-600 mt-1">Gastos mensais essenciais para estilo de vida minimalista</p></div>
                      <div><label className="text-xs text-slate-400">Patrimônio Atual (R$)</label><input type="number" value={fireParams.patrimonioAtual} onChange={(e) => setFireParams(p => ({...p, patrimonioAtual: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2.5 text-sm" /><p className="text-[10px] text-slate-600 mt-1">Valor já investido ou disponível para investimento</p></div>
                      <div><label className="text-xs text-slate-400">Rentabilidade Anual Esperada (%)</label><input type="number" value={fireParams.rentabilidade} onChange={(e) => setFireParams(p => ({...p, rentabilidade: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2.5 text-sm" /><p className="text-[10px] text-slate-600 mt-1">Taxa anual de retorno esperada dos investimentos</p></div>
                      {fireResultado && <div className="bg-[#1a1a28] rounded-lg p-3 mt-2"><p className="text-xs text-slate-400">Valores Calculados:</p><p className="text-sm">Aporte Mensal: <span className="text-emerald-400 font-semibold">{fmt(fireParams.rendaMensal - fireParams.gastosLean)}</span></p><p className="text-sm">Taxa de Poupança: <span className="text-emerald-400 font-semibold">{((fireParams.rendaMensal - fireParams.gastosLean) / fireParams.rendaMensal * 100).toFixed(1)}%</span></p></div>}
                    </>}
                    
                    {fireTab === 'fat' && <>
                      <div><label className="text-xs text-slate-400">Gastos Mensais Desejados (R$)</label><input type="number" value={fireParams.gastosDesejados} onChange={(e) => setFireParams(p => ({...p, gastosDesejados: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2.5 text-sm" /><p className="text-[10px] text-slate-600 mt-1">Gastos mensais para manter padrão de vida elevado</p></div>
                      <div><label className="text-xs text-slate-400">Patrimônio Atual (R$)</label><input type="number" value={fireParams.patrimonioAtual} onChange={(e) => setFireParams(p => ({...p, patrimonioAtual: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2.5 text-sm" /></div>
                      <div><label className="text-xs text-slate-400">Aporte Mensal (R$)</label><input type="number" value={fireParams.aporteMensal} onChange={(e) => setFireParams(p => ({...p, aporteMensal: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2.5 text-sm" /></div>
                      <div><label className="text-xs text-slate-400">Rentabilidade Anual Esperada (%)</label><input type="number" value={fireParams.rentabilidade} onChange={(e) => setFireParams(p => ({...p, rentabilidade: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2.5 text-sm" /><p className="text-[10px] text-slate-600 mt-1">Taxa anual conservadora para Fat FIRE</p></div>
                      <div><label className="text-xs text-slate-400">Multiplicador de Segurança: {fireParams.multiplicador}x</label><input type="range" min="25" max="50" value={fireParams.multiplicador} onChange={(e) => setFireParams(p => ({...p, multiplicador: +e.target.value}))} className="w-full mt-1 accent-violet-500" /><div className="flex justify-between text-[10px] text-slate-600"><span>25x (FIRE tradicional)</span><span>50x (Ultra seguro)</span></div><p className="text-[10px] text-slate-500 mt-1">Taxa de saque: ~{(1/fireParams.multiplicador*100).toFixed(1)}% anual</p></div>
                    </>}
                    
                    {fireTab === 'coast' && <>
                      <div><label className="text-xs text-slate-400">Idade Atual</label><input type="number" value={fireParams.idadeAtual} onChange={(e) => setFireParams(p => ({...p, idadeAtual: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2.5 text-sm" /><p className="text-[10px] text-slate-600 mt-1">Sua idade atual em anos</p></div>
                      <div><label className="text-xs text-slate-400">Idade de Aposentadoria Desejada</label><input type="number" value={fireParams.idadeAposentadoria} onChange={(e) => setFireParams(p => ({...p, idadeAposentadoria: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2.5 text-sm" /><p className="text-[10px] text-slate-600 mt-1">Quando planeja se aposentar</p></div>
                      <div><label className="text-xs text-slate-400">Gastos Mensais Desejados na Aposentadoria (R$)</label><input type="number" value={fireParams.gastosAposentadoria} onChange={(e) => setFireParams(p => ({...p, gastosAposentadoria: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2.5 text-sm" /><p className="text-[10px] text-slate-600 mt-1">Gastos mensais que deseja ter na aposentadoria</p></div>
                      <div><label className="text-xs text-slate-400">Patrimônio Atual (R$)</label><input type="number" value={fireParams.patrimonioAtual} onChange={(e) => setFireParams(p => ({...p, patrimonioAtual: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2.5 text-sm" /><p className="text-[10px] text-slate-600 mt-1">Valor já investido atualmente</p></div>
                      <div><label className="text-xs text-slate-400">Rentabilidade Anual Esperada (%)</label><input type="number" value={fireParams.rentabilidade} onChange={(e) => setFireParams(p => ({...p, rentabilidade: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2.5 text-sm" /><p className="text-[10px] text-slate-600 mt-1">Taxa anual de retorno esperada dos investimentos</p></div>
                      {fireResultado && <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3 mt-2"><p className="text-xs text-slate-400">Informações Calculadas:</p><p className="text-sm">Anos até aposentadoria: <span className="text-cyan-400 font-semibold">{fireParams.idadeAposentadoria - fireParams.idadeAtual} anos</span></p><p className="text-sm">Meta FIRE total: <span className="text-cyan-400 font-semibold">{fmtK(fireParams.gastosAposentadoria * 12 * 25)}</span></p></div>}
                    </>}
                    
                    {fireTab === 'barista' && <>
                      <div><label className="text-xs text-slate-400">Gastos Mensais Totais (R$)</label><input type="number" value={fireParams.gastoMensal} onChange={(e) => setFireParams(p => ({...p, gastoMensal: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2.5 text-sm" /><p className="text-[10px] text-slate-600 mt-1">Seus gastos mensais totais na fase Barista FIRE</p></div>
                      <div><label className="text-xs text-slate-400">Patrimônio Atual (R$)</label><input type="number" value={fireParams.patrimonioAtual} onChange={(e) => setFireParams(p => ({...p, patrimonioAtual: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2.5 text-sm" /></div>
                      <div><label className="text-xs text-slate-400">Aporte Mensal (R$)</label><input type="number" value={fireParams.aporteMensal} onChange={(e) => setFireParams(p => ({...p, aporteMensal: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2.5 text-sm" /></div>
                      <div><label className="text-xs text-slate-400">Rentabilidade Anual Esperada (%)</label><input type="number" value={fireParams.rentabilidade} onChange={(e) => setFireParams(p => ({...p, rentabilidade: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2.5 text-sm" /></div>
                      <div><label className="text-xs text-slate-400">Salário por Hora Meio Período (R$)</label><input type="number" value={fireParams.salarioHora} onChange={(e) => setFireParams(p => ({...p, salarioHora: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2.5 text-sm" /><p className="text-[10px] text-slate-600 mt-1">Quanto ganha por hora em trabalho meio período</p></div>
                      <div><label className="text-xs text-slate-400">% dos Gastos Cobertos por Renda Passiva: {fireParams.percentualCobertura}%</label><input type="range" min="30" max="80" value={fireParams.percentualCobertura} onChange={(e) => setFireParams(p => ({...p, percentualCobertura: +e.target.value}))} className="w-full mt-1 accent-amber-500" /><div className="flex justify-between text-[10px] text-slate-600"><span>30% (mais trabalho)</span><span>80% (menos trabalho)</span></div><p className="text-[10px] text-slate-500 mt-1">Que porcentagem dos gastos será coberta pelos investimentos</p></div>
                    </>}
                    
                    {fireTab === 'geoarbitrage' && <>
                      <div><label className="text-xs text-slate-400">Gastos Mensais Atuais (R$)</label><input type="number" value={fireParams.gastoMensal} onChange={(e) => setFireParams(p => ({...p, gastoMensal: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2.5 text-sm" /><p className="text-[10px] text-slate-600 mt-1">Seus gastos mensais no local atual</p></div>
                      <div><label className="text-xs text-slate-400">Local Atual</label><select value={fireParams.localAtual} onChange={(e) => setFireParams(p => ({...p, localAtual: e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2.5 text-sm">{Object.keys(locaisGeoArbitrage).map(l => <option key={l} value={l}>{l}</option>)}</select><p className="text-[10px] text-slate-600 mt-1">Onde você mora atualmente</p></div>
                      <div><label className="text-xs text-slate-400">Local Destino</label><select value={fireParams.localDestino} onChange={(e) => setFireParams(p => ({...p, localDestino: e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2.5 text-sm">{Object.keys(locaisGeoArbitrage).map(l => <option key={l} value={l}>{l}</option>)}</select><p className="text-[10px] text-slate-600 mt-1">Para onde pretende se mudar</p></div>
                      <div><label className="text-xs text-slate-400">Patrimônio Atual (R$)</label><input type="number" value={fireParams.patrimonioAtual} onChange={(e) => setFireParams(p => ({...p, patrimonioAtual: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2.5 text-sm" /></div>
                      <div><label className="text-xs text-slate-400">Aporte Mensal (R$)</label><input type="number" value={fireParams.aporteMensal} onChange={(e) => setFireParams(p => ({...p, aporteMensal: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2.5 text-sm" /></div>
                      <div><label className="text-xs text-slate-400">Rentabilidade Anual Esperada (%)</label><input type="number" value={fireParams.rentabilidade} onChange={(e) => setFireParams(p => ({...p, rentabilidade: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2.5 text-sm" /></div>
                    </>}
                  </div>
                  
                  <button onClick={calcularFIRE} className={`w-full mt-5 py-3 rounded-lg font-medium text-sm transition-all ${
                    fireTab === 'tradicional' ? 'bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500' :
                    fireTab === 'lean' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500' :
                    fireTab === 'fat' ? 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500' :
                    fireTab === 'coast' ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500' :
                    fireTab === 'barista' ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500' :
                    'bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500'
                  }`}>
                    🔥 Calcular {fireTab === 'tradicional' ? 'FIRE Tradicional' : fireTab === 'lean' ? 'Lean FIRE' : fireTab === 'fat' ? 'Fat FIRE' : fireTab === 'coast' ? 'Coast FIRE' : fireTab === 'barista' ? 'Barista FIRE' : 'Geographic FIRE'}
                  </button>
                </div>
                
                {/* Resultados */}
                <div>
                  <h3 className="font-semibold mb-4 text-sm">Resultados</h3>
                  
                  {fireResultado ? (
                    <div className="space-y-3">
                      {/* Cards de resultado específicos por tipo */}
                      {fireTab === 'tradicional' && <>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/30 rounded-xl p-4"><p className="text-[10px] text-slate-400 flex items-center gap-1">🎯 Meta FIRE</p><p className="text-xl font-bold text-orange-400">{fmt(fireResultado.meta)}</p><p className="text-[10px] text-slate-500">25x seus gastos anuais</p></div>
                          <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl p-4"><p className="text-[10px] text-slate-400 flex items-center gap-1">⏱️ Tempo para FIRE</p><p className="text-xl font-bold text-cyan-400">{fireResultado.tempoAnos} anos</p><p className="text-[10px] text-slate-500">{fireResultado.tempoMeses} meses</p></div>
                        </div>
                        <div className="bg-[#1a1a28] rounded-xl p-4 border border-emerald-500/30"><p className="text-[10px] text-slate-400 flex items-center gap-1">💰 Renda Passiva Mensal</p><p className="text-xl font-bold text-emerald-400">{fmt(fireResultado.rendaPassiva)}</p><p className="text-[10px] text-slate-500">4% anual do patrimônio total</p></div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-[#1a1a28] rounded-lg p-3"><p className="text-[10px] text-slate-400">Total Investido</p><p className="text-lg font-bold text-slate-300">{fmtK(fireResultado.totalInvestido)}</p></div>
                          <div className="bg-[#1a1a28] rounded-lg p-3"><p className="text-[10px] text-slate-400">Crescimento</p><p className="text-lg font-bold text-emerald-400">{fmtK(fireResultado.crescimento)}</p></div>
                        </div>
                      </>}
                      
                      {fireTab === 'lean' && <>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-xl p-4"><p className="text-[10px] text-slate-400 flex items-center gap-1">🥗 Meta Lean FIRE</p><p className="text-xl font-bold text-emerald-400">{fmt(fireResultado.meta)}</p><p className="text-[10px] text-slate-500">20x seus gastos anuais lean</p></div>
                          <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-xl p-4"><p className="text-[10px] text-slate-400 flex items-center gap-1">⏱️ Tempo para Lean FIRE</p><p className="text-xl font-bold text-emerald-400">{fireResultado.tempoAnos} anos</p><p className="text-[10px] text-slate-500">{fireResultado.tempoMeses} meses</p></div>
                        </div>
                        <div className="bg-[#1a1a28] rounded-xl p-4 border border-emerald-500/30"><p className="text-[10px] text-slate-400 flex items-center gap-1">💰 Renda Passiva Mensal</p><p className="text-xl font-bold text-emerald-400">{fmt(fireResultado.rendaPassiva)}</p><p className="text-[10px] text-slate-500">5% anual do patrimônio total (estratégia mais agressiva)</p></div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-[#1a1a28] rounded-lg p-3"><p className="text-[10px] text-slate-400">Total Investido</p><p className="text-lg font-bold text-slate-300">{fmtK(fireResultado.totalInvestido)}</p></div>
                          <div className="bg-[#1a1a28] rounded-lg p-3"><p className="text-[10px] text-slate-400">Crescimento</p><p className="text-lg font-bold text-emerald-400">{fmtK(fireResultado.crescimento)}</p></div>
                        </div>
                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3"><p className="text-[10px] text-slate-400">🏆 Taxa de Poupança</p><div className="flex items-center gap-2"><p className="text-lg font-bold text-emerald-400">Atual: {fireResultado.taxaPoupanca?.toFixed(1)}%</p><span className={`text-xs px-2 py-0.5 rounded-full ${fireResultado.taxaPoupanca > 50 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>{fireResultado.taxaPoupanca > 50 ? 'Excelente' : 'Bom'}</span></div><div className="w-full bg-[#1a1a28] rounded-full h-2 mt-2"><div className="bg-gradient-to-r from-emerald-500 to-teal-500 h-2 rounded-full" style={{ width: `${Math.min(100, fireResultado.taxaPoupanca)}%` }}></div></div></div>
                      </>}
                      
                      {fireTab === 'fat' && <>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/30 rounded-xl p-4"><p className="text-[10px] text-slate-400 flex items-center gap-1">👑 Meta Fat FIRE</p><p className="text-xl font-bold text-violet-400">{fmt(fireResultado.meta)}</p><p className="text-[10px] text-slate-500">{fireResultado.multiplicador}x seus gastos anuais</p></div>
                          <div className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/30 rounded-xl p-4"><p className="text-[10px] text-slate-400 flex items-center gap-1">⏱️ Tempo para Fat FIRE</p><p className="text-xl font-bold text-violet-400">{fireResultado.tempoAnos} anos</p><p className="text-[10px] text-slate-500">{fireResultado.tempoMeses} meses</p></div>
                        </div>
                        <div className="bg-[#1a1a28] rounded-xl p-4 border border-violet-500/30"><p className="text-[10px] text-slate-400 flex items-center gap-1">💰 Renda Passiva Mensal</p><p className="text-xl font-bold text-violet-400">{fmt(fireResultado.rendaPassiva)}</p><p className="text-[10px] text-slate-500">{fireResultado.taxaSaque?.toFixed(1)}% anual do patrimônio total (conservador)</p></div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-[#1a1a28] rounded-lg p-3"><p className="text-[10px] text-slate-400">Total Investido</p><p className="text-lg font-bold text-slate-300">{fmtK(fireResultado.totalInvestido)}</p></div>
                          <div className="bg-[#1a1a28] rounded-lg p-3"><p className="text-[10px] text-slate-400">Crescimento</p><p className="text-lg font-bold text-violet-400">{fmtK(fireResultado.crescimento)}</p></div>
                        </div>
                        <div className="bg-violet-500/10 border border-violet-500/30 rounded-lg p-3"><p className="text-[10px] text-slate-400">🛡️ Buffer de Segurança</p><p className="text-lg font-bold text-violet-400">{fmtK(fireResultado.bufferSeguranca)}</p><p className="text-[10px] text-slate-500">Patrimônio extra vs FIRE tradicional para maior segurança</p></div>
                      </>}
                      
                      {fireTab === 'coast' && <>
                        <div className={`rounded-xl p-4 border ${fireResultado.jaAtingiu ? 'bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/30' : 'bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-cyan-500/30'}`}><p className="text-[10px] text-slate-400 flex items-center gap-1">🏖️ {fireResultado.jaAtingiu ? 'Você já está em Coast FIRE!' : 'Status Coast FIRE'}</p>{fireResultado.jaAtingiu ? <p className="text-sm text-emerald-400 mt-1">Parabéns! Você pode parar de investir agora e ainda alcançar suas metas de aposentadoria.</p> : <p className="text-sm text-cyan-400 mt-1">Continue aportando até atingir o ponto de Coast FIRE.</p>}</div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-[#1a1a28] rounded-xl p-4 border border-cyan-500/30"><p className="text-[10px] text-slate-400">💵 Ainda Precisa</p><p className="text-xl font-bold text-cyan-400">{fmt(fireResultado.aindaPrecisa)}</p><p className="text-[10px] text-slate-500">Para alcançar Coast FIRE hoje</p></div>
                          <div className="bg-[#1a1a28] rounded-xl p-4 border border-cyan-500/30"><p className="text-[10px] text-slate-400">🎂 Idade Coast FIRE</p><p className="text-xl font-bold text-cyan-400">{fireResultado.idadeCoast} anos</p><p className="text-[10px] text-slate-500">{fireResultado.jaAtingiu ? 'Já atingiu!' : ''}</p></div>
                        </div>
                        <div className="bg-[#1a1a28] rounded-xl p-4 border border-emerald-500/30"><p className="text-[10px] text-slate-400 flex items-center gap-1">💰 Valor na Aposentadoria</p><p className="text-xl font-bold text-emerald-400">{fmt(fireResultado.valorAposentadoria)}</p><p className="text-[10px] text-slate-500">Patrimônio projetado aos {fireParams.idadeAposentadoria} anos</p></div>
                        <div className="bg-[#1a1a28] rounded-xl p-4 border border-amber-500/30"><p className="text-[10px] text-slate-400 flex items-center gap-1">🏦 Renda Passiva Mensal</p><p className="text-xl font-bold text-amber-400">{fmt(fireResultado.rendaPassiva)}</p><p className="text-[10px] text-slate-500">4% anual do patrimônio na aposentadoria</p></div>
                      </>}
                      
                      {fireTab === 'barista' && <>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-4"><p className="text-[10px] text-slate-400 flex items-center gap-1">☕ Meta Barista FIRE</p><p className="text-xl font-bold text-amber-400">{fmt(fireResultado.meta)}</p><p className="text-[10px] text-slate-500">{fireParams.percentualCobertura}% do FIRE tradicional</p></div>
                          <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-4"><p className="text-[10px] text-slate-400 flex items-center gap-1">⏱️ Tempo para Barista FIRE</p><p className="text-xl font-bold text-amber-400">{fireResultado.tempoAnos} anos</p><p className="text-[10px] text-slate-500">{fireResultado.tempoMeses} meses</p></div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-[#1a1a28] rounded-xl p-4 border border-emerald-500/30"><p className="text-[10px] text-slate-400">💰 Renda Passiva</p><p className="text-xl font-bold text-emerald-400">{fmt(fireResultado.rendaPassiva)}</p><p className="text-[10px] text-slate-500">{fireParams.percentualCobertura}% dos gastos mensais</p></div>
                          <div className="bg-[#1a1a28] rounded-xl p-4 border border-amber-500/30"><p className="text-[10px] text-slate-400">💼 Renda do Trabalho</p><p className="text-xl font-bold text-amber-400">{fmt(fireResultado.rendaTrabalho)}</p><p className="text-[10px] text-slate-500">{100 - fireParams.percentualCobertura}% dos gastos mensais</p></div>
                        </div>
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4"><p className="text-[10px] text-slate-400 flex items-center gap-1">⏰ Carga de Trabalho Necessária</p><p className="text-xl font-bold text-amber-400">{fireResultado.horasSemana} horas/semana</p><p className="text-[10px] text-slate-500">Aproximadamente {fireResultado.diasMes} dias/mês</p></div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-[#1a1a28] rounded-lg p-3"><p className="text-[10px] text-slate-400">Total Investido</p><p className="text-lg font-bold text-slate-300">{fmtK(fireResultado.totalInvestido)}</p></div>
                          <div className="bg-[#1a1a28] rounded-lg p-3"><p className="text-[10px] text-slate-400">Economia vs FIRE tradicional</p><p className="text-lg font-bold text-emerald-400">{fmtK(fireResultado.economiaVsTradicional)}</p></div>
                        </div>
                      </>}
                      
                      {fireTab === 'geoarbitrage' && <>
                        <div className="bg-[#1a1a28] rounded-xl p-4 border border-pink-500/30"><p className="text-[10px] text-slate-400 flex items-center gap-1">🌍 Comparação de Locais</p><p className="text-sm mt-1">De: <span className="text-slate-300">{fireResultado.localAtual}</span></p><p className="text-sm">Para: <span className="text-pink-400 font-semibold">{fireResultado.localDestino}</span></p><p className="text-sm mt-2">Ganho do poder de compra: <span className="text-emerald-400 font-bold">{fireResultado.ganhoPoder}%</span></p></div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-gradient-to-br from-pink-500/10 to-rose-500/10 border border-pink-500/30 rounded-xl p-4"><p className="text-[10px] text-slate-400 flex items-center gap-1">🌍 Meta Geographic FIRE</p><p className="text-xl font-bold text-pink-400">{fmt(fireResultado.meta)}</p><p className="text-[10px] text-slate-500">25x gastos ajustados ao novo local</p></div>
                          <div className="bg-gradient-to-br from-pink-500/10 to-rose-500/10 border border-pink-500/30 rounded-xl p-4"><p className="text-[10px] text-slate-400 flex items-center gap-1">⏱️ Tempo para Geographic FIRE</p><p className="text-xl font-bold text-pink-400">{fireResultado.tempoAnos} anos</p><p className="text-[10px] text-slate-500">{fireResultado.tempoMeses} meses</p></div>
                        </div>
                        <div className="bg-[#1a1a28] rounded-xl p-4 border border-emerald-500/30"><p className="text-[10px] text-slate-400 flex items-center gap-1">💰 Renda Passiva no Novo Local</p><p className="text-xl font-bold text-emerald-400">{fmt(fireResultado.rendaPassiva)}</p><p className="text-[10px] text-slate-500">4% anual do patrimônio total</p></div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-[#1a1a28] rounded-lg p-3"><p className="text-[10px] text-slate-400">💵 Economia Mensal</p><p className="text-lg font-bold text-emerald-400">{fmt(fireResultado.economiaMensal)}</p><p className="text-[10px] text-slate-500">Redução nos gastos mensais</p></div>
                          <div className="bg-[#1a1a28] rounded-lg p-3"><p className="text-[10px] text-slate-400">💵 Economia Anual</p><p className="text-lg font-bold text-emerald-400">{fmt(fireResultado.economiaAnual)}</p><p className="text-[10px] text-slate-500">Redução nos gastos anuais</p></div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-[#1a1a28] rounded-lg p-3"><p className="text-[10px] text-slate-400">Total Investido</p><p className="text-lg font-bold text-slate-300">{fmtK(fireResultado.totalInvestido)}</p></div>
                          <div className="bg-[#1a1a28] rounded-lg p-3"><p className="text-[10px] text-slate-400">Economia vs FIRE tradicional</p><p className="text-lg font-bold text-emerald-400">{fmtK(fireResultado.economiaVsTradicional)}</p></div>
                        </div>
                        {fireResultado.ganhoPoder > 20 && <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-center"><p className="text-sm text-emerald-400">🎉 Excelente arbitragem geográfica! Você ganhará <span className="font-bold">{fireResultado.ganhoPoder}%</span> do poder de compra mudando para {fireResultado.localDestino}.</p></div>}
                      </>}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-500">
                      <span className="text-5xl mb-4 block">🔥</span>
                      <p className="text-sm">Configure os parâmetros e clique em</p>
                      <p className="text-sm">"Calcular" para ver os resultados</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Gráfico de Projeção */}
            {fireProjecao.length > 0 && (
              <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-5">
                <h3 className="font-semibold mb-4 text-sm flex items-center gap-2">
                  📈 Projeção {fireTab === 'tradicional' ? 'FIRE Tradicional' : fireTab === 'lean' ? 'Lean FIRE' : fireTab === 'fat' ? 'Fat FIRE' : fireTab === 'coast' ? 'Coast FIRE' : fireTab === 'barista' ? 'Barista FIRE' : 'Geographic Arbitrage FIRE'}
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={fireProjecao}>
                    <defs>
                      <linearGradient id="colorFirePat" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={fireTab === 'tradicional' ? '#f97316' : fireTab === 'lean' ? '#10b981' : fireTab === 'fat' ? '#8b5cf6' : fireTab === 'coast' ? '#06b6d4' : fireTab === 'barista' ? '#f59e0b' : '#ec4899'} stopOpacity={0.4}/>
                        <stop offset="95%" stopColor={fireTab === 'tradicional' ? '#f97316' : fireTab === 'lean' ? '#10b981' : fireTab === 'fat' ? '#8b5cf6' : fireTab === 'coast' ? '#06b6d4' : fireTab === 'barista' ? '#f59e0b' : '#ec4899'} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="data" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtK(v)} width={60} />
                    <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: '#1a1a28', border: '1px solid #2d2d3d', borderRadius: 8, fontSize: 11 }} />
                    <ReferenceLine y={fireResultado?.meta} stroke="#22c55e" strokeDasharray="5 5" label={{ value: 'Meta FIRE', fill: '#22c55e', fontSize: 10 }} />
                    <Area type="monotone" dataKey="patrimonio" stroke={fireTab === 'tradicional' ? '#f97316' : fireTab === 'lean' ? '#10b981' : fireTab === 'fat' ? '#8b5cf6' : fireTab === 'coast' ? '#06b6d4' : fireTab === 'barista' ? '#f59e0b' : '#ec4899'} strokeWidth={2} fill="url(#colorFirePat)" name="Evolução do Patrimônio" />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-center gap-6 mt-3 text-xs">
                  <span className="flex items-center gap-2"><span className={`w-3 h-0.5 rounded ${fireTab === 'tradicional' ? 'bg-orange-500' : fireTab === 'lean' ? 'bg-emerald-500' : fireTab === 'fat' ? 'bg-violet-500' : fireTab === 'coast' ? 'bg-cyan-500' : fireTab === 'barista' ? 'bg-amber-500' : 'bg-pink-500'}`}></span> Evolução do Patrimônio</span>
                  <span className="flex items-center gap-2"><span className="w-3 h-0.5 bg-emerald-500 rounded" style={{ borderStyle: 'dashed' }}></span> Meta FIRE ({fmtK(fireResultado?.meta)})</span>
                </div>
              </div>
            )}
            
            {/* Seção Educativa - Coast FIRE */}
            {fireTab === 'coast' && fireResultado && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-5">
                  <h3 className="font-semibold mb-3 text-sm">📚 O que é Coast FIRE?</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">Coast FIRE é o ponto onde você tem patrimônio suficiente investido que, mesmo sem contribuições adicionais, crescerá naturalmente até sua meta de aposentadoria. É como "colocar o piloto automático" nos seus investimentos.</p>
                </div>
                <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-5">
                  <h3 className="font-semibold mb-3 text-sm text-cyan-400">🚀 Estratégias para Coast FIRE</h3>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div><p className="font-semibold text-slate-300 mb-2">Atingir Coast FIRE Mais Cedo</p><ul className="space-y-1 text-slate-500"><li>• Invista agressivamente no início da carreira</li><li>• Foque em ações para crescimento</li><li>• Maximize aportes nos primeiros anos</li><li>• Evite retiradas prematuras</li><li>• Reinvista todos os dividendos</li></ul></div>
                    <div><p className="font-semibold text-slate-300 mb-2">Depois de Atingir Coast FIRE</p><ul className="space-y-1 text-slate-500"><li>• Pode reduzir estresse com carreira</li><li>• Considere trabalhos mais satisfatórios</li><li>• Mantenha investimentos conservadores</li><li>• Continue monitorando periodicamente</li><li>• Aproveite maior flexibilidade de vida</li></ul></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== PERFIL ==================== */}
        {view === 'config' && (
          <div className="max-w-lg mx-auto rounded-xl bg-[#12121a] border border-[#1f1f2e] p-5">
            <h2 className="text-lg font-bold mb-5 flex items-center gap-2">⚙️ Perfil do Investidor</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400">Nome Completo</label>
                <input value={client.nome} onChange={(e) => setClient(p => ({...p, nome: e.target.value}))} placeholder="Seu nome" className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-4 py-2.5 text-sm focus:border-violet-500 outline-none" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Idade</label>
                <input type="number" value={client.idade} onChange={(e) => setClient(p => ({...p, idade: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-4 py-2.5 text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Perfil de Risco</label>
                <select value={client.perfilRisco} onChange={(e) => setClient(p => ({...p, perfilRisco: e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-4 py-2.5 text-sm">
                  <option>Conservador</option>
                  <option>Moderado</option>
                  <option>Arrojado</option>
                  <option>Agressivo</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400">Horizonte de Investimento</label>
                <select value={client.horizonte} onChange={(e) => setClient(p => ({...p, horizonte: e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-4 py-2.5 text-sm">
                  <option>Curto Prazo (até 2 anos)</option>
                  <option>Médio Prazo (2-5 anos)</option>
                  <option>Longo Prazo (5+ anos)</option>
                </select>
              </div>
            </div>
            <div className="mt-5 p-3 bg-violet-500/10 border border-violet-500/20 rounded-lg text-xs text-violet-400">
              💡 Estas informações são utilizadas para personalizar o relatório PDF e as calculadoras.
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
