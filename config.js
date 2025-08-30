const config = {
    server: {
        host: process.env.MC_SERVER_HOST || 's123-6Cmu.aternos.me',
        port: parseInt(process.env.MC_SERVER_PORT) || 37886,
        version: process.env.MC_VERSION || '1.21.4'
    },
    
    bot: {
        username: process.env.MC_USERNAME || 'Keer_Son',
        password: process.env.MC_PASSWORD || '',
        auth: process.env.MC_AUTH || 'offline' // 'mojang', 'microsoft', or 'offline'
    },

    behavior: {
        autoRespawn: true,
        followDistance: 3,
        maxFollowDistance: 20,
        chatResponseDelay: 1000,
        taskTimeout: 300000, // 5 minutes
        idleTimeout: 600000 // 10 minutes
    },

    commands: {
        prefix: process.env.COMMAND_PREFIX || '.',
        allowedUsers: process.env.ALLOWED_USERS ? process.env.ALLOWED_USERS.split(',') : ['ItsKeer'],
        adminUsers: process.env.ADMIN_USERS ? process.env.ADMIN_USERS.split(',') : ['ItsKeer', 'Admin']
    },

    reconnection: {
        maxReconnectAttempts: parseInt(process.env.MAX_RECONNECT_ATTEMPTS) || 5,
        reconnectDelay: parseInt(process.env.RECONNECT_DELAY) || 5000
    },

    logging: {
        level: process.env.LOG_LEVEL || 'info',
        logToFile: process.env.LOG_TO_FILE === 'true',
        logFile: process.env.LOG_FILE || 'bot.log'
    }
};

// Export individual properties for easier access
module.exports = {
    ...config,
    maxReconnectAttempts: config.reconnection.maxReconnectAttempts,
    reconnectDelay: config.reconnection.reconnectDelay
};
