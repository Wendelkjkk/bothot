// ============== SISTEMA DE LEMBRETES ==============
// Local: database/lembretes.js

const fs = require('fs');
const moment = require('moment-timezone');

const lembretesFile = './database/lembretes.json';
const lembretesTemp = new Map();

// Inicializa o arquivo de lembretes
function initLembretes() {
  if (!fs.existsSync('./database')) fs.mkdirSync('./database');
  if (!fs.existsSync(lembretesFile)) {
    const dadosIniciais = {
      lembretes: [],
      ultimoId: 0
    };
    fs.writeFileSync(lembretesFile, JSON.stringify(dadosIniciais, null, 2));
  }
}

// Carrega os dados
function carregarLembretes() {
  initLembretes();
  return JSON.parse(fs.readFileSync(lembretesFile));
}

// Salva os dados
function salvarLembretes(dados) {
  fs.writeFileSync(lembretesFile, JSON.stringify(dados, null, 2));
}

// ============== FUNÇÃO PARA INTERPRETAR DATA ==============

function interpretarData(texto) {
  const agora = moment().tz('America/Sao_Paulo');
  const lower = texto.toLowerCase().trim();
  
  // Hoje
  if (lower === 'hoje' || lower === 'hj') {
    return { data: agora.format('YYYY-MM-DD'), dataExibicao: agora.format('DD/MM/YYYY') };
  }
  
  // Amanhã
  if (lower === 'amanha' || lower === 'amanhã' || lower === 'am') {
    const amanha = agora.clone().add(1, 'day');
    return { data: amanha.format('YYYY-MM-DD'), dataExibicao: amanha.format('DD/MM/YYYY') };
  }
  
  // Data específica: 11/09/2026 ou 11/09
  const matchData = lower.match(/(\d{2})[\/.](\d{2})(?:[\/.](\d{4}))?/);
  if (matchData) {
    const dia = matchData[1].padStart(2, '0');
    const mes = matchData[2].padStart(2, '0');
    let ano = matchData[3] || agora.format('YYYY');
    
    // Se o ano for menor que o atual, adiciona 1
    const dataObj = moment.tz(`${ano}-${mes}-${dia}`, 'YYYY-MM-DD', 'America/Sao_Paulo');
    if (!dataObj.isValid()) return null;
    
    // Se a data já passou, adiciona 1 ano
    if (dataObj.isBefore(agora, 'day')) {
      dataObj.add(1, 'year');
    }
    
    return { 
      data: dataObj.format('YYYY-MM-DD'), 
      dataExibicao: dataObj.format('DD/MM/YYYY') 
    };
  }
  
  return null;
}

// ============== FUNÇÃO PARA INICIAR LEMBRETE ==============

async function iniciarLembrete(sock, from, sender, pushname, reply) {
  try {
    if (lembretesTemp.has(sender)) {
      await reply('⏳ Você já está criando um lembrete. Complete a operação atual.');
      return false;
    }

    lembretesTemp.set(sender, { etapa: 'data', timestamp: Date.now() });
    await reply(`📝 *CRIAR LEMBRETE - PASSO 1/3*

📅 *Quando quer que eu te lembre?*

📌 *Opções:*
• Digite *hoje* ou *hj*
• Digite *amanha* ou *am*
• Digite uma data: *11/09* ou *11/09/2026*

Digite a data:`);
    
    return true;
  } catch (e) {
    lembretesTemp.delete(sender);
    throw e;
  }
}

