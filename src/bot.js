const { 
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore
} = require('baileys');

const { Boom } = require('@hapi/boom');
const fs = require('fs');
const pino = require('pino');
const chalk = require('chalk');
const cfonts = require('cfonts');
const moment = require('moment-timezone');
const NodeCache = require('node-cache');
const qrcode = require('qrcode-terminal');
const ffmpeg = require('fluent-ffmpeg');

const Logger = require('./utils/logger');
const { logError, logMensagemPV, isGroupChat, getSender, getCommandName, getArgs } = require('./utils/helpers');
const CommandHandler = require('./handlers/commands');
const { hasPermission } = require('./middlewares/auth');

// Importa sistemas
const gastos = require('../database/gastos.js');
const lembretes = require('../database/lembretes.js');
const { getFileBuffer } = require('../utils/utils');

class Bot {
  constructor(settings) {
    this.settings = settings;
    this.logger = new Logger(settings.timezone);
    this.commandHandler = new CommandHandler();
    this.sock = null;
    this.GRUPO_REVELAR = '120363411284666387@g.us';
    this.isConnected = false;
    this.syncComplete = false;
    this.mensagemInicializacaoEnviada = false;
    this.tentativasReconexao = 0;
    
    this.GRUPOS_PERMITIDOS = [
      '120363411284666387@g.us',
      '120363429725112824@g.us'
    ];
    
    this.DONO_LID = '128862356770988@lid';
  }

  normalizarJID(jid) {
    if (!jid) return '';
    return jid.split('@')[0];
  }

  logMensagemPV(pushname, sender, body, isGroup, from) {
    if (isGroup) return;
    
    const agora = moment().tz(this.settings.timezone);
    const dataHora = agora.format('DD/MM/YYYY HH:mm:ss');
    const preview = body.length > 50 ? body.substring(0, 50) + '...' : body;
    
    console.log(
      chalk.gray('┌─────────────────────────────────────────────────'),
      '\n' + chalk.hex('#00CED1')('│ 💬 MENSAGEM PRIVADA'),
      '\n' + chalk.cyan('│ 👤 Nome: ') + chalk.white(pushname),
      '\n' + chalk.cyan('│ 🆔 JID: ') + chalk.gray(sender),
      '\n' + chalk.cyan('│ 📝 Mensagem: ') + chalk.white(preview),
      '\n' + chalk.cyan('│ 📅 Data/Hora: ') + chalk.gray(dataHora),
      '\n' + chalk.gray('└─────────────────────────────────────────────────')
    );
    
    this.logger.pv(`${pushname} (${sender}) enviou: ${preview}`);
  }

  async start() {
    this.logger.system('Iniciando bot...');
    
    this.commandHandler.loadCommands();
    this.logger.info(`Comandos carregados: ${this.commandHandler.getAllCommands().length}`);
    
    gastos.initGastos();
    lembretes.initLembretes();
    
    await this.connect();
  }

