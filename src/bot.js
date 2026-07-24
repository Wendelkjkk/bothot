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
const { logError, logMensagemPV, isOwner, isGroupChat, getSender, getCommandName, getArgs } = require('./utils/helpers');
const CommandHandler = require('./handlers/commands');
const { hasPermission } = require('./middlewares/auth');

// Importa sistema de gastos
const gastos = require('../database/gastos.js');
const { getFileBuffer } = require('../utils/utils');

class Bot {
  constructor(settings) {
    this.settings = settings;
    this.logger = new Logger(settings.timezone);
    this.commandHandler = new CommandHandler();
    this.sock = null;
    this.GRUPO_REVELAR = '120363411284666387@g.us';
    
    // LISTA DE GRUPOS PERMITIDOS
    this.GRUPOS_PERMITIDOS = [
      '120363411284666387@g.us',
      '120363429725112824@g.us'
    ];
  }

  async start() {
    this.logger.system('Iniciando bot...');
    
    this.commandHandler.loadCommands();
    this.logger.info(`Comandos carregados: ${this.commandHandler.getAllCommands().length}`);
    
    gastos.initGastos();
    
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
      shouldSyncHistoryMessage: () => false,
      patchMessageBeforeSending: (message) => message,
      defaultQueryTimeoutMs: 3000,
      generateHighQualityLinkPreview: false,
      linkPreviewImageThumbnailWidth: 0,
      receivePresenceUpdates: false,
      fireInitQueries: false,
      syncStatus: false,
      syncStatusV2: false,
      syncContacts: false,
      syncChats: false,
      shouldIgnoreJid: () => false,
      shouldIgnoreQuery: () => false,
      qrMaxRetries: 3,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 10000,
      emitOwnEvents: false
    });

    this.sock.ev.on('creds.update', saveCreds);
    this.sock.ev.on('connection.update', (update) => this.handleConnection(update));
    this.sock.ev.on('messages.upsert', (m) => this.handleMessages(m));
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
      if (shouldReconnect) {
        this.logger.warning('Reconectando...');
        setTimeout(() => this.connect(), 3000);
      } else {
        this.logger.error('Conexão encerrada');
      }
    } else if (connection === 'open') {
      console.clear();
      cfonts.say(this.settings.botName, { font: 'block', align: 'center', gradient: ['green', 'blue'] });
      console.log(chalk.greenBright('\n✅ Bot conectado!'));
      console.log(chalk.cyan('Prefixos: ') + chalk.white(this.settings.prefix.join(' ')));
      console.log(chalk.gray(`📌 Grupos permitidos:`));
      this.GRUPOS_PERMITIDOS.forEach(grupo => {
        console.log(chalk.gray(`   📌 ${grupo}`));
      });
      console.log(chalk.gray('💡 Use !jid para ver o JID\n'));
      this.logger.success('Bot conectado!');
      
      setTimeout(() => this.enviarMensagemInicializacao(), 5000);
    }
  }

  async enviarMensagemInicializacao() {
    try {
      const grupoRevelar = this.GRUPO_REVELAR;
      
      try {
        await this.sock.groupMetadata(grupoRevelar);
      } catch (e) {
        this.logger.warning(`Grupo ${grupoRevelar} não encontrado ou bot não está no grupo`);
        return;
      }
      
      const agora = moment().tz(this.settings.timezone);
      const mensagem = `
🚀 *BOT INICIADO COM SUCESSO!*

📱 *Status:* Online e pronto para comandos
🕐 *Hora:* ${agora.format('DD/MM/YYYY HH:mm:ss')}

✅ Bot aguardando comandos!`;
      
      await this.sock.sendMessage(grupoRevelar, { text: mensagem });
      this.logger.success(`Mensagem de inicialização enviada para ${grupoRevelar}`);
      
    } catch (e) {
      logError(this.logger, e, 'Enviar mensagem inicialização');
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
          caption: `🔓 Vídeo revelado!\n👤 Revelado por: ${pushname}\n📱 JID: ${sender}`
        });
      } else {
        await this.sock.sendMessage(this.GRUPO_REVELAR, { 
          image: buffer, 
          caption: `🔓 Imagem revelada!\n👤 Revelado por: ${pushname}\n📱 JID: ${sender}`
        });
      }
      
      this.logger.revelar(`${pushname} revelou mídia no grupo ${this.GRUPO_REVELAR}`);
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
      const info = m.messages[0];
      if (!info || !info.message || info.key.remoteJid === 'status@broadcast') return;
      
      if (info.messageTimestamp) {
        const now = Math.floor(Date.now() / 1000);
        const msgTime = typeof info.messageTimestamp === 'string' ? parseInt(info.messageTimestamp) : info.messageTimestamp;
        const timeDiff = now - msgTime;
        
        if (timeDiff > 5) {
          return;
        }
      }

      const from = info.key.remoteJid;
      const isGroup = isGroupChat(from);
      
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
        return;
      }
      
      const sender = getSender(info, isGroup);
      const pushname = info.pushName || 'Sem nome';
      const type = Object.keys(info.message)[0];
      
      if (!from || !sender) {
        this.logger.warning('Mensagem sem JID válido, ignorando...');
        return;
      }
      
      if (type === 'protocolMessage' || type === 'senderKeyDistributionMessage') {
        return;
      }
      
      let body = '';
      if (type === 'conversation') body = info.message.conversation;
      else if (type === 'extendedTextMessage') body = info.message.extendedTextMessage.text;
      else if (type === 'imageMessage') body = info.message.imageMessage.caption || '';
      else if (type === 'videoMessage') body = info.message.videoMessage.caption || '';
      else if (type === 'audioMessage') body = info.message.audioMessage.caption || '';

      const reply = (text) => this.sock.sendMessage(from, { text }, { quoted: info });

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

      if ((type === 'extendedTextMessage' || type === 'conversation') && body) {
        const revelarEmojis = ['👀', '🙈', '🙉', '🙊', '🔍', '👁️'];
        if (revelarEmojis.some(emoji => body.includes(emoji))) {
          const temQuoted = info.message.extendedTextMessage?.contextInfo?.quotedMessage || 
                           info.message.extendedTextMessage?.contextInfo?.quotedMessageId;
          if (temQuoted) {
            const revelado = await this.revelarMidia(info, from, sender, pushname);
            if (revelado) {
              console.log(
                chalk.gray('┌───── ') + chalk.white(pushname) + chalk.gray(` [${sender}]`) +
                chalk.gray(` ${isGroup ? '👥' : '👤'}`) + chalk.gray(' ─────'),
                '\n' + chalk.gray('│ ') + chalk.hex('#FF6BFF')('👀 REVELADO NO GRUPO'),
                '\n' + chalk.gray(`│ 📌 ${this.GRUPO_REVELAR}`),
                '\n' + chalk.gray('└─────────────────────────────')
              );
              return;
            }
          }
        }
      }

      const commandName = getCommandName(body, this.settings.prefix);
      const args = getArgs(body, this.settings.prefix);

      if (!commandName) return;

      const agora = moment().tz(this.settings.timezone);
      const dataHora = agora.format('DD/MM/YYYY HH:mm:ss');
      
      console.log(
        chalk.gray('┌─────────────────────────────────────────────────'),
        '\n' + chalk.magenta('│ ⚡ COMANDO EXECUTADO'),
        '\n' + chalk.cyan('│ 👤 Nome: ') + chalk.white(pushname),
        '\n' + chalk.cyan('│ 🆔 JID: ') + chalk.gray(sender || 'Desconhecido'),
        '\n' + chalk.cyan('│ ⚡ Comando: ') + chalk.magenta(commandName) + chalk.gray(` ${args.join(' ')}`),
        '\n' + chalk.cyan('│ 📍 Local: ') + (isGroup ? chalk.yellow('Grupo') : chalk.magenta('Privado')),
        '\n' + chalk.cyan('│ 📅 Data/Hora: ') + chalk.gray(dataHora),
        '\n' + chalk.gray('└─────────────────────────────────────────────────')
      );
      this.logger.command(`${pushname} (${sender || 'Desconhecido'}) → ${commandName}`);

      const command = this.commandHandler.getCommand(commandName);

      if (command) {
        const permission = hasPermission(sender, command, this.settings.owner, this.settings.admins || []);
        if (!permission.allowed) {
          this.logger.warning(`🚫 ${pushname} (${sender}) tentou usar "${commandName}" sem permissão`);
          
          console.log(
            chalk.gray('┌─────────────────────────────────────────────────'),
            '\n' + chalk.red('│ 🚫 PERMISSÃO NEGADA'),
            '\n' + chalk.cyan('│ 👤 Nome: ') + chalk.white(pushname),
            '\n' + chalk.cyan('│ 🆔 JID: ') + chalk.gray(sender),
            '\n' + chalk.cyan('│ ⚡ Comando: ') + chalk.red(commandName),
            '\n' + chalk.cyan('│ 📝 Motivo: ') + chalk.yellow('Apenas o dono pode usar comandos!'),
            '\n' + chalk.gray('└─────────────────────────────────────────────────')
          );
          
          return;
        }

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
            this.logger.info(`Comando ${commandName} executado por ${pushname}`);
          }
        } catch (error) {
          logError(this.logger, error, `Comando ${commandName}`);
          reply('❌ Erro ao executar comando: ' + error.message);
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