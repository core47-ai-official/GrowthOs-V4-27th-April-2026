import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './styles/app.css'
import { setupGlobalErrorHandling } from './lib/error-handler'
import { DOMAIN_CONFIG } from './config/text-content'

// Immediate protection against external redirects - safer approach
(function blockExternalRedirects() {
  // Block beforeunload events that might trigger redirects
  window.addEventListener('beforeunload', function(e) {
    const target = (e.target as Window)?.location?.href;
    if (target && DOMAIN_CONFIG.isBlockedDomain(target)) {
      e.preventDefault();
      e.returnValue = '';
      console.warn('BLOCKED: External redirect attempt to:', target);
    }
  });

  // Block navigation events
  window.addEventListener('popstate', function(e) {
    if (DOMAIN_CONFIG.isBlockedDomain(window.location.href)) {
      e.preventDefault();
      history.pushState(null, '', '/');
      console.warn('BLOCKED: External navigation to:', window.location.href);
    }
  });

  // Intercept any script injections that might cause redirects
  const originalCreateElement = document.createElement;
  document.createElement = function(tagName) {
    const element = originalCreateElement.call(this, tagName);
    if (tagName.toLowerCase() === 'script') {
      const originalSrc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
      Object.defineProperty(element, 'src', {
        set: function(value) {
          if (typeof value === 'string' && DOMAIN_CONFIG.isBlockedDomain(value)) {
            console.warn('BLOCKED: Script redirect attempt to:', value);
            return;
          }
          if (originalSrc && originalSrc.set) {
            originalSrc.set.call(this, value);
          }
        },
        get: originalSrc ? originalSrc.get : function() { return ''; },
        configurable: true
      });
    }
    return element;
  };

  // Monitor for any window.open attempts
  const originalOpen = window.open;
  window.open = function(url, target, features) {
    const urlString = typeof url === 'string' ? url : url?.toString() || '';
    if (urlString && DOMAIN_CONFIG.isBlockedDomain(urlString)) {
      console.warn('BLOCKED: Window.open redirect attempt to:', url);
      return null;
    }
    return originalOpen.call(this, url, target, features);
  };
})();

// Setup global error handling
setupGlobalErrorHandling();

createRoot(document.getElementById("root")!).render(<App />);