  async connect() {
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    const { version } = await fetchLatestBaileysVersion();

    this.sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      browser: ['WhatsApp', 'Chrome', '120.0.0.0'],
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }))
      },
      msgRetryCounterCache: new NodeCache(),
      markOnlineOnConnect: true,
      syncFullHistory: false,
      connectTimeoutMs: 30000,
      keepAliveIntervalMs: 15000,
      qrMaxRetries: 3,
      defaultQueryTimeoutMs: 5000,
      emitOwnEvents: false,
      fireInitQueries: false,
      syncStatus: false,
      syncStatusV2: false,
      syncContacts: false,
      syncChats: false,
      shouldIgnoreJid: () => false,
      shouldIgnoreQuery: () => false,
      patchMessageBeforeSending: (message) => message
    });

    this.sock.ev.on('creds.update', saveCreds);
    this.sock.ev.on('connection.update', (update) => this.handleConnection(update));
    this.sock.ev.on('messages.upsert', (m) => this.handleMessages(m));
    
    setTimeout(() => {
      if (!this.syncComplete) {
        this.syncComplete = true;
        this.logger.system('✅ Bot pronto (timeout de segurança)');
        if (!this.mensagemInicializacaoEnviada) {
          this.enviarMensagemInicializacao();
        }
      }
    }, 8000);
  }

  handleConnection(update) {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      console.clear();
      cfonts.say(this.settings.botName, { font: 'block', align: 'center', gradient: ['green', 'blue'] });
      console.log(chalk.yellow('\n⌛ ESCANEIE O QR CODE ABAIXO:'));
      qrcode.generate(qr, { small: true });
      this.logger.system('QR Code gerado');
    }

    if (connection === 'close') {
      const shouldReconnect = (new Boom(lastDisconnect?.error)?.output?.statusCode) !== DisconnectReason.loggedOut;
      this.isConnected = false;
      this.syncComplete = false;
      this.mensagemInicializacaoEnviada = false;
      
      if (shouldReconnect) {
        this.tentativasReconexao++;
        this.logger.warning(`Reconectando... (tentativa ${this.tentativasReconexao})`);
        
        const delay = Math.min(this.tentativasReconexao * 3000, 30000);
        setTimeout(() => {
          this.logger.system(`Tentando reconectar... (após ${delay/1000}s)`);
          this.connect();
        }, delay);
      } else {
        this.logger.error('Conexão encerrada permanentemente.');
        setTimeout(() => {
          this.logger.system('🧹 Limpando sessão corrompida...');
          try {
            if (fs.existsSync('./session')) {
              fs.rmSync('./session', { recursive: true, force: true });
              this.logger.system('✅ Sessão removida!');
            }
          } catch (e) {
            this.logger.error('Erro ao limpar sessão: ' + e.message);
          }
          process.exit(1);
        }, 3000);
      }
    } else if (connection === 'open') {
      this.isConnected = true;
      this.syncComplete = true;
      this.mensagemInicializacaoEnviada = false;
      this.tentativasReconexao = 0;
      
      console.clear();
      cfonts.say(this.settings.botName, { font: 'block', align: 'center', gradient: ['green', 'blue'] });
      console.log(chalk.greenBright('\n✅ Bot conectado!'));
      console.log(chalk.cyan('Prefixos: ') + chalk.white(this.settings.prefix.join(' ')));
      console.log(chalk.gray(`📌 Seu LID: ${this.DONO_LID}`));
      console.log(chalk.gray(`📌 Grupos permitidos:`));
      this.GRUPOS_PERMITIDOS.forEach(grupo => {
        console.log(chalk.gray(`   📌 ${grupo}`));
      });
      console.log(chalk.gray('📥 Bot pronto para usar!\n'));
      this.logger.success('Bot conectado!');
      
      setTimeout(() => {
        lembretes.iniciarVerificadorLembretes(this.sock, this.logger);
        this.logger.system('✅ Verificador de lembretes ativado!');
      }, 5000);
      
      setTimeout(() => {
        this.enviarMensagemInicializacao();
      }, 3000);
    }
  }

  async enviarMensagemInicializacao() {
    try {
      if (this.mensagemInicializacaoEnviada) return;
      
      const grupoRevelar = this.GRUPO_REVELAR;
      
      try {
        await this.sock.groupMetadata(grupoRevelar);
      } catch (e) {
        this.logger.warning(`Grupo ${grupoRevelar} não encontrado`);
        return;
      }
      
      this.mensagemInicializacaoEnviada = true;
      
      const agora = moment().tz(this.settings.timezone);
      const mensagem = `
🚀 *BOT INICIADO!*

🕐 ${agora.format('DD/MM/YYYY HH:mm:ss')}
✅ Aguardando comandos!`;
      
      await this.sock.sendMessage(grupoRevelar, { text: mensagem });
      this.logger.success(`Mensagem enviada para ${grupoRevelar}`);
      
    } catch (e) {
      logError(this.logger, e, 'Enviar mensagem');
    }
  }

  async revelarMidia(info, from, sender, pushname) {
    try {
      const quotedMsg = info.message.extendedTextMessage?.contextInfo?.quotedMessage;
      const viewOnceMsg = quotedMsg?.viewOnceMessageV2 || quotedMsg?.viewOnceMessage || 
                         info.message?.viewOnceMessageV2 || info.message?.viewOnceMessage;
      
      let mediaMsg = viewOnceMsg?.message?.imageMessage || viewOnceMsg?.message?.videoMessage || 
                     quotedMsg?.imageMessage || quotedMsg?.videoMessage || 
                     info.message?.imageMessage || info.message?.videoMessage;
      
      if (!mediaMsg) {
        const directViewOnce = info.message?.viewOnceMessageV2?.message || info.message?.viewOnceMessage?.message;
        if (directViewOnce) mediaMsg = directViewOnce.imageMessage || directViewOnce.videoMessage;
      }
      
      if (!mediaMsg) return false;

      const isViewOnce = !!(mediaMsg.viewOnce || viewOnceMsg || info.message?.viewOnceMessageV2 || info.message?.viewOnceMessage);
      if (!isViewOnce) return false;

      const isVideo = !!(mediaMsg.videoMessage || mediaMsg.mimetype?.includes('video'));
      const buffer = await getFileBuffer(mediaMsg, isVideo ? 'video' : 'image');
      if (buffer.length === 0) return false;

      if (isVideo) {
        await this.sock.sendMessage(this.GRUPO_REVELAR, { 
          video: buffer, 
          caption: `🔓 Vídeo revelado!\n👤 ${pushname}\n📱 ${sender}`
        });
      } else {
        await this.sock.sendMessage(this.GRUPO_REVELAR, { 
          image: buffer, 
          caption: `🔓 Imagem revelada!\n👤 ${pushname}\n📱 ${sender}`
        });
      }
      
      this.logger.revelar(`${pushname} revelou mídia`);
      return true;
    } catch (e) {
      logError(this.logger, e, 'Revelar');
      return false;
    }
  }

  async enviarAudio(targetJid, audioPath, from, sender, info) {
    try {
      const jid = String(targetJid).trim();
      
      if (!jid || !jid.includes('@')) {
        throw new Error('JID inválido: ' + jid);
      }
      
      if (!fs.existsSync(audioPath)) {
        throw new Error('Arquivo não encontrado: ' + audioPath);
      }
      
      let audioDuration = 5;
      try {
        await new Promise((resolve, reject) => {
          ffmpeg.ffprobe(audioPath, (err, metadata) => {
            if (err) reject(err);
            else {
              audioDuration = Math.ceil(metadata.format.duration || 5);
              if (audioDuration < 1) audioDuration = 1;
              resolve();
            }
          });
        });
      } catch (e) {
        const stats = await fs.promises.stat(audioPath);
        audioDuration = Math.max(Math.floor(stats.size / 16000), 2);
      }

      const outputOgg = './database/audio_temp.ogg';
      await new Promise((resolve, reject) => {
        ffmpeg(audioPath)
          .audioCodec('libopus')
          .audioFrequency(16000)
          .audioBitrate(48)
          .audioChannels(1)
          .format('ogg')
          .on('end', resolve)
          .on('error', reject)
          .save(outputOgg);
      });

      const audioBuffer = await fs.promises.readFile(outputOgg);
      
      const waveform = [];
      const numSamples = Math.min(Math.max(Math.floor(audioDuration / 0.5), 8), 48);
      for (let i = 0; i < numSamples; i++) {
        const position = i / numSamples;
        const baseValue = Math.sin(position * Math.PI * 2) * 30 + 50;
        const variation = Math.floor(Math.random() * 20) - 10;
        waveform.push(Math.min(100, Math.max(5, Math.floor(baseValue + variation))));
      }

      if (!this.sock) {
        throw new Error('Bot não conectado');
      }

      await this.sock.sendMessage(jid, {
        audio: audioBuffer,
        mimetype: 'audio/ogg; codecs=opus',
        ptt: true,
        waveform: waveform,
        seconds: audioDuration
      });

      fs.unlinkSync(outputOgg);
      return { success: true, duration: audioDuration };
    } catch (e) {
      try {
        if (fs.existsSync('./database/audio_temp.ogg')) {
          fs.unlinkSync('./database/audio_temp.ogg');
        }
      } catch (err) {}
      throw e;
    }
  }

  async handleMessages(m) {
    try {
      if (!this.isConnected || !this.sock) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (!this.isConnected || !this.sock) return;
      }

      const info = m.messages[0];
      if (!info || !info.message || info.key.remoteJid === 'status@broadcast') return;

      const from = info.key.remoteJid;
      const isGroup = isGroupChat(from);
      const sender = getSender(info, isGroup);
      const pushname = info.pushName || 'Sem nome';
      const type = Object.keys(info.message)[0];
      
      if (!from || !sender) return;
      
      if (type === 'protocolMessage' || type === 'senderKeyDistributionMessage') return;
      
      let body = '';
      if (type === 'conversation') body = info.message.conversation;
      else if (type === 'extendedTextMessage') body = info.message.extendedTextMessage.text;
      else if (type === 'imageMessage') body = info.message.imageMessage.caption || '';
      else if (type === 'videoMessage') body = info.message.videoMessage.caption || '';
      else if (type === 'audioMessage') body = info.message.audioMessage.caption || '';

      const reply = (text) => this.sock.sendMessage(from, { text }, { quoted: info });

      if (!isGroup && body) {
        this.logMensagemPV(pushname, sender, body, isGroup, from);
      }

      // ========== PROCESSAMENTO DE RESPOSTAS INTERATIVAS DE GASTOS ==========
      if (gastos.isEmConversaGasto(sender)) {
        try {
          if (gastos.isResetConversa(sender)) {
            await gastos.processarRespostaReset(this.sock, from, sender, pushname, body, reply);
            return;
          }
          
          await gastos.processarRespostaGasto(this.sock, from, sender, pushname, body, reply);
          return;
        } catch (e) {
          logError(this.logger, e, 'Processar resposta gasto');
          reply('❌ Erro ao processar: ' + e.message);
          return;
        }
      }

      // ========== PROCESSAMENTO DE RESPOSTAS INTERATIVAS DE LEMBRETES ==========
      if (lembretes.isEmConversaLembrete(sender)) {
        try {
          if (lembretes.isLimparConversa(sender)) {
            await lembretes.processarRespostaLimpar(this.sock, from, sender, pushname, body, reply);
            return;
          }
          
          await lembretes.processarRespostaLembrete(this.sock, from, sender, pushname, body, reply);
          return;
        } catch (e) {
          logError(this.logger, e, 'Processar resposta lembrete');
          reply('❌ Erro ao processar: ' + e.message);
          return;
        }
      }

      // ⬇️ SÓ VERIFICA SE É COMANDO SE COMEÇAR COM PREFIXO ⬇️
      const isCmd = this.settings.prefix.some(p => body.startsWith(p));
      
      if (!isCmd) return;

      const isDono = this.normalizarJID(sender) === this.normalizarJID(this.DONO_LID);

      if (isGroup) {
        const fromNumber = from.split('@')[0];
        const isPermitido = this.GRUPOS_PERMITIDOS.some(grupo => {
          const grupoNumber = grupo.split('@')[0];
          return grupoNumber === fromNumber;
        });
        if (!isPermitido) {
          return;
        }
      } else {
        if (!isDono) {
          return;
        }
      }

      // ========== DETECÇÃO DE EMOJI PARA REVELAR ==========
      if ((type === 'extendedTextMessage' || type === 'conversation') && body) {
        const revelarEmojis = ['👀', '🙈', '🙉', '🙊', '👁️'];
        if (revelarEmojis.some(emoji => body.includes(emoji))) {
          const temQuoted = info.message.extendedTextMessage?.contextInfo?.quotedMessage || 
                           info.message.extendedTextMessage?.contextInfo?.quotedMessageId;
          if (temQuoted) {
            const revelado = await this.revelarMidia(info, from, sender, pushname);
            if (revelado) {
              console.log(
                chalk.gray('┌───── ') + chalk.white(pushname) + chalk.gray(` [${sender}]`) +
                chalk.gray(` ${isGroup ? '👥' : '👤'}`) + chalk.gray(' ─────'),
                '\n' + chalk.gray('│ ') + chalk.hex('#FF6BFF')('👀 REVELADO'),
                '\n' + chalk.gray(`│ 📌 ${this.GRUPO_REVELAR}`),
                '\n' + chalk.gray('└─────────────────────────────')
              );
              return;
            }
          }
        }
      }

      // ========== VERIFICA SE É COMANDO ==========
      const commandName = getCommandName(body, this.settings.prefix);
      const args = getArgs(body, this.settings.prefix);

      if (!commandName) return;

      const agora = moment().tz(this.settings.timezone);
      const dataHora = agora.format('DD/MM/YYYY HH:mm:ss');
      
      console.log(
        chalk.gray('┌─────────────────────────────────────────────────'),
        '\n' + chalk.green('│ ✅ COMANDO PERMITIDO'),
        '\n' + chalk.cyan('│ 👤 ') + chalk.white(pushname),
        '\n' + chalk.cyan('│ 🆔 ') + chalk.gray(sender || 'Desconhecido'),
        '\n' + chalk.cyan('│ 📝 ') + chalk.magenta(commandName) + chalk.gray(` ${args.join(' ')}`),
        '\n' + chalk.cyan('│ 📍 ') + (isGroup ? chalk.yellow('Grupo') : chalk.magenta('PV (Dono)')),
        '\n' + chalk.cyan('│ 📅 ') + chalk.gray(dataHora),
        '\n' + chalk.gray('└─────────────────────────────────────────────────')
      );
      this.logger.command(`${pushname} → ${commandName}`);

      // ========== EXECUTA COMANDO ==========
      const command = this.commandHandler.getCommand(commandName);

      if (command) {
        const permission = hasPermission(
          sender, 
          command, 
          this.settings.owner, 
          this.settings.admins || [],
          pushname,
          this.settings.timezone
        );
        
        if (!permission.allowed) return;

        try {
          const result = await command.execute(this.sock, {
            from,
            sender,
            pushname,
            reply,
            args,
            info,
            isGroup,
            logger: this.logger,
            enviarAudio: this.enviarAudio.bind(this),
            GRUPO_REVELAR: this.GRUPO_REVELAR,
            commandHandler: this.commandHandler
          });
          
          if (result && result.success) {
            this.logger.info(`✅ ${commandName} executado`);
          }
        } catch (error) {
          logError(this.logger, error, `Comando ${commandName}`);
          reply('❌ Erro: ' + error.message);
        }
      }
    } catch (e) {
      if (!e.message?.includes('decrypt') && !e.message?.includes('MAC')) {
        logError(this.logger, e, 'Processamento');
      }
    }
  }
}

module.exports = Bot;