#!/usr/bin/env node

import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

/**
 * Slugify a string for use in filenames
 */
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

/**
 * Extract path segment from URL for fallback filename
 */
function getPathSegment(url) {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    const segments = path.split('/').filter(s => s.length > 0);
    return segments.length > 0 ? segments[segments.length - 1] : 'index';
  } catch {
    return 'unknown';
  }
}

/**
 * Format date/time for filename
 */
function getTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}_${hours}${minutes}${seconds}`;
}

/**
 * Check if "Connected" indicator is visible on the page
 */
async function checkConnected(page, timeout = 10000) {
  try {
    // Try multiple methods to find "Connected" text
    // Method 1: Use getByText with case-insensitive matching
    await page.getByText(/Connected/i).first().waitFor({ timeout, state: 'visible' });
    return true;
  } catch {
    // Method 2: Fallback to checking page content
    try {
      const content = await page.content();
      if (/Connected/i.test(content)) {
        return true;
      }
    } catch {
      // Ignore errors
    }
    return false;
  }
}

/**
 * Capture screenshot for a single URL
 */
async function captureScreenshot(browser, config) {
  const { env, menu, url } = config;
  
  console.log(`\n📸 Capturing: ${menu} (${env})`);
  console.log(`   URL: ${url}`);
  
  const page = await browser.newPage();
  
  try {
    // Navigate to URL
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 60000
    });
    
    // Wait extra 1 second as specified
    await page.waitForTimeout(1000);
    
    // Check for "Connected" indicator
    const isConnected = await checkConnected(page, 10000);
    
    // Get page title for filename
    let titleSlug = '';
    try {
      const title = await page.title();
      if (title && title.trim().length > 0) {
        titleSlug = slugify(title);
      } else {
        titleSlug = getPathSegment(url);
      }
    } catch {
      titleSlug = getPathSegment(url);
    }
    
    // Build filename
    const timestamp = getTimestamp();
    const connectedSuffix = isConnected ? '' : '__NOT_CONNECTED';
    const filename = `${menu}__${timestamp}__${titleSlug}${connectedSuffix}.png`;
    
    // Create output directory
    const outputDir = join(ROOT_DIR, 'evidence', env, menu);
    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true });
    }
    
    const filepath = join(outputDir, filename);
    
    // Take full-page screenshot
    await page.screenshot({
      path: filepath,
      fullPage: true,
      type: 'png'
    });
    
    console.log(`   ✅ Saved: ${filepath}`);
    if (!isConnected) {
      console.log(`   ⚠️  Warning: "Connected" indicator not found`);
    }
    
    return { success: true, filepath, isConnected };
    
  } catch (error) {
    console.error(`   ❌ Error capturing ${url}:`, error.message);
    return { success: false, error: error.message };
  } finally {
    await page.close();
  }
}

/**
 * Main function
 */
async function main() {
  // Read URLs from stdin or command line argument
  let urlsConfig = [];
  
  if (process.argv[2]) {
    // Read from file or parse JSON argument
    const arg = process.argv[2];
    try {
      if (arg.startsWith('[') || arg.startsWith('{')) {
        // Direct JSON argument
        urlsConfig = JSON.parse(arg);
      } else {
        // File path
        const { readFileSync } = await import('fs');
        const content = readFileSync(arg, 'utf-8');
        urlsConfig = JSON.parse(content);
      }
    } catch (error) {
      console.error('Error parsing input:', error.message);
      process.exit(1);
    }
  } else {
    // Read from stdin
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    const input = Buffer.concat(chunks).toString('utf-8');
    if (input.trim()) {
      urlsConfig = JSON.parse(input);
    } else {
      console.error('No input provided. Usage:');
      console.error('  echo \'[{"env":"wemix-testnet","menu":"dashboard","url":"..."}]\' | node scripts/capture_screenshots.mjs');
      console.error('  node scripts/capture_screenshots.mjs urls.json');
      process.exit(1);
    }
  }
  
  if (!Array.isArray(urlsConfig) || urlsConfig.length === 0) {
    console.error('Invalid input: expected JSON array of URL configs');
    process.exit(1);
  }
  
  console.log(`🚀 Starting screenshot capture for ${urlsConfig.length} URL(s)...`);
  
  // Launch browser
  const browser = await chromium.launch({
    headless: true
  });
  
  const results = [];
  
  try {
    // Process each URL sequentially
    for (const config of urlsConfig) {
      if (!config.env || !config.menu || !config.url) {
        console.warn(`⚠️  Skipping invalid config:`, config);
        continue;
      }
      
      const result = await captureScreenshot(browser, config);
      results.push({ ...config, ...result });
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary:');
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const notConnected = results.filter(r => r.success && !r.isConnected).length;
    
    console.log(`   ✅ Successful: ${successful}`);
    console.log(`   ❌ Failed: ${failed}`);
    if (notConnected > 0) {
      console.log(`   ⚠️  Not Connected: ${notConnected}`);
    }
    console.log('='.repeat(60));
    
  } finally {
    await browser.close();
  }
  
  // Exit with error code if any failed
  if (results.some(r => !r.success)) {
    process.exit(1);
  }
}

// Run main function
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
