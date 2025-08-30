const express = require('express');
const session = require('express-session');
const path = require('path');
const logger = require('./utils/logger');
const userManager = require('./utils/userManager');

class WebServer {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 5000;
        this.minecraftBot = null;
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        // Parse JSON bodies
        this.app.use(express.json());
        
        // Session configuration
        this.app.use(session({
            secret: 'keer_son_bot_secret_key_2025',
            resave: false,
            saveUninitialized: false,
            cookie: { 
                secure: false, // Set to true if using HTTPS
                maxAge: 24 * 60 * 60 * 1000 // 24 hours
            }
        }));
        
        // Serve static files from public directory
        this.app.use(express.static(path.join(__dirname, 'public')));
        
        // Enable CORS
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Content-Type');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
            next();
        });
    }

    // Authentication middleware
    requireAuth(req, res, next) {
        if (req.session && req.session.authenticated) {
            return next();
        } else {
            // Check if this is an API request
            if (req.path.startsWith('/api/')) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required',
                    redirect: '/login'
                });
            } else {
                return res.redirect('/login');
            }
        }
    }

    setupRoutes() {
        // Login page route
        this.app.get('/login', (req, res) => {
            if (req.session && req.session.authenticated) {
                return res.redirect('/');
            }
            res.sendFile(path.join(__dirname, 'public', 'login.html'));
        });

        // Registration page route
        this.app.get('/register', (req, res) => {
            if (req.session && req.session.authenticated) {
                return res.redirect('/');
            }
            res.sendFile(path.join(__dirname, 'public', 'register.html'));
        });

        // Registration API route
        this.app.post('/api/register', async (req, res) => {
            const { username, password, confirmPassword } = req.body;
            
            try {
                // Validate passwords match
                if (password !== confirmPassword) {
                    return res.json({
                        success: false,
                        message: 'Passwords do not match'
                    });
                }
                
                // Create user
                const result = await userManager.createUser(username, password);
                
                if (result.success) {
                    logger.info(`New user registered: ${username}`);
                    res.json({
                        success: true,
                        message: 'Account created successfully! You can now login.'
                    });
                } else {
                    res.json(result);
                }
                
            } catch (error) {
                logger.error('Registration error:', error);
                res.json({
                    success: false,
                    message: 'Registration failed due to server error'
                });
            }
        });

        // Login API route
        this.app.post('/api/login', async (req, res) => {
            const { username, password } = req.body;
            
            try {
                // First check legacy hardcoded users for backward compatibility
                if ((username === 'Itskeer' && password === '555ahmed') || 
                    (username === 'Admin' && password === '555ahmed')) {
                    
                    req.session.authenticated = true;
                    req.session.username = username;
                    req.session.role = username === 'Admin' ? 'admin' : 'user';
                    
                    logger.info(`Legacy user ${username} logged in successfully with role: ${req.session.role}`);
                    
                    res.json({ 
                        success: true, 
                        message: 'Login successful',
                        role: req.session.role 
                    });
                    return;
                }
                
                // Check registered users
                const authResult = await userManager.authenticateUser(username, password);
                
                if (authResult.success) {
                    req.session.authenticated = true;
                    req.session.username = authResult.user.username;
                    req.session.role = authResult.user.role;
                    req.session.userId = authResult.user.id;
                    
                    logger.info(`User ${username} logged in successfully with role: ${req.session.role}`);
                    
                    res.json({ 
                        success: true, 
                        message: 'Login successful',
                        role: req.session.role 
                    });
                } else {
                    logger.warn(`Failed login attempt for username: ${username}`);
                    res.json({ 
                        success: false, 
                        message: authResult.message || 'Invalid username or password' 
                    });
                }
                
            } catch (error) {
                logger.error('Login error:', error);
                res.json({ 
                    success: false, 
                    message: 'Login failed due to server error' 
                });
            }
        });

        // Logout route
        this.app.post('/api/logout', (req, res) => {
            const username = req.session.username;
            req.session.destroy((err) => {
                if (err) {
                    logger.error('Session destroy error:', err);
                    return res.json({ success: false, message: 'Logout failed' });
                }
                logger.info(`User ${username} logged out`);
                res.json({ success: true, message: 'Logged out successfully' });
            });
        });

        // Main dashboard route (protected)
        this.app.get('/', this.requireAuth.bind(this), (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });

        // API route to get current user info
        this.app.get('/api/user', this.requireAuth.bind(this), (req, res) => {
            res.json({
                username: req.session.username,
                role: req.session.role,
                adminAccess: req.session.adminAccess || false
            });
        });

        // API Routes (protected)
        this.app.get('/api/status', this.requireAuth.bind(this), (req, res) => {
            if (!this.minecraftBot || !this.minecraftBot.bot) {
                return res.json({
                    status: 'offline',
                    message: 'Bot is not connected'
                });
            }

            const bot = this.minecraftBot.bot;
            const core = this.minecraftBot.core;
            
            res.json({
                status: 'online',
                username: bot.username,
                health: bot.health || 0,
                food: bot.food || 0,
                position: bot.entity ? {
                    x: Math.round(bot.entity.position.x * 100) / 100,
                    y: Math.round(bot.entity.position.y * 100) / 100,
                    z: Math.round(bot.entity.position.z * 100) / 100
                } : null,
                currentTask: core ? core.currentTask : null,
                autonomousMode: core ? core.autonomousMode : false,
                afkMode: core ? core.afkMode : false,
                inventoryCount: bot.inventory ? bot.inventory.items().length : 0
            });
        });

        this.app.get('/api/inventory', this.requireAuth.bind(this), (req, res) => {
            if (!this.minecraftBot || !this.minecraftBot.bot || !this.minecraftBot.bot.inventory) {
                return res.json({ error: 'Bot not connected', items: [] });
            }

            try {
                const items = this.minecraftBot.bot.inventory.items().map(item => ({
                    name: item.name,
                    count: item.count,
                    slot: item.slot
                }));

                res.json({ items });
            } catch (error) {
                res.json({ error: 'Inventory not available', items: [] });
            }
        });

        this.app.post('/api/command', this.requireAuth.bind(this), (req, res) => {
            const { command } = req.body;
            
            if (!this.minecraftBot || !this.minecraftBot.bot) {
                return res.json({ 
                    success: false, 
                    message: 'Bot not connected' 
                });
            }

            try {
                // Send command to bot (simulate user command)
                if (this.minecraftBot.commands) {
                    // Remove dot prefix if present
                    const cleanCommand = command.startsWith('.') ? command : '.' + command;
                    this.minecraftBot.commands.handleCommand('WebInterface', cleanCommand);
                    res.json({ 
                        success: true, 
                        message: `Command "${command}" sent successfully` 
                    });
                } else {
                    res.json({ 
                        success: false, 
                        message: 'Command handler not available' 
                    });
                }
            } catch (error) {
                logger.error('Web command error:', error);
                res.json({ 
                    success: false, 
                    message: 'Failed to execute command' 
                });
            }
        });

        this.app.post('/api/chat', this.requireAuth.bind(this), (req, res) => {
            const { message } = req.body;
            
            if (!this.minecraftBot || !this.minecraftBot.bot) {
                return res.json({ 
                    success: false, 
                    message: 'Bot not connected' 
                });
            }

            try {
                this.minecraftBot.bot.chat(message);
                res.json({ 
                    success: true, 
                    message: 'Message sent successfully' 
                });
            } catch (error) {
                logger.error('Web chat error:', error);
                res.json({ 
                    success: false, 
                    message: 'Failed to send message' 
                });
            }
        });

        // Get current server configuration
        this.app.get('/api/server', this.requireAuth.bind(this), (req, res) => {
            try {
                const config = require('./config');
                res.json({
                    success: true,
                    host: config.server.host,
                    port: config.server.port,
                    version: config.server.version
                });
            } catch (error) {
                logger.error('Get server config error:', error);
                res.json({
                    success: false,
                    message: 'Failed to get server configuration'
                });
            }
        });

        // Change server configuration and reconnect
        this.app.post('/api/server', this.requireAuth.bind(this), (req, res) => {
            const { host, port, version } = req.body;
            
            if (!host) {
                return res.json({
                    success: false,
                    message: 'Server host is required'
                });
            }

            const serverPort = parseInt(port) || 25565;
            
            if (serverPort < 1 || serverPort > 65535) {
                return res.json({
                    success: false,
                    message: 'Invalid port number (1-65535)'
                });
            }

            try {
                if (!this.minecraftBot) {
                    return res.json({
                        success: false,
                        message: 'Bot instance not available'
                    });
                }

                logger.info(`Changing server from web interface: ${host}:${serverPort}`);
                
                // Update bot's server configuration
                this.minecraftBot.changeServer(host, serverPort, version || '');
                
                res.json({
                    success: true,
                    message: `Server changed to ${host}:${serverPort}`,
                    host: host,
                    port: serverPort,
                    version: version || ''
                });
                
            } catch (error) {
                logger.error('Change server error:', error);
                res.json({
                    success: false,
                    message: 'Failed to change server configuration'
                });
            }
        });

        // Admin key redemption endpoint
        this.app.post('/api/admin/redeem', this.requireAuth.bind(this), (req, res) => {
            const { key } = req.body;
            
            // Admin redemption key (you can change this)
            const ADMIN_KEY = 'KEER_FULL_CONTROL_2025';
            
            if (!key) {
                return res.json({
                    success: false,
                    message: 'Admin key is required'
                });
            }

            try {
                if (key === ADMIN_KEY) {
                    req.session.adminAccess = true;
                    logger.info(`User ${req.session.username} gained full admin access`);
                    
                    res.json({
                        success: true,
                        message: 'Admin access granted successfully',
                        adminAccess: true
                    });
                } else {
                    logger.warn(`Invalid admin key attempt by ${req.session.username}: ${key}`);
                    res.json({
                        success: false,
                        message: 'Invalid admin key'
                    });
                }
            } catch (error) {
                logger.error('Admin key redemption error:', error);
                res.json({
                    success: false,
                    message: 'Admin key redemption failed'
                });
            }
        });

        // API Key Management Endpoints
        
        // Get user's API keys
        this.app.get('/api/keys', this.requireAuth.bind(this), async (req, res) => {
            try {
                const result = await userManager.getUserApiKeys(req.session.username);
                res.json(result);
            } catch (error) {
                logger.error('Get API keys error:', error);
                res.json({
                    success: false,
                    message: 'Failed to retrieve API keys'
                });
            }
        });

        // Generate new API key
        this.app.post('/api/keys', this.requireAuth.bind(this), async (req, res) => {
            const { name, permissions } = req.body;
            
            if (!name) {
                return res.json({
                    success: false,
                    message: 'Key name is required'
                });
            }
            
            try {
                const validPermissions = permissions || ['read'];
                const result = await userManager.generateApiKey(req.session.username, name, validPermissions);
                res.json(result);
            } catch (error) {
                logger.error('Generate API key error:', error);
                res.json({
                    success: false,
                    message: 'Failed to generate API key'
                });
            }
        });

        // Revoke API key
        this.app.delete('/api/keys/:keyId', this.requireAuth.bind(this), async (req, res) => {
            const { keyId } = req.params;
            
            try {
                const result = await userManager.revokeApiKey(req.session.username, keyId);
                res.json(result);
            } catch (error) {
                logger.error('Revoke API key error:', error);
                res.json({
                    success: false,
                    message: 'Failed to revoke API key'
                });
            }
        });

        // API Authentication middleware for API key-based access
        this.apiKeyAuth = async (req, res, next) => {
            const apiKey = req.headers['x-api-key'] || req.query.apikey;
            
            if (!apiKey) {
                return res.status(401).json({
                    success: false,
                    message: 'API key required'
                });
            }
            
            try {
                const result = await userManager.validateApiKey(apiKey);
                if (result.success) {
                    req.apiUser = result.key;
                    next();
                } else {
                    return res.status(401).json({
                        success: false,
                        message: 'Invalid API key'
                    });
                }
            } catch (error) {
                logger.error('API key validation error:', error);
                return res.status(500).json({
                    success: false,
                    message: 'API key validation failed'
                });
            }
        };

        // API-only endpoints using API key authentication
        this.app.get('/api/v1/status', this.apiKeyAuth.bind(this), (req, res) => {
            if (!this.minecraftBot || !this.minecraftBot.bot) {
                return res.json({
                    status: 'offline',
                    message: 'Bot is not connected'
                });
            }

            const bot = this.minecraftBot.bot;
            const core = this.minecraftBot.core;
            
            res.json({
                status: 'online',
                username: bot.username,
                health: bot.health || 0,
                food: bot.food || 0,
                position: bot.entity ? {
                    x: Math.round(bot.entity.position.x * 100) / 100,
                    y: Math.round(bot.entity.position.y * 100) / 100,
                    z: Math.round(bot.entity.position.z * 100) / 100
                } : null,
                currentTask: core ? core.currentTask : null,
                autonomousMode: core ? core.autonomousMode : false,
                afkMode: core ? core.afkMode : false,
                inventoryCount: bot.inventory ? bot.inventory.items().length : 0,
                apiUser: req.apiUser.username
            });
        });

        this.app.post('/api/v1/command', this.apiKeyAuth.bind(this), (req, res) => {
            const { command } = req.body;
            
            // Check permissions
            if (!req.apiUser.permissions.includes('write') && !req.apiUser.permissions.includes('admin')) {
                return res.json({
                    success: false,
                    message: 'Insufficient permissions. Write or admin access required.'
                });
            }
            
            if (!this.minecraftBot || !this.minecraftBot.bot) {
                return res.json({ 
                    success: false, 
                    message: 'Bot not connected' 
                });
            }

            try {
                if (this.minecraftBot.commands) {
                    const cleanCommand = command.startsWith('.') ? command : '.' + command;
                    this.minecraftBot.commands.handleCommand(`API:${req.apiUser.username}`, cleanCommand);
                    res.json({ 
                        success: true, 
                        message: `Command "${command}" sent successfully via API`,
                        apiUser: req.apiUser.username
                    });
                } else {
                    res.json({ 
                        success: false, 
                        message: 'Command handler not available' 
                    });
                }
            } catch (error) {
                logger.error('API command error:', error);
                res.json({ 
                    success: false, 
                    message: 'Failed to execute command' 
                });
            }
        });

        // Admin command execution endpoint
        this.app.post('/api/admin/command', this.requireAuth.bind(this), (req, res) => {
            const { command } = req.body;
            
            // Check admin access
            if (!req.session.adminAccess) {
                return res.json({
                    success: false,
                    message: 'Admin access required'
                });
            }

            if (!command) {
                return res.json({
                    success: false,
                    message: 'Command is required'
                });
            }

            try {
                logger.info(`Admin command executed by ${req.session.username}: ${command}`);
                
                if (!this.minecraftBot) {
                    return res.json({
                        success: false,
                        message: 'Bot instance not available'
                    });
                }

                // Handle special admin commands
                switch (command) {
                    case 'shutdown':
                        if (this.minecraftBot.bot) {
                            this.minecraftBot.bot.quit('Admin shutdown');
                        }
                        res.json({
                            success: true,
                            message: 'Bot shutdown initiated'
                        });
                        break;

                    case 'restart':
                        if (this.minecraftBot.bot) {
                            this.minecraftBot.bot.quit('Admin restart');
                            setTimeout(() => {
                                this.minecraftBot.connect();
                            }, 2000);
                        }
                        res.json({
                            success: true,
                            message: 'Bot restart initiated'
                        });
                        break;

                    case 'cleardata':
                        if (this.minecraftBot.core) {
                            this.minecraftBot.core.currentTask = null;
                            this.minecraftBot.core.autonomousMode = false;
                            this.minecraftBot.core.afkMode = false;
                        }
                        res.json({
                            success: true,
                            message: 'Bot data cleared'
                        });
                        break;

                    default:
                        // Execute as bot command
                        if (this.minecraftBot.bot && this.minecraftBot.commands) {
                            const adminCommand = command.startsWith('.') ? command : '.' + command;
                            this.minecraftBot.commands.handleCommand('AdminWebInterface', adminCommand);
                            res.json({
                                success: true,
                                message: `Admin command executed: ${command}`
                            });
                        } else {
                            res.json({
                                success: false,
                                message: 'Bot not connected'
                            });
                        }
                        break;
                }
                
            } catch (error) {
                logger.error('Admin command execution error:', error);
                res.json({
                    success: false,
                    message: 'Failed to execute admin command'
                });
            }
        });

        // Global error handler for API routes
        this.app.use((err, req, res, next) => {
            logger.error('Express error:', err);
            
            // If it's an API request, return JSON error
            if (req.path.startsWith('/api/')) {
                return res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    error: process.env.NODE_ENV === 'development' ? err.message : 'Server error'
                });
            }
            
            // For non-API requests, continue with default error handling
            next(err);
        });

    }

    setMinecraftBot(botInstance) {
        this.minecraftBot = botInstance;
        logger.info('Minecraft bot connected to web server');
    }

    start() {
        this.app.listen(this.port, '0.0.0.0', () => {
            logger.info(`Web server running on http://0.0.0.0:${this.port}`);
        });
    }
}

module.exports = WebServer;