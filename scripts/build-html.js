// Build script to replace environment variables in HTML template
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const templatePath = path.join(projectRoot, 'index.template.html');
const outputPath = path.join(projectRoot, 'index.html');

function loadEnvConfig() {
  // Load from process.env with fallbacks
  return {
    APP_TITLE: process.env.VITE_APP_TITLE || "Growth OS - AI-Powered Learning Platform",
    APP_DESCRIPTION: process.env.VITE_APP_DESCRIPTION || "Growth OS by IDM Pakistan - AI-powered LMS for e-commerce success",
    APP_AUTHOR: process.env.VITE_APP_AUTHOR || "IDM Pakistan",
    TWITTER_HANDLE: process.env.VITE_TWITTER_HANDLE || "@core47ai",
    FAVICON_PATH: process.env.VITE_FAVICON_PATH || "/favicon.ico"
  };
}

function replaceTemplateVariables() {
  try {
    // Read template
    const template = fs.readFileSync(templatePath, 'utf8');
    
    // Load environment configuration
    const config = loadEnvConfig();
    
    // Replace all template variables
    let html = template;
    Object.entries(config).forEach(([key, value]) => {
      const placeholder = `%%${key}%%`;
      html = html.replaceAll(placeholder, value);
    });
    
    // Write output
    fs.writeFileSync(outputPath, html, 'utf8');
    
    console.log('✅ HTML template processed successfully');
    console.log(`📝 Generated: ${outputPath}`);
    
    // Log configuration used
    console.log('\n🔧 Configuration used:');
    Object.entries(config).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`);
    });
    
  } catch (error) {
    console.error('❌ Error processing HTML template:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  replaceTemplateVariables();
}

export { replaceTemplateVariables };