// ============== SISTEMA DE CONTROLE DE GASTOS ==============
// Local: database/gastos.js

const fs = require('fs');
const moment = require('moment-timezone');

const gastosFile = './database/gastos.json';
const gastosTemp = new Map();

// Inicializa o arquivo de gastos
function initGastos() {
  if (!fs.existsSync('./database')) fs.mkdirSync('./database');
  if (!fs.existsSync(gastosFile)) {
    const dadosIniciais = {
      gastos: [],
      categorias: {}
    };
    fs.writeFileSync(gastosFile, JSON.stringify(dadosIniciais, null, 2));
  }
}

// Carrega os dados
function carregarGastos() {
  initGastos();
  return JSON.parse(fs.readFileSync(gastosFile));
}

// Salva os dados
function salvarGastos(dados) {
  fs.writeFileSync(gastosFile, JSON.stringify(dados, null, 2));
}

// ============== FUNÇÃO PARA ADICIONAR GASTO ==============

async function iniciarGasto(sock, from, sender, pushname, reply) {
  try {
    // Verifica se já está em uma conversa de gasto
    if (gastosTemp.has(sender)) {
      await reply('⏳ Você já está adicionando um gasto. Complete a operação atual.');
      return false;
    }

    // Inicia a conversa
    gastosTemp.set(sender, { etapa: 'categoria', timestamp: Date.now() });
    await reply('💰 *Com o que você gastou?*\n\n📌 Digite a categoria (ex: Uber, Alimentação, Filha)');
    
    return true;
  } catch (e) {
    gastosTemp.delete(sender);
    throw e;
  }
}

async function processarRespostaGasto(sock, from, sender, pushname, body, reply) {
  try {
    const dados = carregarGastos();
    const userData = gastosTemp.get(sender);
    
    if (!userData) return false;

    // Etapa 1: Receber a categoria
    if (userData.etapa === 'categoria') {
      const categoria = body.trim();
      
      if (categoria.length < 2) {
        await reply('❌ Digite uma categoria válida (ex: Uber, Alimentação, Filha)');
        return true;
      }
      
      userData.categoria = categoria;
      userData.etapa = 'valor';
      gastosTemp.set(sender, userData);
      
      await reply(`💰 *Categoria: ${categoria}*\n\n💸 Quanto foi gasto?\n📌 Digite o valor (ex: 10,90 ou 10.90)`);
      return true;
    }
    
    // Etapa 2: Receber o valor
    if (userData.etapa === 'valor') {
      const valorStr = body.trim().replace(',', '.');
      const valor = parseFloat(valorStr);
      
      if (isNaN(valor) || valor <= 0) {
        await reply('❌ Valor inválido! Digite um número positivo (ex: 10,90)');
        return true;
      }
      
      // Cria o gasto (sem hora)
      const agora = moment().tz('America/Sao_Paulo');
      const gasto = {
        id: Date.now(),
        data: agora.format('YYYY-MM-DD'),
        categoria: userData.categoria,
        valor: valor
      };
      
      // Adiciona aos gastos
      dados.gastos.push(gasto);
      
      // Atualiza total da categoria
      if (!dados.categorias[userData.categoria]) {
        dados.categorias[userData.categoria] = 0;
      }
      dados.categorias[userData.categoria] += valor;
      
      salvarGastos(dados);
      
      // Calcula total da categoria
      const totalCategoria = dados.gastos
        .filter(g => g.categoria === userData.categoria)
        .reduce((sum, g) => sum + g.valor, 0);
      
      // Calcula gastos do dia
      const hoje = agora.format('YYYY-MM-DD');
      const gastosHoje = dados.gastos.filter(g => g.data === hoje);
      const totalHoje = gastosHoje.reduce((sum, g) => sum + g.valor, 0);
      
      // Calcula total geral
      const totalGeral = dados.gastos.reduce((sum, g) => sum + g.valor, 0);
      
      await reply(`✅ *Gasto registrado!*

📌 Categoria: ${userData.categoria}
💸 Valor: R$ ${valor.toFixed(2)}
📅 Data: ${agora.format('DD/MM/YYYY')}

📊 *Atualizações:*
• ${userData.categoria}: R$ ${totalCategoria.toFixed(2)}
• Gastos hoje: R$ ${totalHoje.toFixed(2)}
• Total geral: R$ ${totalGeral.toFixed(2)}

📌 Total de gastos: ${dados.gastos.length}`);
      
      // Remove do temporário
      gastosTemp.delete(sender);
      return true;
    }
    
    return false;
  } catch (e) {
    gastosTemp.delete(sender);
    throw e;
  }
}

// ============== FUNÇÃO PARA VER GASTOS ==============

