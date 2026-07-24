const moment = require('moment-timezone');
const chalk = require('chalk');

function logError(logger, error, context = '') {
  logger.error(context ? `${context}: ${error.message}` : error.message);
}

function logMensagemPV(logger, timezone, pushname, sender, body, isGroup) {
  if (isGroup) return;
  
  const agora = moment().tz(timezone);
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
  
  logger.pv(`${pushname} (${sender}) enviou: ${preview}`);
}

function isOwner(sender, owner) {
  return sender ? sender.includes(owner) : false;
}

function isGroupChat(from) {
  return from ? from.endsWith('@g.us') : false;
}

function getSender(info, isGroup) {
  return isGroup ? (info.key.participant || info.key.remoteJid) : info.key.remoteJid;
}

function getCommandName(body, prefixos) {
  if (!body) return null;
  const isCmd = prefixos.some(p => body.startsWith(p));
  if (!isCmd) return null;
  
  const usedPrefix = prefixos.find(p => body.startsWith(p));
  const commandName = body.slice(usedPrefix.length).trim().split(/ +/).shift().toLowerCase();
  return commandName;
}

function getArgs(body, prefixos) {
  if (!body) return [];
  const isCmd = prefixos.some(p => body.startsWith(p));
  if (!isCmd) return [];
  
  const usedPrefix = prefixos.find(p => body.startsWith(p));
  const args = body.slice(usedPrefix.length).trim().split(/ +/).slice(1);
  return args;
}

module.exports = {
  logError,
  logMensagemPV,
  isOwner,
  isGroupChat,
  getSender,
  getCommandName,
  getArgs
};