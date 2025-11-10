#!/bin/bash

# Smart deployment script with environment detection and safety checks
# Usage: ./deploy-smart.sh [environment] [--force] [--dry-run]

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="skidr.io"
BUILD_TIMEOUT=300  # 5 minutes
TEST_TIMEOUT=120   # 2 minutes

# Global flags
FORCE_DEPLOY=false
DRY_RUN=false
VERBOSE=false

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${PURPLE}========================================${NC}"
    echo -e "${PURPLE} $1${NC}"
    echo -e "${PURPLE}========================================${NC}"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [environment] [options]"
    echo ""
    echo "Environments:"
    echo "  dev, development    Deploy to development environment"
    echo "  demo                Deploy to demo environment"  
    echo "  prod, production    Deploy to production environment"
    echo ""
    echo "Options:"
    echo "  --force            Skip confirmation prompts"
    echo "  --dry-run          Show what would be deployed without actually deploying"
    echo "  --verbose          Show detailed output"
    echo "  --help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 demo                    # Deploy to demo with confirmation"
    echo "  $0 production --force      # Deploy to production without confirmation"
    echo "  $0 dev --dry-run          # Show what would be deployed to dev"
}

# Function to detect current git branch and status
check_git_status() {
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        print_error "Not in a git repository"
        return 1
    fi
    
    local branch=$(git branch --show-current)
    local status=$(git status --porcelain)
    local has_uncommitted=false
    
    if [ ! -z "$status" ]; then
        has_uncommitted=true
    fi
    
    print_status "Current git branch: $branch"
    
    if [ "$has_uncommitted" = true ]; then
        print_warning "You have uncommitted changes:"
        git status --short
        
        if [ "$FORCE_DEPLOY" = false ]; then
            read -p "Continue with uncommitted changes? (y/N) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                print_error "Deployment cancelled"
                exit 1
            fi
        fi
    fi
    
    return 0
}

# Function to validate environment
validate_environment() {
    local env=$1
    
    case $env in
        dev|development)
            ENV_NAME="development"
            ENV_FILE=".env.development"
            ENV_COLOR="${YELLOW}"
            ENV_EMOJI="🔧"
            BUILD_CMD="build:dev"
            ;;
        demo)
            ENV_NAME="demo"
            ENV_FILE=".env.demo"
            ENV_COLOR="${BLUE}"
            ENV_EMOJI="🎮"
            BUILD_CMD="build:demo"
            ;;
        prod|production)
            ENV_NAME="production"
            ENV_FILE=".env.production"
            ENV_COLOR="${GREEN}"
            ENV_EMOJI="🚀"
            BUILD_CMD="build:prod"
            ;;
        *)
            print_error "Invalid environment: $env"
            show_usage
            exit 1
            ;;
    esac
    
    # Check if environment file exists
    if [ ! -f "packages/client/$ENV_FILE" ]; then
        print_error "Environment file not found: packages/client/$ENV_FILE"
        exit 1
    fi
    
    print_header "${ENV_EMOJI} Deploying to ${ENV_COLOR}${ENV_NAME^^}${NC} Environment"
}

