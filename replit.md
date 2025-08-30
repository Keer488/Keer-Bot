# Minecraft Bot

## Overview

This is an autonomous Minecraft bot built with Node.js and the Mineflayer library. The bot can connect to Minecraft servers and perform various automated tasks including mining, navigation, inventory management, and responding to player commands. It features a modular architecture with separate handlers for different bot capabilities, comprehensive logging, and configurable behavior settings.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Core Architecture
The application follows a modular, event-driven architecture with a main `MinecraftBot` class that orchestrates various specialized handlers. Each handler encapsulates specific bot functionality, promoting separation of concerns and maintainability.

**Main Components:**
- **MinecraftBot Class**: Central coordinator that manages bot lifecycle, connection, and handler initialization
- **Handler System**: Modular handlers for chat, navigation, inventory, tasks, and commands
- **Configuration Management**: Environment-based configuration with sensible defaults
- **Logging System**: Winston-based logging with multiple transports and log levels

### Bot Handlers

**BotCore**: Manages fundamental bot operations including health monitoring, food management, death handling, and auto-respawn functionality. Runs continuous health checks via physics tick events.

**ChatHandler**: Processes incoming chat messages, maintains message history, handles mentions and greetings, and manages chat response timing to avoid spam.

**NavigationHandler**: Implements pathfinding using mineflayer-pathfinder plugin. Provides movement capabilities, goal-based navigation, and following mechanics with configurable movement constraints.

**InventoryHandler**: Manages bot inventory operations including item searching, counting, equipment management, and window interactions. Provides utilities for item manipulation and inventory queries.

**TaskHandler**: Executes complex bot tasks like mining operations using mineflayer-collectblock plugin. Manages task queues and provides automated resource collection capabilities.

**CommandHandler**: Processes chat commands with prefix-based parsing, user permission validation, and comprehensive command set for bot control. Supports both regular users and admin-level commands.

### Configuration System
Environment variable-based configuration covering server connection, bot authentication, behavioral parameters, command settings, reconnection logic, and logging preferences. The system provides fallback defaults for all settings.

### Event-Driven Communication
All handlers communicate through Mineflayer's event system, ensuring loose coupling and reactive behavior. The bot responds to game events, player interactions, and internal state changes through event listeners.

### Error Handling and Resilience
Comprehensive error handling with automatic reconnection logic, task timeouts, navigation fallbacks, and graceful degradation. The bot maintains operation continuity through connection issues and game events.

## External Dependencies

**Core Libraries:**
- **mineflayer**: Primary Minecraft bot framework providing protocol implementation and game interaction APIs
- **winston**: Logging framework with file rotation, multiple transports, and configurable log levels

**Mineflayer Plugins:**
- **mineflayer-pathfinder**: Advanced pathfinding and navigation capabilities with obstacle avoidance
- **mineflayer-collectblock**: Automated block collection and mining operations

**Authentication Services:**
- Support for Mojang, Microsoft, and offline authentication modes
- Azure MSAL integration for Microsoft account authentication

**Runtime Environment:**
- Node.js runtime with ES6+ module support
- Environment variable configuration for deployment flexibility
- File-based logging with rotation and size management