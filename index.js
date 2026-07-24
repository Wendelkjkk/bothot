const fs = require('fs');
const chalk = require('chalk');
const Bot = require('./src/bot');

// ============== CARREGA CONFIGURAÇÕES ==============
const settings = JSON.parse(fs.readFileSync('./settings/settings.json'));

// ============== INICIALIZA O BOT ==============
const bot = new Bot(settings);
bot.start();

// ============== TRATAMENTO DE ERROS ==============
process.on('uncaughtException', (error) => {
  console.error(chalk.red('❌ Erro crítico:'), error.message);
  setTimeout(() => process.exit(1), 3000);
});

process.on('unhandledRejection', (reason) => {
  console.error(chalk.red('❌ Promessa rejeitada:'), reason);
});

['SIGINT', 'SIGTERM'].forEach(signal => {
  process.on(signal, async () => {
    console.log(chalk.yellow('\n🔄 Desligando...'));
    process.exit(0);
  });
});