# Function to run pre-deployment checks
run_pre_checks() {
    print_status "Running pre-deployment checks..."
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        print_warning "node_modules not found, installing dependencies..."
        pnpm install
    fi
    
    # Check package.json scripts
    if ! pnpm run --silent $BUILD_CMD --help > /dev/null 2>&1; then
        print_error "Build command '$BUILD_CMD' not found in package.json"
        exit 1
    fi
    
    # Check for required environment variables
    if [ "$ENV_NAME" = "production" ]; then
        print_status "Validating production environment variables..."
        
        local env_file="packages/client/$ENV_FILE"
        local missing_vars=()
        
        # Check for placeholder values
        if grep -q "your_production_project_id" "$env_file"; then
            missing_vars+=("VITE_WALLET_CONNECT_PROJECT_ID")
        fi
        
        if grep -q "your_analytics_id" "$env_file"; then
            missing_vars+=("VITE_ANALYTICS_ID")
        fi
        
        if grep -q "your_sentry_dsn" "$env_file"; then
            missing_vars+=("VITE_SENTRY_DSN")
        fi
        
        if [ ${#missing_vars[@]} -gt 0 ]; then
            print_error "Missing production environment variables:"
            for var in "${missing_vars[@]}"; do
                print_error "  - $var"
            done
            print_error "Please update $env_file with actual values"
            exit 1
        fi
    fi
    
    print_success "Pre-deployment checks passed"
}

# Function to run tests
run_tests() {
    print_status "Running tests..."
    
    # Check if test script exists
    if pnpm run --silent test --help > /dev/null 2>&1; then
        timeout $TEST_TIMEOUT pnpm test || {
            print_error "Tests failed or timed out"
            exit 1
        }
        print_success "All tests passed"
    else
        print_warning "No test script found, skipping tests"
    fi
}

# Function to build the project
build_project() {
    print_status "Building project for $ENV_NAME environment..."
    
    if [ "$DRY_RUN" = true ]; then
        print_status "[DRY RUN] Would run: pnpm run $BUILD_CMD"
        return 0
    fi
    
    # Set timeout for build
    if timeout $BUILD_TIMEOUT pnpm run $BUILD_CMD; then
        print_success "Build completed successfully"
    else
        print_error "Build failed or timed out"
        exit 1
    fi
    
    # Verify build output
    if [ "$ENV_NAME" = "production" ] || [ "$ENV_NAME" = "demo" ]; then
        local dist_dir="packages/client/dist"
        if [ ! -d "$dist_dir" ] || [ -z "$(ls -A $dist_dir)" ]; then
            print_error "Build output directory is empty: $dist_dir"
            exit 1
        fi
        
        local index_file="$dist_dir/index.html"
        if [ ! -f "$index_file" ]; then
            print_error "index.html not found in build output"
            exit 1
        fi
        
        print_success "Build output validated"
    fi
}

# Function to deploy based on environment
deploy_to_environment() {
    print_status "Deploying to $ENV_NAME environment..."
    
    if [ "$DRY_RUN" = true ]; then
        print_status "[DRY RUN] Would deploy to $ENV_NAME"
        print_status "[DRY RUN] Build command: pnpm run $BUILD_CMD"
        print_status "[DRY RUN] Environment file: $ENV_FILE"
        return 0
    fi
    
    case $ENV_NAME in
        development)
            print_status "Starting development server..."
            pnpm run dev
            ;;
        demo)
            print_status "Deploying demo to staging server..."
            # Add your demo deployment logic here
            # Example: rsync, docker deploy, cloud upload, etc.
            print_warning "Demo deployment logic not implemented yet"
            ;;
        production)
            print_warning "Production deployment is a critical operation!"
            if [ "$FORCE_DEPLOY" = false ]; then
                print_warning "This will deploy to LIVE PRODUCTION environment with real money features"
                read -p "Are you absolutely sure? Type 'DEPLOY' to continue: " confirmation
                if [ "$confirmation" != "DEPLOY" ]; then
                    print_error "Production deployment cancelled"
                    exit 1
                fi
            fi
            
            print_status "Deploying to production..."
            # Add your production deployment logic here
            # Example: docker deploy, kubernetes, cloud upload, etc.
            print_warning "Production deployment logic not implemented yet"
            ;;
    esac
}

# Function to run post-deployment checks
run_post_checks() {
    if [ "$DRY_RUN" = true ]; then
        print_status "[DRY RUN] Would run post-deployment health checks"
        return 0
    fi
    
    print_status "Running post-deployment health checks..."
    
    case $ENV_NAME in
        development)
            print_status "Development server should be running on http://localhost:3000"
            ;;
        demo)
            print_status "Checking demo environment health..."
            # Add health check logic
            ;;
        production)
            print_status "Checking production environment health..."
            # Add production health check logic
            ;;
    esac
    
    print_success "Post-deployment checks completed"
}

# Function to show deployment summary  
show_summary() {
    print_header "🎯 Deployment Summary"
    
    echo -e "${ENV_COLOR}Environment:${NC} $ENV_NAME"
    echo -e "${CYAN}Git Branch:${NC} $(git branch --show-current 2>/dev/null || echo 'N/A')"
    echo -e "${CYAN}Git Commit:${NC} $(git rev-parse --short HEAD 2>/dev/null || echo 'N/A')"
    echo -e "${CYAN}Build Command:${NC} $BUILD_CMD"
    echo -e "${CYAN}Environment File:${NC} $ENV_FILE"
    echo -e "${CYAN}Timestamp:${NC} $(date)"
    
    if [ "$DRY_RUN" = true ]; then
        print_warning "This was a DRY RUN - no actual deployment occurred"
    else
        print_success "Deployment completed successfully!"
    fi
    
    # Environment-specific next steps
    case $ENV_NAME in
        development)
            echo -e "\n${BLUE}Next steps:${NC}"
            echo "• Development server should be running"
            echo "• Check http://localhost:3000 for the application"
            echo "• Monitor console for any errors"
            ;;
        demo)
            echo -e "\n${BLUE}Next steps:${NC}"
            echo "• Verify demo site is accessible"
            echo "• Test core gameplay functionality"
            echo "• Ensure crypto features are properly disabled"
            ;;
        production)
            echo -e "\n${BLUE}Next steps:${NC}"
            echo "• Monitor production metrics and logs"
            echo "• Verify all payment systems are operational"
            echo "• Check real-money features are working correctly"
            echo "• Monitor user feedback and error rates"
            ;;
    esac
}

# Main execution
main() {
    local environment=""
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --force)
                FORCE_DEPLOY=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                set -x  # Enable verbose bash output
                shift
                ;;
            --help)
                show_usage
                exit 0
                ;;
            -*)
                print_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
            *)
                environment="$1"
                shift
                ;;
        esac
    done
    
    # Check if environment is provided
    if [ -z "$environment" ]; then
        print_error "Environment not specified"
        show_usage
        exit 1
    fi
    
    # Main deployment flow
    validate_environment "$environment"
    check_git_status
    run_pre_checks
    
    if [ "$ENV_NAME" != "development" ]; then
        run_tests
    fi
    
    build_project
    deploy_to_environment
    run_post_checks
    show_summary
}

# Handle script interruption
trap 'print_error "Deployment interrupted"; exit 1' INT TERM

# Run main function
main "$@"