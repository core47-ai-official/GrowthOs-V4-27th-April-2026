import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface LiveChatWidgetProps {
  userRole?: string;
}

export function LiveChatWidget({ userRole }: LiveChatWidgetProps) {
  const [livechatCode, setLivechatCode] = useState<string | null>(null);

  useEffect(() => {
    // Only load for students
    if (userRole !== 'student') return;

    const fetchLiveChatCode = async () => {
      try {
        // Try direct query first (works for authenticated users)
        const { data, error } = await supabase
          .from('company_settings')
          .select('livechat_code')
          .eq('id', 1)
          .maybeSingle();

        if (!error && data) {
          const code = (data as any).livechat_code;
          if (code && typeof code === 'string' && code.trim()) {
            setLivechatCode(code.trim());
            return;
          }
        }

        // Fallback: use edge function for unauthenticated users (e.g., login page)
        const { data: fnData, error: fnError } = await supabase.functions.invoke('get-livechat-code');
        if (!fnError && fnData?.livechat_code) {
          setLivechatCode(fnData.livechat_code.trim());
        }
      } catch (e) {
        console.error('Error fetching live chat code:', e);
      }
    };

    fetchLiveChatCode();
  }, [userRole]);

  useEffect(() => {
    if (!livechatCode) return;

    // Create a container for the live chat script
    const container = document.createElement('div');
    container.id = 'livechat-widget-container';
    document.body.appendChild(container);

    // Parse and execute script tags from the livechat code
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = livechatCode;

    const scripts = tempDiv.querySelectorAll('script');
    const nonScriptContent = livechatCode.replace(/<script[\s\S]*?<\/script>/gi, '');

    // Inject non-script HTML if any
    if (nonScriptContent.trim()) {
      container.innerHTML = nonScriptContent;
    }

    // Execute script tags
    const scriptElements: HTMLScriptElement[] = [];
    scripts.forEach((script) => {
      const newScript = document.createElement('script');
      if (script.src) {
        newScript.src = script.src;
        newScript.async = true;
      } else {
        newScript.textContent = script.textContent;
      }
      // Copy attributes
      Array.from(script.attributes).forEach((attr) => {
        if (attr.name !== 'src') {
          newScript.setAttribute(attr.name, attr.value);
        }
      });
      document.body.appendChild(newScript);
      scriptElements.push(newScript);
    });

    return () => {
      // Cleanup on unmount
      container.remove();
      scriptElements.forEach((s) => s.remove());
    };
  }, [livechatCode]);

  return null;
}
