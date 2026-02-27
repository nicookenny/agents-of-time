# Raspberry Pi Deployment Guide

Deploy Agents of Life on a Raspberry Pi 4/5 (ARM64) with full functionality.

## Prerequisites

- Raspberry Pi 4 (8GB) or Pi 5 (recommended)
- Raspberry Pi OS 64-bit (Bookworm)
- 64GB+ microSD or SSD (SSD strongly recommended)
- Docker & Docker Compose installed

## Quick Start

```bash
# 1. Clone the repo
git clone <your-repo-url> agents-of-life
cd agents-of-life

# 2. Create environment file
cp .env.example .env.local
# Edit .env.local with your values (see Environment Variables below)

# 3. Start all services
docker compose -f docker-compose.raspi.yml up -d

# 4. Wait for model download (first run takes a while)
docker compose -f docker-compose.raspi.yml logs -f ollama-init

# 5. Check all services are running
docker compose -f docker-compose.raspi.yml ps
```

## Install Docker on Raspberry Pi

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Add your user to docker group
sudo usermod -aG docker $USER

# Logout and login again, then verify
docker --version
docker compose version
```

## Environment Variables

Create `.env.local` with:

```bash
# Google OAuth - Required for Gmail/Calendar integration
# Get credentials at: https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# AI Providers - At least one required
ANTHROPIC_API_KEY=your_anthropic_api_key
OPENAI_API_KEY=your_openai_api_key

# Better Auth - Required for authentication
# Generate with: openssl rand -base64 32
BETTER_AUTH_SECRET=your_random_secret_at_least_32_chars
BETTER_AUTH_URL=http://your-pi-ip:3000

# Trigger.dev secrets - Required for scheduled tasks
# Generate each with: openssl rand -hex 16
MAGIC_LINK_SECRET=your_magic_link_secret
SESSION_SECRET=your_session_secret
ENCRYPTION_KEY=your_encryption_key

# Trigger.dev URLs (replace with your Pi's IP)
TRIGGER_APP_ORIGIN=http://your-pi-ip:8030
TRIGGER_LOGIN_ORIGIN=http://your-pi-ip:8030

# Ollama model (default: llama3.2:3b)
OLLAMA_EMAIL_MODEL=llama3.2:3b
```

Generate secrets:
```bash
# Generate BETTER_AUTH_SECRET
openssl rand -base64 32

# Generate Trigger.dev secrets
openssl rand -hex 16  # MAGIC_LINK_SECRET
openssl rand -hex 16  # SESSION_SECRET
openssl rand -hex 16  # ENCRYPTION_KEY
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| App | 3000 | Main Next.js application |
| Postgres | 5432 | Main database |
| Ollama | 11434 | Local LLM for email processing |
| Trigger.dev | 8030 | Scheduled task orchestration |
| Trigger Postgres | - | Trigger.dev database |
| Trigger Redis | - | Trigger.dev queue |

## Commands

### Starting & Stopping

```bash
# Start all services
docker compose -f docker-compose.raspi.yml up -d

# Stop all services
docker compose -f docker-compose.raspi.yml down

# Restart a specific service
docker compose -f docker-compose.raspi.yml restart app

# Stop without removing containers
docker compose -f docker-compose.raspi.yml stop
```

### Logs

```bash
# All logs
docker compose -f docker-compose.raspi.yml logs -f

# Specific service logs
docker compose -f docker-compose.raspi.yml logs -f app
docker compose -f docker-compose.raspi.yml logs -f ollama
docker compose -f docker-compose.raspi.yml logs -f trigger-webapp

# Last 100 lines
docker compose -f docker-compose.raspi.yml logs --tail 100 app
```

### Building & Updating

```bash
# Rebuild app after code changes
docker compose -f docker-compose.raspi.yml build app
docker compose -f docker-compose.raspi.yml up -d app

# Pull latest images
docker compose -f docker-compose.raspi.yml pull

# Full rebuild (no cache)
docker compose -f docker-compose.raspi.yml build --no-cache app
```

### Database

```bash
# Run migrations
docker compose -f docker-compose.raspi.yml exec app npm run db:push

# Seed database
docker compose -f docker-compose.raspi.yml exec app npm run db:seed

# Access postgres CLI
docker compose -f docker-compose.raspi.yml exec postgres psql -U agents -d agents_of_life
```

### Ollama

```bash
# List installed models
docker compose -f docker-compose.raspi.yml exec ollama ollama list

# Pull a new model
docker compose -f docker-compose.raspi.yml exec ollama ollama pull llama3.2:3b

# Remove a model
docker compose -f docker-compose.raspi.yml exec ollama ollama rm model-name

# Test model
docker compose -f docker-compose.raspi.yml exec ollama ollama run llama3.2:3b "Hello!"
```