async function verGastos(sock, from, sender, pushname, reply) {
  try {
    const dados = carregarGastos();
    
    if (dados.gastos.length === 0) {
      await reply('📭 Nenhum gasto registrado ainda!');
      return;
    }

    // Agrupa gastos por data
    const gastosPorData = {};
    dados.gastos.forEach(g => {
      if (!gastosPorData[g.data]) {
        gastosPorData[g.data] = [];
      }
      gastosPorData[g.data].push(g);
    });

    // Calcula totais por categoria
    const totaisCategoria = {};
    dados.gastos.forEach(g => {
      if (!totaisCategoria[g.categoria]) {
        totaisCategoria[g.categoria] = 0;
      }
      totaisCategoria[g.categoria] += g.valor;
    });

    // Ordena datas (mais recentes primeiro)
    const datasOrdenadas = Object.keys(gastosPorData).sort((a, b) => b.localeCompare(a));

    let texto = `📋 *LISTA DE GASTOS*\n\n`;
    
    // Mostra gastos por data
    datasOrdenadas.forEach(data => {
      const gastos = gastosPorData[data];
      const totalDia = gastos.reduce((sum, g) => sum + g.valor, 0);
      
      texto += `📅 *${moment.tz(data, 'America/Sao_Paulo').format('DD/MM/YYYY')}* (Total: R$ ${totalDia.toFixed(2)})\n`;
      gastos.forEach((g, index) => {
        texto += `   ${index + 1}. ${g.categoria}: R$ ${g.valor.toFixed(2)}\n`;
      });
      texto += `\n`;
    });

    // Mostra totais por categoria
    texto += `\n📊 *TOTAIS POR CATEGORIA:*\n`;
    const categoriasOrdenadas = Object.entries(totaisCategoria)
      .sort((a, b) => b[1] - a[1]);
    
    categoriasOrdenadas.forEach(([categoria, total]) => {
      const qtd = dados.gastos.filter(g => g.categoria === categoria).length;
      texto += `   • ${categoria}: R$ ${total.toFixed(2)} (${qtd} gastos)\n`;
    });

    const totalGeral = dados.gastos.reduce((sum, g) => sum + g.valor, 0);
    texto += `\n💰 *TOTAL GERAL:* R$ ${totalGeral.toFixed(2)}`;
    texto += `\n📌 *Total de gastos:* ${dados.gastos.length}`;

    await reply(texto);
  } catch (e) {
    throw e;
  }
}

// ============== FUNÇÃO PARA RESETAR GASTOS ==============

async function iniciarReset(sock, from, sender, pushname, reply) {
  try {
    const dados = carregarGastos();
    
    if (dados.gastos.length === 0) {
      await reply('📭 Nenhum gasto para resetar!');
      return false;
    }

    const total = dados.gastos.reduce((sum, g) => sum + g.valor, 0);
    
    // Verifica se já está em processo de confirmação
    if (gastosTemp.has(`reset_${sender}`)) {
      await reply('⏳ Aguarde, já há um processo de reset em andamento.');
      return false;
    }

    // Solicita confirmação
    gastosTemp.set(`reset_${sender}`, { etapa: 'confirmar', timestamp: Date.now() });
    await reply(`⚠️ *ATENÇÃO: RESETAR TODOS OS GASTOS!*

📊 Você tem ${dados.gastos.length} gastos
💰 Total: R$ ${total.toFixed(2)}

❗ *DIGITE "CONFIRMAR" PARA RESETAR TUDO*
🔴 *DIGITE "CANCELAR" PARA CANCELAR*`);
    
    return true;
  } catch (e) {
    gastosTemp.delete(`reset_${sender}`);
    throw e;
  }
}

async function processarRespostaReset(sock, from, sender, pushname, body, reply) {
  try {
    const resposta = body.trim().toUpperCase();
    
    if (resposta === 'CONFIRMAR') {
      const dados = carregarGastos();
      const total = dados.gastos.reduce((sum, g) => sum + g.valor, 0);
      const qtd = dados.gastos.length;
      
      dados.gastos = [];
      dados.categorias = {};
      salvarGastos(dados);
      
      gastosTemp.delete(`reset_${sender}`);
      await reply(`🗑️ *TODOS OS GASTOS FORAM RESETADOS!*

📊 Gastos removidos: ${qtd}
💰 Total removido: R$ ${total.toFixed(2)}`);
      
      return true;
      
    } else if (resposta === 'CANCELAR') {
      gastosTemp.delete(`reset_${sender}`);
      await reply('✅ Reset cancelado!');
      return true;
      
    } else {
      await reply('❌ Resposta inválida! Digite "CONFIRMAR" ou "CANCELAR"');
      return false;
    }
  } catch (e) {
    gastosTemp.delete(`reset_${sender}`);
    throw e;
  }
}

// ============== FUNÇÃO PARA VERIFICAR RESPOSTAS INTERATIVAS ==============

function isEmConversaGasto(sender) {
  return gastosTemp.has(sender) || gastosTemp.has(`reset_${sender}`);
}

function isResetConversa(sender) {
  return gastosTemp.has(`reset_${sender}`);
}

function getConversaData(sender) {
  return gastosTemp.get(sender);
}

function getResetData(sender) {
  return gastosTemp.get(`reset_${sender}`);
}

// ============== LIMPEZA AUTOMÁTICA ==============

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of gastosTemp) {
    if (value && value.timestamp && (now - value.timestamp > 300000)) { // 5 minutos
      gastosTemp.delete(key);
    }
  }
}, 60000);

// ============== EXPORTA FUNÇÕES ==============

module.exports = {
  initGastos,
  carregarGastos,
  salvarGastos,
  iniciarGasto,
  processarRespostaGasto,
  verGastos,
  iniciarReset,
  processarRespostaReset,
  isEmConversaGasto,
  isResetConversa,
  getConversaData,
  getResetData,
  gastosTemp
};