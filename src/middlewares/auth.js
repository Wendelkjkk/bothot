/**
 * Middleware de autenticação
 */

const chalk = require('chalk');
const moment = require('moment-timezone');

function isOwner(sender, owner) {
  return sender ? sender.includes(owner) : false;
}

function isAdmin(sender, admins) {
  if (!admins || !Array.isArray(admins)) return false;
  return admins.some(admin => sender.includes(admin));
}

function hasPermission(sender, command, owner, admins = [], pushname = 'Desconhecido', timezone = 'America/Sao_Paulo') {
  const isOwnerUser = isOwner(sender, owner);
  const isAdminUser = isAdmin(sender, admins);
  
  // Verifica se o comando é apenas para dono
  if (command.ownerOnly && !isOwnerUser) {
    const agora = moment().tz(timezone);
    const dataHora = agora.format('DD/MM/YYYY HH:mm:ss');
    
    console.log(
      chalk.gray('┌─────────────────────────────────────────────────'),
      '\n' + chalk.red('│ 🚫 COMANDO NEGADO - APENAS DONO'),
      '\n' + chalk.cyan('│ 👤 Nome: ') + chalk.white(pushname),
      '\n' + chalk.cyan('│ 🆔 LID: ') + chalk.gray(sender),
      '\n' + chalk.cyan('│ ⚡ Comando: ') + chalk.red(command.name || 'Desconhecido'),
      '\n' + chalk.cyan('│ 📅 Data/Hora: ') + chalk.gray(dataHora),
      '\n' + chalk.cyan('│ 📝 Motivo: ') + chalk.yellow('Comando apenas para o dono!'),
      '\n' + chalk.gray('└─────────────────────────────────────────────────')
    );
    
    return { 
      allowed: false, 
      message: `❌ Apenas o dono pode usar este comando!`,
      showInChat: false
    };
  }
  
  // Verifica se o comando é apenas para admin
  if (command.adminOnly && !isOwnerUser && !isAdminUser) {
    const agora = moment().tz(timezone);
    const dataHora = agora.format('DD/MM/YYYY HH:mm:ss');
    
    console.log(
      chalk.gray('┌─────────────────────────────────────────────────'),
      '\n' + chalk.yellow('│ ⚠️ COMANDO NEGADO - APENAS ADMIN'),
      '\n' + chalk.cyan('│ 👤 Nome: ') + chalk.white(pushname),
      '\n' + chalk.cyan('│ 🆔 LID: ') + chalk.gray(sender),
      '\n' + chalk.cyan('│ ⚡ Comando: ') + chalk.yellow(command.name || 'Desconhecido'),
      '\n' + chalk.cyan('│ 📅 Data/Hora: ') + chalk.gray(dataHora),
      '\n' + chalk.cyan('│ 📝 Motivo: ') + chalk.yellow('Comando apenas para administradores!'),
      '\n' + chalk.gray('└─────────────────────────────────────────────────')
    );
    
    return { 
      allowed: false, 
      message: `❌ Apenas administradores podem usar este comando!`,
      showInChat: false
    };
  }
  
  return { allowed: true };
}

module.exports = {
  isOwner,
  isAdmin,
  hasPermission
};