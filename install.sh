#!/bin/bash

# ============================================================================
# Bin Locations Management System - Ubuntu 24 Installer
# ============================================================================
# Purpose: Production deployment on port 80 with NGINX reverse proxy
# Author: Generated for Bin Locations project
# GitHub: https://github.com/ruolez/bin-locations.git
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
GITHUB_REPO="https://github.com/ruolez/bin-locations.git"
INSTALL_DIR="/opt/bin-locations"
DATA_DIR="$INSTALL_DIR/data"
NGINX_CONF="/etc/nginx/sites-available/bin-locations"
NGINX_ENABLED="/etc/nginx/sites-enabled/bin-locations"
SERVICE_NAME="bin-locations"

# ============================================================================
# Helper Functions
# ============================================================================

print_header() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}  Bin Locations Management System - Installer          ${BLUE}║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Detect server IP address
detect_server_ip() {
    local ip=""

    # Try to get primary external IP
    ip=$(ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \K\S+')

    # Fallback to first non-loopback IP
    if [ -z "$ip" ]; then
        ip=$(hostname -I 2>/dev/null | awk '{print $1}')
    fi

    # Final fallback to localhost
    if [ -z "$ip" ]; then
        ip="127.0.0.1"
    fi

    echo "$ip"
}

# Check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

# Check Ubuntu version
check_ubuntu_version() {
    if [ ! -f /etc/os-release ]; then
        print_error "Cannot detect OS version"
        exit 1
    fi

    source /etc/os-release

    if [[ "$ID" != "ubuntu" ]]; then
        print_error "This script is designed for Ubuntu only"
        exit 1
    fi

    if [[ ! "$VERSION_ID" =~ ^24\. ]]; then
        print_warning "This script is designed for Ubuntu 24. You are running $VERSION_ID"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Install Docker
install_docker() {
    if command -v docker &> /dev/null; then
        print_info "Docker already installed: $(docker --version)"
        return 0
    fi

    print_info "Installing Docker..."

    # Update package index
    apt-get update -qq

    # Install prerequisites
    apt-get install -y -qq \
        ca-certificates \
        curl \
        gnupg \
        lsb-release

    # Add Docker's official GPG key
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    # Set up Docker repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Install Docker Engine
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Start and enable Docker
    systemctl enable docker
    systemctl start docker

    print_success "Docker installed successfully"
}

# Install NGINX
install_nginx() {
    if command -v nginx &> /dev/null; then
        print_info "NGINX already installed: $(nginx -v 2>&1)"
        return 0
    fi

    print_info "Installing NGINX..."
    apt-get install -y -qq nginx
    systemctl enable nginx
    print_success "NGINX installed successfully"
}

# Install Git
install_git() {
    if command -v git &> /dev/null; then
        return 0
    fi

    print_info "Installing Git..."
    apt-get install -y -qq git
    print_success "Git installed successfully"
}

# Configure NGINX reverse proxy
configure_nginx() {
    local server_ip=$1
    local iframe_ip=$2  # Optional - if provided, enable iframe embedding from this IP

    print_info "Configuring NGINX reverse proxy..."

    # Start building the config file
    cat > "$NGINX_CONF" <<EOF
# Bin Locations Management System - NGINX Configuration
# Auto-generated on $(date)
# Iframe embedding: ${iframe_ip:-disabled}

upstream bin_locations_backend {
    server 127.0.0.1:5556;
    keepalive 32;
}

server {
    listen 80;
    listen [::]:80;
    server_name $server_ip localhost _;

EOF

    # Add security headers - conditional based on iframe embedding
    if [ -n "$iframe_ip" ]; then
        cat >> "$NGINX_CONF" <<EOF
    # Security headers (iframe embedding enabled for: $iframe_ip)
    add_header Content-Security-Policy "frame-ancestors 'self' http://$iframe_ip https://$iframe_ip" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
EOF
    else
        cat >> "$NGINX_CONF" <<EOF
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
EOF
    fi

    # Continue with rest of config
    cat >> "$NGINX_CONF" <<EOF

    # Client body size limit (for file uploads)
    client_max_body_size 10M;

    # Logging
    access_log /var/log/nginx/bin-locations-access.log;
    error_log /var/log/nginx/bin-locations-error.log;

    # Root location
    location / {
        proxy_pass http://bin_locations_backend;
        proxy_http_version 1.1;

        # Headers
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # No caching for dynamic content
        proxy_no_cache 1;
        proxy_cache_bypass 1;
        add_header Cache-Control "no-store, no-cache, must-revalidate, max-age=0" always;
    }

    # Static files (if served directly)
    location /static/ {
        proxy_pass http://bin_locations_backend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;

        # Cache static files for 1 hour
        expires 1h;
        add_header Cache-Control "public, immutable";
    }

    # Health check endpoint
    location /health {
        proxy_pass http://bin_locations_backend;
        access_log off;
    }
}
EOF

    # Enable site
    ln -sf "$NGINX_CONF" "$NGINX_ENABLED"

    # Test NGINX configuration
    if nginx -t > /dev/null 2>&1; then
        systemctl reload nginx
        print_success "NGINX configured successfully"
    else
        print_error "NGINX configuration test failed"
        nginx -t
        exit 1
    fi
}

# Clone or update repository
setup_repository() {
    local is_update=$1

    if [ "$is_update" = true ]; then
        print_info "Updating from GitHub..."
        cd "$INSTALL_DIR"

        # Stash any local changes
        git stash > /dev/null 2>&1 || true

        # Pull latest changes
        git pull origin main

        print_success "Repository updated"
    else
        print_info "Cloning repository from GitHub..."

        # Remove directory if it exists
        if [ -d "$INSTALL_DIR" ]; then
            rm -rf "$INSTALL_DIR"
        fi

        # Clone repository
        git clone "$GITHUB_REPO" "$INSTALL_DIR"

        print_success "Repository cloned"
    fi
}

# Backup data directory
backup_data() {
    if [ ! -d "$DATA_DIR" ]; then
        return 0
    fi

    local backup_dir="/tmp/bin-locations-backup-$(date +%Y%m%d-%H%M%S)"

    print_info "Backing up data directory..."
    cp -r "$DATA_DIR" "$backup_dir"
    print_success "Data backed up to: $backup_dir"

    echo "$backup_dir"
}

# Restore data directory
restore_data() {
    local backup_dir=$1

    if [ -z "$backup_dir" ] || [ ! -d "$backup_dir" ]; then
        return 0
    fi

    print_info "Restoring data directory..."

    # Ensure data directory exists
    mkdir -p "$DATA_DIR"

    # Copy files back
    cp -r "$backup_dir"/* "$DATA_DIR/"

    # Set permissions
    chown -R root:root "$DATA_DIR"
    chmod -R 755 "$DATA_DIR"

    print_success "Data restored"
}

# Build and start Docker containers
start_application() {
    print_info "Building Docker containers..."
    cd "$INSTALL_DIR"

    # Stop existing containers
    docker compose down > /dev/null 2>&1 || true

    # Build and start
    docker compose up -d --build

    # Wait for application to be ready
    print_info "Waiting for application to start..."
    local max_attempts=30
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if curl -s http://localhost:5556/health > /dev/null 2>&1; then
            print_success "Application started successfully"
            return 0
        fi
        sleep 2
        attempt=$((attempt + 1))
    done

    print_error "Application failed to start within 60 seconds"
    docker compose logs --tail=50
    exit 1
}

# Stop application
stop_application() {
    print_info "Stopping application..."
    cd "$INSTALL_DIR" 2>/dev/null || return 0
    docker compose down > /dev/null 2>&1 || true
    print_success "Application stopped"
}

# Remove installation
remove_installation() {
    print_warning "This will remove the application but preserve the data directory"
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Removal cancelled"
        exit 0
    fi

    # Stop application
    stop_application

    # Remove NGINX configuration
    if [ -f "$NGINX_ENABLED" ]; then
        rm -f "$NGINX_ENABLED"
        print_success "NGINX configuration removed"
    fi

    if [ -f "$NGINX_CONF" ]; then
        rm -f "$NGINX_CONF"
    fi

    # Reload NGINX
    if systemctl is-active --quiet nginx; then
        systemctl reload nginx
    fi

    # Ask about data directory
    echo ""
    print_warning "Data directory location: $DATA_DIR"
    read -p "Do you want to remove the data directory? (y/N): " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [ -d "$DATA_DIR" ]; then
            # Create backup first
            local backup_dir=$(backup_data)
            print_info "Backup created at: $backup_dir"
        fi
    fi

    # Remove installation directory
    if [ -d "$INSTALL_DIR" ]; then
        rm -rf "$INSTALL_DIR"
        print_success "Installation directory removed"
    fi

    print_success "Application removed successfully"

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Data directory preserved at: $DATA_DIR"
    fi
}

# Configure iframe embedding for external dashboard
do_configure_iframe() {
    print_header
    echo -e "${BLUE}Configure Iframe Embedding${NC}"
    echo ""

    # Check if installation exists
    if [ ! -f "$NGINX_CONF" ]; then
        print_error "NGINX configuration not found. Please run install first."
        echo ""
        read -p "Press Enter to continue..."
        show_menu
        return
    fi

    print_info "This allows another dashboard system to embed this application in an iframe."
    print_info "Running this again will replace the previously configured IP."
    echo ""

    # Prompt for dashboard IP
    read -p "Enter dashboard IP address that will embed this application: " dashboard_ip

    # Validate IP format (basic validation)
    if ! [[ $dashboard_ip =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        print_error "Invalid IP address format. Please use format: xxx.xxx.xxx.xxx"
        echo ""
        read -p "Press Enter to continue..."
        show_menu
        return
    fi

    print_info "Updating NGINX configuration for iframe embedding from $dashboard_ip..."

    # Extract current server_name from existing config
    local server_ip
    server_ip=$(grep -oP 'server_name \K[^ ;]+' "$NGINX_CONF" 2>/dev/null | head -1)

    if [ -z "$server_ip" ]; then
        server_ip=$(detect_server_ip)
    fi

    # Regenerate NGINX config with iframe embedding
    configure_nginx "$server_ip" "$dashboard_ip"

    # Print success message
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}  Iframe embedding configured successfully!            ${GREEN}║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    print_info "Dashboard at $dashboard_ip can now embed this application"
    print_info "NGINX config updated: $NGINX_CONF"
    echo ""
    read -p "Press Enter to continue..."
    show_menu
}

# ============================================================================
# Installation Functions
# ============================================================================

do_clean_install() {
    print_header
    echo -e "${GREEN}Clean Installation${NC}"
    echo ""

    # Detect server IP
    local server_ip=$(detect_server_ip)
    print_info "Detected server IP: $server_ip"

    read -p "Is this correct? (Y/n): " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Nn]$ ]]; then
        read -p "Enter server IP address: " server_ip
    fi

    echo ""
    print_info "Starting clean installation..."
    echo ""

    # Install dependencies
    check_ubuntu_version
    install_docker
    install_nginx
    install_git

    # Setup application
    setup_repository false

    # Create data directory
    mkdir -p "$DATA_DIR"
    chmod 755 "$DATA_DIR"

    # Configure NGINX
    configure_nginx "$server_ip"

    # Start application
    start_application

    # Print success message
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}  Installation completed successfully!                  ${GREEN}║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    print_info "Application is running on:"
    echo -e "  ${BLUE}→${NC} http://$server_ip"
    echo -e "  ${BLUE}→${NC} http://localhost"
    echo ""
    print_info "Configuration:"
    echo -e "  ${BLUE}→${NC} Installation directory: $INSTALL_DIR"
    echo -e "  ${BLUE}→${NC} Data directory: $DATA_DIR"
    echo -e "  ${BLUE}→${NC} NGINX config: $NGINX_CONF"
    echo ""
    print_info "Management commands:"
    echo -e "  ${BLUE}→${NC} View logs: cd $INSTALL_DIR && docker compose logs -f"
    echo -e "  ${BLUE}→${NC} Restart: cd $INSTALL_DIR && docker compose restart"
    echo -e "  ${BLUE}→${NC} Stop: cd $INSTALL_DIR && docker compose down"
    echo ""
}

do_update() {
    print_header
    echo -e "${YELLOW}Update from GitHub${NC}"
    echo ""

    if [ ! -d "$INSTALL_DIR" ]; then
        print_error "Installation not found. Please run clean install first."
        exit 1
    fi

    # Detect server IP
    local server_ip=$(detect_server_ip)

    print_info "Starting update process..."
    echo ""

    # Backup data
    local backup_dir=$(backup_data)

    # Stop application
    stop_application

    # Update repository
    setup_repository true

    # Restore data
    restore_data "$backup_dir"

    # Reconfigure NGINX (in case config changed)
    configure_nginx "$server_ip"

    # Start application
    start_application

    # Print success message
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}  Update completed successfully!                        ${GREEN}║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    print_info "Application is running on:"
    echo -e "  ${BLUE}→${NC} http://$server_ip"
    echo ""
    print_info "Data preserved from: $backup_dir"
    echo ""
}

do_remove() {
    print_header
    echo -e "${RED}Remove Installation${NC}"
    echo ""

    remove_installation
}

# ============================================================================
# Main Menu
# ============================================================================

show_menu() {
    clear
    print_header

    echo "Please select an option:"
    echo ""
    echo -e "  ${GREEN}1)${NC} Clean Install"
    echo -e "  ${YELLOW}2)${NC} Update from GitHub"
    echo -e "  ${BLUE}3)${NC} Configure Iframe Embedding"
    echo -e "  ${RED}4)${NC} Remove Installation"
    echo -e "  ${BLUE}5)${NC} Exit"
    echo ""
    read -p "Enter choice [1-5]: " choice

    case $choice in
        1)
            do_clean_install
            ;;
        2)
            do_update
            ;;
        3)
            do_configure_iframe
            ;;
        4)
            do_remove
            ;;
        5)
            print_info "Exiting..."
            exit 0
            ;;
        *)
            print_error "Invalid option. Please try again."
            sleep 2
            show_menu
            ;;
    esac
}

# ============================================================================
# Entry Point
# ============================================================================

main() {
    check_root
    show_menu
}

main "$@"
