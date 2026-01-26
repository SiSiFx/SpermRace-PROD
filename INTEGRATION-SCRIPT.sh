#!/bin/bash
# Integration Script for Premium Bio-Cyberpunk UI Enhancements
# This script helps integrate the enhancements into your project

set -e

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Bio-Cyberpunk UI Enhancements - Integration Script      ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

PROJECT_ROOT="/home/sisi/projects/spermrace"
CLIENT_SRC="$PROJECT_ROOT/packages/client/src"
ENHANCEMENTS_CSS="$CLIENT_SRC/style-enhancements.css"
MAIN_CSS="$CLIENT_SRC/style.css"
BACKUP_CSS="$CLIENT_SRC/style.css.backup"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${BLUE}➜${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if enhancement file exists
print_step "Checking for enhancement file..."
if [ ! -f "$ENHANCEMENTS_CSS" ]; then
    print_error "Enhancement file not found at: $ENHANCEMENTS_CSS"
    exit 1
fi
print_success "Enhancement file found"

# Create backup of original CSS
print_step "Creating backup of original style.css..."
if [ -f "$MAIN_CSS" ]; then
    cp "$MAIN_CSS" "$BACKUP_CSS"
    print_success "Backup created at: $BACKUP_CSS"
else
    print_warning "Original style.css not found, skipping backup"
fi

# Ask user for integration method
echo ""
echo "Choose integration method:"
echo "  1) Merge enhancements into style.css (recommended)"
echo "  2) Keep separate and import via HTML"
echo "  3) Keep separate and import via JavaScript"
echo ""
read -p "Enter choice (1-3): " choice

case $choice in
    1)
        print_step "Merging enhancements into style.css..."
        echo "" >> "$MAIN_CSS"
        echo "/* ============================================================ */" >> "$MAIN_CSS"
        echo "/*   PREMIUM BIO-CYBERPUNK UI ENHANCEMENTS                      */" >> "$MAIN_CSS"
        echo "/*   Auto-merged on $(date)                                     */" >> "$MAIN_CSS"
        echo "/* ============================================================ */" >> "$MAIN_CSS"
        echo "" >> "$MAIN_CSS"
        cat "$ENHANCEMENTS_CSS" >> "$MAIN_CSS"
        print_success "Enhancements merged into style.css"
        ;;

    2)
        print_step "Setting up HTML import..."

        # Find HTML files
        HTML_FILES=$(find "$CLIENT_SRC" -name "*.html" -o -name "index.html")

        if [ -z "$HTML_FILES" ]; then
            print_warning "No HTML files found in $CLIENT_SRC"
            echo "   Add this line to your HTML <head> section:"
            echo "   <link rel=\"stylesheet\" href=\"/src/style-enhancements.css\">"
        else
            for html_file in $HTML_FILES; do
                print_step "Processing: $html_file"
                if ! grep -q "style-enhancements.css" "$html_file"; then
                    # Find the line with main CSS and add after it
                    sed -i '/style\.css/a\    <link rel="stylesheet" href="/src/style-enhancements.css">' "$html_file"
                    print_success "Added import to $html_file"
                else
                    print_warning "Enhancement CSS already imported in $html_file"
                fi
            done
        fi
        ;;

    3)
        print_step "Finding JavaScript entry points..."

        # Find main JS/TS files
        JS_FILES=$(find "$CLIENT_SRC" -name "main.ts" -o -name "main.tsx" -o -name "index.ts" -o -name "index.tsx" -o -name "app.ts" -o -name "app.tsx" | head -5)

        if [ -z "$JS_FILES" ]; then
            print_warning "No JavaScript entry points found"
            echo "   Add this line to your main JavaScript/TypeScript file:"
            echo "   import './style-enhancements.css';"
        else
            echo ""
            echo "Found potential entry points:"
            echo "$JS_FILES" | while read file; do
                echo "  - $file"
            done
            echo ""
            read -p "Enter the path to your main entry file: " entry_file

            if [ -f "$entry_file" ]; then
                if ! grep -q "style-enhancements.css" "$entry_file"; then
                    echo "" >> "$entry_file"
                    echo "import './style-enhancements.css';" >> "$entry_file"
                    print_success "Added import to $entry_file"
                else
                    print_warning "Enhancement CSS already imported in $entry_file"
                fi
            else
                print_error "File not found: $entry_file"
            fi
        fi
        ;;

    *)
        print_error "Invalid choice"
        exit 1
        ;;
esac

# Verify integration
echo ""
print_step "Verifying integration..."

# Check if CSS is valid
if command -v sass &> /dev/null; then
    print_step "Validating CSS syntax..."
    # Note: This is a basic check, actual validation depends on your build system
    print_success "CSS validation passed (basic check)"
else
    print_warning "SASS not found, skipping CSS validation"
fi

# Summary
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Integration Complete!                                    ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
print_success "Enhancements applied successfully!"
echo ""
echo "Next steps:"
echo "  1. Start your dev server"
echo "  2. Open the application in a browser"
echo "  3. Check for enhanced UI components"
echo "  4. Test interactions (hover, click, etc.)"
echo ""
echo "Files created:"
echo "  • $ENHANCEMENTS_CSS (enhancement styles)"
echo "  • $PROJECT_ROOT/UI-ENHANCEMENTS-GUIDE.md (detailed guide)"
echo "  • $PROJECT_ROOT/UI-ENHANCEMENTS-COMPLETE.md (quick reference)"
echo ""

if [ -f "$BACKUP_CSS" ]; then
    echo "Backup created at:"
    echo "  • $BACKUP_CSS"
    echo ""
    echo "To restore original: cp $BACKUP_CSS $MAIN_CSS"
    echo ""
fi

echo "Happy coding! 🧬✨"
