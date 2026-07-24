const fs = require('fs');
const path = require('path');

class CommandHandler {
  constructor() {
    this.commands = new Map();
    this.aliases = new Map();
  }

  loadCommands() {
    const commandsPath = path.join(__dirname, '../commands');
    
    if (!fs.existsSync(commandsPath)) {
      console.log('⚠️ Pasta de comandos não encontrada:', commandsPath);
      return;
    }
    
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
      try {
        const command = require(path.join(commandsPath, file));
        
        if (!command.name) {
          console.log(`⚠️ Comando ${file} não tem nome definido`);
          continue;
        }
        
        this.commands.set(command.name, command);
        
        if (command.aliases && Array.isArray(command.aliases)) {
          for (const alias of command.aliases) {
            this.aliases.set(alias, command.name);
          }
        }
        
        console.log(`✅ Comando carregado: ${command.name}`);
      } catch (error) {
        console.error(`❌ Erro ao carregar comando ${file}:`, error.message);
      }
    }
  }

  getCommand(name) {
    if (!name) return null;
    return this.commands.get(name) || this.commands.get(this.aliases.get(name));
  }

  getAllCommands() {
    return Array.from(this.commands.values());
  }
}

module.exports = CommandHandler;