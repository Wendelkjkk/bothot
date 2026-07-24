const moment = require('moment-timezone');
const chalk = require('chalk');

module.exports = {
  name: 'lid',
  aliases: ['who', 'id'],
  description: 'Mostra o LID da pessoa no console (discreto)',
  usage: '.lid',
  category: 'util',
  ownerOnly: false,
  
  async execute(sock, { from, sender, pushname, reply, logger, isGroup, args }) {
    try {
      // Pega a data e hora atual
      const agora = moment().tz('America/Sao_Paulo');
      const dataHora = agora.format('DD/MM/YYYY HH:mm:ss');
      
      // ⬇️ MOSTRA NO CONSOLE (formatado bonito) ⬇️
      console.log(
        chalk.gray('┌─────────────────────────────────────────────────'),
        '\n' + chalk.hex('#FF6BFF')('│ 🆔 LID SOLICITADO'),
        '\n' + chalk.cyan('│ 👤 Nome: ') + chalk.white(pushname),
        '\n' + chalk.cyan('│ 🆔 LID: ') + chalk.gray(sender),
        '\n' + chalk.cyan('│ 📍 Local: ') + (isGroup ? chalk.yellow(from) : chalk.magenta('PV')),
        '\n' + chalk.cyan('│ 📅 Data/Hora: ') + chalk.gray(dataHora),
        '\n' + chalk.gray('└─────────────────────────────────────────────────')
      );
      
      // ⬇️ SALVA NO LOG ⬇️
      logger.info(`LID de ${pushname}: ${sender}`);
      
      // ⬇️ NÃO ENVIA NADA NO CHAT ⬇️
      // O bot não responde, é completamente discreto
      
      return { success: true, silent: true };
    } catch (error) {
      throw error;
    }
  }
};