async function processarRespostaLembrete(sock, from, sender, pushname, body, reply) {
  try {
    const dados = carregarLembretes();
    const userData = lembretesTemp.get(sender);
    
    if (!userData) return false;

    // ===== ETAPA 1: RECEBER DATA =====
    if (userData.etapa === 'data') {
      const texto = body.trim();
      const resultado = interpretarData(texto);
      
      if (!resultado) {
        await reply(`❌ *Data inválida!*

📌 *Exemplos válidos:*
• hoje ou hj
• amanha ou am
• 11/09 ou 11/09/2026

Tente novamente:`);
        return true;
      }
      
      userData.data = resultado.data;
      userData.dataExibicao = resultado.dataExibicao;
      userData.etapa = 'hora';
      lembretesTemp.set(sender, userData);
      
      await reply(`📅 *Data definida:* ${resultado.dataExibicao}

📝 *CRIAR LEMBRETE - PASSO 2/3*

⏰ *Que horas?*

📌 *Exemplo:* 23:00 ou 14:30

Digite o horário:`);
      return true;
    }
    
    // ===== ETAPA 2: RECEBER HORA =====
    if (userData.etapa === 'hora') {
      const horaTexto = body.trim();
      
      // Valida formato de hora (HH:MM)
      const matchHora = horaTexto.match(/^(\d{1,2})[:.](\d{2})$/);
      if (!matchHora) {
        await reply(`❌ *Horário inválido!*

📌 *Exemplo:* 23:00 ou 14:30

Digite o horário:`);
        return true;
      }
      
      const hora = parseInt(matchHora[1]);
      const minuto = parseInt(matchHora[2]);
      
      if (hora > 23 || minuto > 59) {
        await reply(`❌ *Horário inválido!*

⏰ Hora: 0-23
⏰ Minuto: 0-59

Digite o horário:`);
        return true;
      }
      
      // Verifica se a data com a hora é no futuro
      const dataHora = moment.tz(`${userData.data} ${hora.toString().padStart(2, '0')}:${minuto.toString().padStart(2, '0')}`, 'YYYY-MM-DD HH:mm', 'America/Sao_Paulo');
      const agora = moment().tz('America/Sao_Paulo');
      
      let dataHoraFinal = dataHora;
      if (dataHora.isBefore(agora)) {
        // Se já passou, adiciona 1 dia
        dataHoraFinal = dataHora.clone().add(1, 'day');
      }
      
      userData.hora = dataHoraFinal.format('HH:mm');
      userData.timestamp = dataHoraFinal.valueOf();
      userData.dataExibicao = dataHoraFinal.format('DD/MM/YYYY');
      userData.etapa = 'descricao';
      lembretesTemp.set(sender, userData);
      
      await reply(`⏰ *Horário definido:* ${userData.hora}

📝 *CRIAR LEMBRETE - PASSO 3/3*

📌 *O que você quer lembrar?*

Digite a descrição do lembrete:`);
      return true;
    }
    
    // ===== ETAPA 3: RECEBER DESCRIÇÃO =====
    if (userData.etapa === 'descricao') {
      const descricao = body.trim();
      
      if (descricao.length < 2) {
        await reply(`❌ *Descrição muito curta!*

Digite uma descrição mais detalhada:`);
        return true;
      }
      
      userData.descricao = descricao;
      
      // Cria o lembrete
      const novoId = dados.ultimoId + 1;
      
      const lembrete = {
        id: novoId,
        data: userData.data,
        hora: userData.hora,
        timestamp: userData.timestamp,
        descricao: userData.descricao,
        dataExibicao: `${userData.dataExibicao} ${userData.hora}`,
        status: 'pendente',
        criado_em: moment().tz('America/Sao_Paulo').format('YYYY-MM-DD HH:mm:ss'),
        criado_por: sender
      };
      
      dados.lembretes.push(lembrete);
      dados.ultimoId = novoId;
      salvarLembretes(dados);
      
      lembretesTemp.delete(sender);
      
      const hoje = moment().tz('America/Sao_Paulo').format('YYYY-MM-DD');
      const isHoje = userData.data === hoje;
      
      await reply(`✅ *Lembrete criado!* 🎯

📌 *ID:* #${novoId}
📅 *Data:* ${userData.dataExibicao}
⏰ *Hora:* ${userData.hora}
📝 *Descrição:* ${userData.descricao}
${isHoje ? '⏰ *Lembrete será disparado hoje!*' : ''}

💡 Use *.lembretes* para ver todos
💡 Use *.deletar [ID]* para remover`);
      
      return true;
    }
    
    return false;
  } catch (e) {
    lembretesTemp.delete(sender);
    throw e;
  }
}

