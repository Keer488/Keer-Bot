const mineflayer = require('mineflayer');
const config = require('./config');
const logger = require('./utils/logger');
const BotCore = require('./bot/core');
const ChatHandler = require('./bot/chat');
const NavigationHandler = require('./bot/navigation');
const InventoryHandler = require('./bot/inventory');
const TaskHandler = require('./bot/tasks');
const CommandHandler = require('./commands');
const WebServer = require('./server');

class MinecraftBot {
    constructor() {
        this.bot = null;
        this.core = null;
        this.chat = null;
        this.navigation = null;
        this.inventory = null;
        this.tasks = null;
        this.commands = null;
        this.webServer = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = config.maxReconnectAttempts;
        this.reconnectDelay = config.reconnectDelay;
    }

    async start() {
        try {
            logger.info('Starting Minecraft bot and web server...');
            
            // Start web server first
            this.webServer = new WebServer();
            this.webServer.start();
            
            // Then connect the bot
            await this.connect();
        } catch (error) {
            logger.error('Failed to start bot:', error);
            process.exit(1);
        }
    }

    async connect() {
        try {
            // Check if we already have a bot instance
            if (this.bot) {
                this.bot.removeAllListeners();
                this.bot = null;
            }

            logger.info(`Attempting to connect to ${config.server.host}:${config.server.port} as ${config.bot.username}`);

            // Create bot instance
            this.bot = mineflayer.createBot({
                host: config.server.host,
                port: config.server.port,
                username: config.bot.username,
                password: config.bot.password,
                version: config.server.version || false, // Use specified version or auto-detect
                auth: config.bot.auth
            });

            // Initialize handlers
            this.initializeHandlers();
            this.setupEventListeners();

        } catch (error) {
            logger.error('Connection error:', error.message || error);
            // Clean up failed bot instance
            if (this.bot) {
                this.bot.removeAllListeners();
                this.bot = null;
            }
            this.handleReconnect();
        }
    }

    initializeHandlers() {
        this.core = new BotCore(this.bot);
        this.chat = new ChatHandler(this.bot, this.core);
        this.navigation = new NavigationHandler(this.bot);
        this.inventory = new InventoryHandler(this.bot);
        this.tasks = new TaskHandler(this.bot, this.navigation, this.inventory);
        
        // Connect TaskHandler to BotCore for retaliation system
        this.core.setTaskHandler(this.tasks);
        
        this.commands = new CommandHandler(this.bot, {
            core: this.core,
            navigation: this.navigation,
            inventory: this.inventory,
            tasks: this.tasks
        });
        
        // Connect bot to web server
        if (this.webServer) {
            this.webServer.setMinecraftBot(this);
        }
    }

    setupEventListeners() {
        // Connection events
        this.bot.on('login', () => {
            logger.info(`Bot logged in successfully as ${this.bot.username}`);
            this.reconnectAttempts = 0;
        });

        this.bot.on('spawn', () => {
            logger.info('Bot spawned in the world');
            logger.info(`Position: ${this.bot.entity.position.toString()}`);
            logger.info(`Health: ${this.bot.health}/20`);
            logger.info(`Food: ${this.bot.food}/20`);
        });

        // Error handling
        this.bot.on('error', (err) => {
            logger.error('Bot error:', err.message || err);
            // Clean up the bot instance to prevent further events
            if (this.bot) {
                this.bot.removeAllListeners();
                this.bot = null;
            }
            this.handleReconnect();
        });

        this.bot.on('end', (reason) => {
            logger.warn('Bot disconnected:', reason);
            // Clean up the bot instance
            if (this.bot) {
                this.bot.removeAllListeners();
                this.bot = null;
            }
            this.handleReconnect();
        });

        this.bot.on('kicked', (reason) => {
            logger.warn('Bot was kicked:', reason);
            // Clean up the bot instance
            if (this.bot) {
                this.bot.removeAllListeners();
                this.bot = null;
            }
            this.handleReconnect();
        });

        // Health monitoring
        this.bot.on('health', () => {
            if (this.bot.health <= 0) {
                logger.warn('Bot died! Respawning...');
                this.bot.respawn();
            }
        });

        // Chat events (delegate to chat handler)
        this.bot.on('chat', (username, message) => {
            this.chat.handleMessage(username, message);
        });

        this.bot.on('whisper', (username, message) => {
            this.chat.handleWhisper(username, message);
        });
    }

    async handleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger.warn('Max reconnection attempts reached. Continuing to run web server without bot connection...');
            this.resetReconnectTimer();
            return;
        }

        this.reconnectAttempts++;
        logger.info(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        // Use exponential backoff with a maximum delay
        const delay = Math.min(this.reconnectDelay * this.reconnectAttempts, 30000); // Max 30 seconds
        
        setTimeout(() => {
            this.connect().catch(err => {
                logger.error('Reconnect failed:', err.message || err);
            });
        }, delay);
    }

    resetReconnectTimer() {
        // Reset reconnect attempts after a longer delay to allow for server recovery
        setTimeout(() => {
            logger.info('Resetting reconnection attempts. Will try connecting again...');
            this.reconnectAttempts = 0;
            this.connect().catch(err => {
                logger.error('Reset reconnect failed:', err.message || err);
            });
        }, 300000); // Wait 5 minutes before trying again
    }

    changeServer(host, port, version) {
        try {
            logger.info(`Changing server to ${host}:${port}`);
            
            // Update configuration
            const config = require('./config');
            config.server.host = host;
            config.server.port = port;
            config.server.version = version || '';
            
            // Reset reconnection attempts
            this.reconnectAttempts = 0;
            
            // Disconnect current bot if connected
            if (this.bot) {
                logger.info('Disconnecting from current server...');
                this.bot.removeAllListeners();
                this.bot.quit('Switching servers');
                this.bot = null;
            }
            
            // Connect to new server after short delay
            setTimeout(() => {
                this.connect();
            }, 1000);
            
            return true;
        } catch (error) {
            logger.error('Error changing server:', error);
            return false;
        }
    }

    stop() {
        if (this.bot) {
            logger.info('Stopping bot...');
            this.bot.quit();
        }
    }
}

// Handle process termination
process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    if (global.minecraftBot) {
        global.minecraftBot.stop();
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    if (global.minecraftBot) {
        global.minecraftBot.stop();
    }
    process.exit(0);
});

// Start the bot
const bot = new MinecraftBot();
global.minecraftBot = bot;
bot.start();
