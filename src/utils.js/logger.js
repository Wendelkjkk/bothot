const fs = require('fs');
const chalk = require('chalk');
const moment = require('moment-timezone');

class Logger {
  constructor(timezone) {
    this.timezone = timezone;
    this.dailyDir = './logs/daily';
    this.logBuffer = [];
    this.bufferSize = 5;
    this.isWriting = false;
    
    if (!fs.existsSync('./logs')) fs.mkdirSync('./logs');
    if (!fs.existsSync(this.dailyDir)) fs.mkdirSync(this.dailyDir, { recursive: true });
    
    this.initDailyLog();
    setInterval(() => this.flushLogs(), 5000);
  }

  initDailyLog() {
    const today = moment().tz(this.timezone).format('YYYY-MM-DD');
    this.currentLogFile = `${this.dailyDir}/log_${today}.log`;
    
    if (!fs.existsSync(this.currentLogFile)) {
      fs.writeFileSync(this.currentLogFile, 
        `╔═══════════════════════════════════════════════════════════╗
║                    LOG DO BOT                            ║
║                    Data: ${today}                         ║
║              Iniciado em: ${moment().tz(this.timezone).format('HH:mm:ss')}  ║
╚═══════════════════════════════════════════════════════════╝\n`);
    }
  }

  log(level, message, data = null) {
    const timestamp = moment().tz(this.timezone).format('HH:mm:ss');
    const icons = {
      INFO: '📘', SUCCESS: '✅', WARNING: '⚠️', ERROR: '❌',
      COMMAND: '⚡', SYSTEM: '🔄', AUDIO: '🎵', REVELAR: '👀',
      PV: '💬', DEBUG: '🔍'
    };
    const colors = {
      INFO: chalk.blue, SUCCESS: chalk.green, WARNING: chalk.yellow,
      ERROR: chalk.red, COMMAND: chalk.magenta, SYSTEM: chalk.cyan,
      AUDIO: chalk.hex('#FF6B6B'), REVELAR: chalk.hex('#FF6BFF'),
      PV: chalk.hex('#00CED1'), DEBUG: chalk.gray
    };
    
    const logMessage = `${timestamp} ${icons[level] || '📌'} ${message}`;
    console.log((colors[level] || chalk.white)(logMessage));
    
    this.logBuffer.push(logMessage.replace(/\x1b\[[0-9;]*m/g, ''));
    if (this.logBuffer.length >= this.bufferSize) this.flushLogs();
  }

  async flushLogs() {
    if (this.isWriting || this.logBuffer.length === 0) return;
    this.isWriting = true;
    const logsToWrite = [...this.logBuffer];
    this.logBuffer = [];
    
    try {
      const today = moment().tz(this.timezone).format('YYYY-MM-DD');
      const currentFile = `${this.dailyDir}/log_${today}.log`;
      if (currentFile !== this.currentLogFile) {
        this.currentLogFile = currentFile;
        if (!fs.existsSync(this.currentLogFile)) {
          fs.writeFileSync(this.currentLogFile, 
            `╔═══════════════════════════════════════════════════════════╗
║                    LOG DO BOT                            ║
║                    Data: ${today}                         ║
║              Iniciado em: ${moment().tz(this.timezone).format('HH:mm:ss')}  ║
╚═══════════════════════════════════════════════════════════╝\n`);
        }
      }
      fs.appendFileSync(this.currentLogFile, logsToWrite.join('\n') + '\n');
    } finally {
      this.isWriting = false;
    }
  }

  cleanOldLogs(daysToKeep = 7) {
    try {
      const files = fs.readdirSync(this.dailyDir);
      const now = moment().tz(this.timezone);
      files.forEach(file => {
        if (file.startsWith('log_') && file.endsWith('.log')) {
          const dateStr = file.replace('log_', '').replace('.log', '');
          const fileDate = moment.tz(dateStr, 'YYYY-MM-DD', this.timezone);
          if (now.diff(fileDate, 'days') > daysToKeep) {
            fs.unlinkSync(`${this.dailyDir}/${file}`);
          }
        }
      });
    } catch (e) {}
  }

  info(msg) { this.log('INFO', msg); }
  success(msg) { this.log('SUCCESS', msg); }
  warning(msg) { this.log('WARNING', msg); }
  error(msg) { this.log('ERROR', msg); }
  command(msg) { this.log('COMMAND', msg); }
  system(msg) { this.log('SYSTEM', msg); }
  audio(msg) { this.log('AUDIO', msg); }
  revelar(msg) { this.log('REVELAR', msg); }
  pv(msg) { this.log('PV', msg); }
  debug(msg) { this.log('DEBUG', msg); }
}

module.exports = Logger;