### Monitoring

```bash
# Check resource usage
docker stats

# Check service status
docker compose -f docker-compose.raspi.yml ps

# Check disk usage
docker system df
```

### Cleanup

```bash
# Remove stopped containers
docker compose -f docker-compose.raspi.yml rm

# Full cleanup (WARNING: removes all data!)
docker compose -f docker-compose.raspi.yml down -v

# Clean unused images
docker image prune -a
```

## Access Points

Once running, access at (replace `<pi-ip>` with your Pi's IP):

| Service | URL |
|---------|-----|
| Main App | `http://<pi-ip>:3000` |
| Trigger.dev Dashboard | `http://<pi-ip>:8030` |
| Ollama API | `http://<pi-ip>:11434` |

Find your Pi's IP:
```bash
hostname -I
```

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                       Raspberry Pi                              │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │    App      │    │  Postgres   │    │      Ollama         │ │
│  │   :3000     │───▶│   :5432     │    │      :11434         │ │
│  └─────────────┘    └─────────────┘    └─────────────────────┘ │
│         │                                        │              │
│         │              ┌─────────────────────────┘              │
│         │              │                                        │
│         ▼              ▼                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Trigger.dev                           │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐            │   │
│  │  │  Webapp   │  │ Postgres  │  │   Redis   │            │   │
│  │  │   :8030   │  │  (internal)│  │ (internal)│            │   │
│  │  └───────────┘  └───────────┘  └───────────┘            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

## Performance Optimization

### Use SSD Instead of SD Card
USB 3.0 SSD dramatically improves database and build performance.

```bash
# Check if booting from SSD
lsblk
```

### Increase Swap
```bash
sudo dphys-swapfile swapoff
sudo sed -i 's/CONF_SWAPSIZE=.*/CONF_SWAPSIZE=4096/' /etc/dphys-swapfile
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
free -h
```

### Overclock Pi 5 (optional)
Edit `/boot/firmware/config.txt`:
```
arm_freq=3000
gpu_freq=1000
over_voltage_delta=50000
```

## Auto-Start on Boot

Docker services with `restart: unless-stopped` auto-start when Docker starts.

```bash
# Ensure docker starts on boot
sudo systemctl enable docker

# Verify
sudo systemctl is-enabled docker
```

## Updating

```bash
cd agents-of-life

# Pull latest code
git pull

# Rebuild and restart
docker compose -f docker-compose.raspi.yml build app
docker compose -f docker-compose.raspi.yml up -d

# Run any new migrations
docker compose -f docker-compose.raspi.yml exec app npm run db:push
```

## Troubleshooting

### Service Won't Start
```bash
# Check logs
docker compose -f docker-compose.raspi.yml logs service-name

# Check if port is in use
sudo lsof -i :3000
```

### Out of Memory
```bash
# Check memory
free -h

# Check which container uses most memory
docker stats --no-stream
```

### Ollama Model Download Failed
```bash
# Retry download
docker compose -f docker-compose.raspi.yml restart ollama-init

# Or manually pull
docker compose -f docker-compose.raspi.yml exec ollama ollama pull llama3.2:3b
```

### Database Connection Issues
```bash
# Check postgres is healthy
docker compose -f docker-compose.raspi.yml ps postgres

# Check logs
docker compose -f docker-compose.raspi.yml logs postgres

# Test connection
docker compose -f docker-compose.raspi.yml exec postgres pg_isready -U agents
```

### Build Taking Too Long
Building on Pi is slow. Options:
1. Build on a faster machine and transfer the image
2. Use pre-built images from a registry
3. Be patient (first build ~15-30 minutes)

### Container Keeps Restarting
```bash
# Check exit code and logs
docker compose -f docker-compose.raspi.yml ps -a
docker compose -f docker-compose.raspi.yml logs --tail 200 app
```

## Backup & Restore

### Backup Volumes
```bash
# Stop services
docker compose -f docker-compose.raspi.yml stop

# Backup postgres data
docker run --rm -v agents-of-life_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_backup.tar.gz /data

# Backup ollama models
docker run --rm -v agents-of-life_ollama_data:/data -v $(pwd):/backup alpine tar czf /backup/ollama_backup.tar.gz /data

# Start services
docker compose -f docker-compose.raspi.yml start
```

### Restore Volumes
```bash
# Stop services
docker compose -f docker-compose.raspi.yml stop

# Restore
docker run --rm -v agents-of-life_postgres_data:/data -v $(pwd):/backup alpine sh -c "rm -rf /data/* && tar xzf /backup/postgres_backup.tar.gz -C /"

# Start services
docker compose -f docker-compose.raspi.yml start
```