// ============== FUNÇÃO PARA VER LEMBRETES ==============

async function verLembretes(sock, from, sender, pushname, reply) {
  try {
    const dados = carregarLembretes();
    const agora = moment().tz('America/Sao_Paulo');
    
    const pendentes = dados.lembretes.filter(l => l.status === 'pendente');
    
    if (pendentes.length === 0) {
      await reply('📭 *Nenhum lembrete pendente!*\n\nUse *.lembrar* para criar um novo.');
      return;
    }
    
    pendentes.sort((a, b) => a.timestamp - b.timestamp);
    
    const hoje = agora.format('YYYY-MM-DD');
    const amanha = agora.clone().add(1, 'day').format('YYYY-MM-DD');
    
    const hojeLembretes = pendentes.filter(l => l.data === hoje);
    const amanhãLembretes = pendentes.filter(l => l.data === amanha);
    const outrosLembretes = pendentes.filter(l => l.data !== hoje && l.data !== amanha);
    
    let texto = `📋 *LISTA DE LEMBRETES*\n\n`;
    
    if (hojeLembretes.length > 0) {
      texto += `🔴 *HOJE*\n`;
      hojeLembretes.forEach(l => {
        texto += `   ${l.id}. ${l.hora} - ${l.descricao}\n`;
      });
      texto += `\n`;
    }
    
    if (amanhãLembretes.length > 0) {
      texto += `🟡 *AMANHÃ*\n`;
      amanhãLembretes.forEach(l => {
        texto += `   ${l.id}. ${l.hora} - ${l.descricao}\n`;
      });
      texto += `\n`;
    }
    
    if (outrosLembretes.length > 0) {
      texto += `🔵 *OUTROS DIAS*\n`;
      outrosLembretes.forEach(l => {
        const data = moment.tz(l.data, 'YYYY-MM-DD', 'America/Sao_Paulo').format('DD/MM');
        texto += `   ${l.id}. ${data} ${l.hora} - ${l.descricao}\n`;
      });
      texto += `\n`;
    }
    
    texto += `📌 *Total:* ${pendentes.length} lembretes pendentes`;
    texto += `\n💡 Use *.deletar [ID]* para remover um lembrete`;
    texto += `\n💡 Use *.limpar* para remover todos`;
    
    await reply(texto);
  } catch (e) {
    throw e;
  }
}

// ============== FUNÇÃO PARA DELETAR LEMBRETE ==============

async function deletarLembrete(sock, from, sender, pushname, reply, id) {
  try {
    const dados = carregarLembretes();
    
    const index = dados.lembretes.findIndex(l => l.id === id && l.status === 'pendente');
    
    if (index === -1) {
      await reply(`❌ *Lembrete #${id} não encontrado ou já foi concluído!*`);
      return false;
    }
    
    const lembrete = dados.lembretes[index];
    dados.lembretes.splice(index, 1);
    salvarLembretes(dados);
    
    await reply(`🗑️ *Lembrete removido!*

📌 *ID:* #${id}
📅 *Data:* ${lembrete.dataExibicao}
📝 *Descrição:* ${lembrete.descricao}`);
    
    return true;
  } catch (e) {
    throw e;
  }
}

// ============== FUNÇÃO PARA LIMPAR TODOS OS LEMBRETES ==============

async function limparLembretes(sock, from, sender, pushname, reply) {
  try {
    const dados = carregarLembretes();
    const pendentes = dados.lembretes.filter(l => l.status === 'pendente');
    
    if (pendentes.length === 0) {
      await reply('📭 *Nenhum lembrete pendente para limpar!*');
      return false;
    }
    
    if (lembretesTemp.has(`limpar_${sender}`)) {
      await reply('⏳ Aguarde, já há um processo de limpeza em andamento.');
      return false;
    }
    
    lembretesTemp.set(`limpar_${sender}`, { etapa: 'confirmar', timestamp: Date.now() });
    
    await reply(`⚠️ *ATENÇÃO: LIMPAR TODOS OS LEMBRETES!*

📊 Você tem ${pendentes.length} lembretes pendentes

❗ *DIGITE "CONFIRMAR" PARA LIMPAR TUDO*
🔴 *DIGITE "CANCELAR" PARA CANCELAR*`);
    
    return true;
  } catch (e) {
    lembretesTemp.delete(`limpar_${sender}`);
    throw e;
  }
}

async function processarRespostaLimpar(sock, from, sender, pushname, body, reply) {
  try {
    const resposta = body.trim().toUpperCase();
    
    if (resposta === 'CONFIRMAR') {
      const dados = carregarLembretes();
      const qtd = dados.lembretes.filter(l => l.status === 'pendente').length;
      
      dados.lembretes = dados.lembretes.filter(l => l.status !== 'pendente');
      salvarLembretes(dados);
      
      lembretesTemp.delete(`limpar_${sender}`);
      await reply(`🗑️ *TODOS OS LEMBRETES FORAM REMOVIDOS!*

📊 Lembretes removidos: ${qtd}`);
      
      return true;
      
    } else if (resposta === 'CANCELAR') {
      lembretesTemp.delete(`limpar_${sender}`);
      await reply('✅ *Limpeza cancelada!*');
      return true;
      
    } else {
      await reply('❌ *Resposta inválida!*\nDigite *CONFIRMAR* para limpar ou *CANCELAR* para cancelar.');
      return false;
    }
  } catch (e) {
    lembretesTemp.delete(`limpar_${sender}`);
    throw e;
  }
}

// ============== FUNÇÃO PARA VERIFICAR RESPOSTAS INTERATIVAS ==============

function isEmConversaLembrete(sender) {
  return lembretesTemp.has(sender) || lembretesTemp.has(`limpar_${sender}`);
}

function isLimparConversa(sender) {
  return lembretesTemp.has(`limpar_${sender}`);
}

// ============== SISTEMA DE DISPARO DE LEMBRETES ==============

function iniciarVerificadorLembretes(sock, logger) {
  setInterval(async () => {
    try {
      if (!sock) return;
      
      const dados = carregarLembretes();
      const agora = moment().tz('America/Sao_Paulo');
      const agoraTimestamp = agora.valueOf();
      
      const lembretesParaDisparar = dados.lembretes.filter(l => {
        if (l.status !== 'pendente') return false;
        const diff = agoraTimestamp - l.timestamp;
        return diff >= -120000 && diff <= 120000;
      });
      
      for (const lembrete of lembretesParaDisparar) {
        try {
          await sock.sendMessage(lembrete.criado_por, { 
            text: `⏰ *LEMBRETE!*

📌 *ID:* #${lembrete.id}
📅 *Data:* ${lembrete.dataExibicao}
📝 *Descrição:* ${lembrete.descricao}

✅ Lembrete disparado com sucesso!` 
          });
          
          const dadosAtuais = carregarLembretes();
          const index = dadosAtuais.lembretes.findIndex(l => l.id === lembrete.id);
          if (index !== -1) {
            dadosAtuais.lembretes[index].status = 'concluido';
            salvarLembretes(dadosAtuais);
            if (logger) logger.success(`✅ Lembrete #${lembrete.id} disparado`);
          }
        } catch (e) {
          if (logger) logger.error(`Erro ao disparar lembrete #${lembrete.id}: ${e.message}`);
        }
      }
    } catch (e) {
      // Ignora erros no verificador
    }
  }, 60000);
}

// ============== EXPORTA FUNÇÕES ==============

module.exports = {
  initLembretes,
  carregarLembretes,
  salvarLembretes,
  iniciarLembrete,
  processarRespostaLembrete,
  verLembretes,
  deletarLembrete,
  limparLembretes,
  processarRespostaLimpar,
  isEmConversaLembrete,
  isLimparConversa,
  iniciarVerificadorLembretes,
  lembretesTemp
};