import { widget as Widget } from '$:/core/modules/widgets/widget.js';
import type { IChangedTiddlers } from 'tiddlywiki';
import './index.css';

class CheckWebsiteWidget extends Widget {
  private websiteUrl!: string;
  private websiteLabel!: string;
  private checkInterval!: string;
  private intervalMs!: number;
  private intervalId?: number;
  private labelSpan?: HTMLSpanElement;
  private statusSpan?: HTMLSpanElement;
  private badgeNode?: HTMLSpanElement;
  private followRedirects!: boolean;
  private backgroundMode!: boolean;
  private connectActions!: string;
  private disconnectActions!: string;
  private lastStatus: 'online' | 'offline' | 'checking' | 'error' = 'checking';

  refresh(_changedTiddlers: IChangedTiddlers): boolean {
    const changedAttributes = this.computeAttributes();

    if (Object.keys(changedAttributes).length > 0) {
      this.refreshSelf();
      return true;
    }

    return false;
  }

  render(parent: Element, nextSibling: Element): void {
    this.parentDomNode = parent;
    this.computeAttributes();
    this.execute();

    // Skip rendering in background mode
    if (this.backgroundMode) {
      this.domNodes.push($tw.utils.domMaker('span', { style: { display: 'none' } }));
      parent.insertBefore(this.domNodes[0], nextSibling);
      this.startChecking();
      return;
    }

    // Create link wrapper
    const linkElement = $tw.utils.domMaker('a', {
      class: 'tc-check-website-link',
      attributes: {
        href: this.websiteUrl,
        target: '_blank',
        rel: 'noopener noreferrer',
      },
    });

    // Create badge container
    this.badgeNode = $tw.utils.domMaker('span', {
      class: 'tc-check-website-badge',
    });

    // Create badge elements
    this.labelSpan = $tw.utils.domMaker('span', {
      class: 'tc-check-website-label',
      text: this.websiteLabel,
    });

    this.statusSpan = $tw.utils.domMaker('span', {
      class: 'tc-check-website-status tc-check-website-checking',
      text: 'Checking...',
    });

    this.badgeNode.appendChild(this.labelSpan);
    this.badgeNode.appendChild(this.statusSpan);
    linkElement.appendChild(this.badgeNode);

    parent.insertBefore(linkElement, nextSibling);
    this.domNodes.push(linkElement);

    // Start checking
    this.startChecking();
  }

  execute(): void {
    // Get attributes
    this.websiteUrl = this.getAttribute('url', '');
    this.websiteLabel = this.getAttribute('label', '');
    this.checkInterval = this.getAttribute('interval', '1h');
    this.followRedirects = this.getAttribute('follow-redirects', 'yes') === 'yes';
    this.backgroundMode = this.getAttribute('background-mode', 'no') === 'yes';
    this.connectActions = this.getAttribute('connect-actions', '');
    this.disconnectActions = this.getAttribute('disconnect-actions', '');

    // Extract hostname if label not provided
    if (!this.websiteLabel && this.websiteUrl) {
      try {
        const url = new URL(this.websiteUrl);
        this.websiteLabel = url.hostname;
      } catch {
        this.websiteLabel = this.websiteUrl;
      }
    }

    // Parse interval to milliseconds
    this.intervalMs = this.parseInterval(this.checkInterval);
  }

  /**
   * Parse interval string to milliseconds
   * Supports: 1h, 30m, 5s, 1h30m, 1h30m5s, etc.
   */
  private parseInterval(intervalString: string): number {
    if (!intervalString) {
      return 3600000; // default 1 hour
    }

    let totalMs = 0;
    const hours = /(\d+)h/.exec(intervalString);
    const minutes = /(\d+)m/.exec(intervalString);
    const seconds = /(\d+)s/.exec(intervalString);

    if (hours) {
      totalMs += parseInt(hours[1], 10) * 3600000;
    }
    if (minutes) {
      totalMs += parseInt(minutes[1], 10) * 60000;
    }
    if (seconds) {
      totalMs += parseInt(seconds[1], 10) * 1000;
    }

    return totalMs || 3600000; // default to 1 hour if parsing fails
  }

  /**
   * Start the periodic checking
   */
  private startChecking(): void {
    // Check immediately
    void this.checkWebsite();

    // Set up periodic checking
    this.intervalId = window.setInterval(() => {
      void this.checkWebsite();
    }, this.intervalMs);
  }

  /**
   * Check if website is available
   */
  private async checkWebsite(): Promise<void> {
    if (!this.websiteUrl) {
      this.updateStatus('error', 'No URL', 'URL parameter is required');
      return;
    }

    try {
      // Use fetch to check website - try with normal mode first to get real status codes
      const response = await fetch(this.websiteUrl, {
        method: 'HEAD',
        cache: 'no-cache',
        redirect: this.followRedirects ? 'follow' : 'manual',
      });

      // Check response status
      if (response.ok) {
        // 2xx status codes
        this.updateStatus('online', 'Online', `HTTP ${response.status}`);
      } else if (response.status >= 300 && response.status < 400) {
        // 3xx redirect codes
        if (this.followRedirects) {
          this.updateStatus('online', 'Online', `HTTP ${response.status} (redirected)`);
        } else {
          this.updateStatus('offline', `Redirect (${response.status})`, `HTTP ${response.status}`);
        }
      } else if (response.status >= 400) {
        // 4xx and 5xx error codes
        this.updateStatus('offline', `Error (${response.status})`, `HTTP ${response.status}`);
      } else {
        this.updateStatus('offline', 'Offline', `HTTP ${response.status}`);
      }
    } catch {
      // CORS errors or network failures - try with no-cors as fallback
      try {
        await fetch(this.websiteUrl, {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-cache',
        });
        // In no-cors mode, if fetch succeeds without error, consider it online
        // but we can't get the real status code
        this.updateStatus('online', 'Online', 'Status verified via no-cors mode (HTTP status code not available due to CORS policy)');
      } catch {
        this.updateStatus('offline', 'Offline', 'Network error or unreachable');
      }
    }
  }

  /**
   * Update the status display
   */
  private updateStatus(status: 'online' | 'offline' | 'checking' | 'error', text: string, tooltip?: string): void {
    const previousStatus = this.lastStatus;
    this.lastStatus = status;

    if (this.statusSpan) {
      this.statusSpan.textContent = text;
      this.statusSpan.className = `tc-check-website-status tc-check-website-${status}`;
    }

    if (this.badgeNode && tooltip) {
      this.badgeNode.setAttribute('title', tooltip);
    }

    // Trigger actions on status change
    // Trigger actions when status changes, except when both are 'checking'
    if (previousStatus !== status && status !== 'checking') {
      if (status === 'online' && this.connectActions) {
        this.invokeActionString(this.connectActions, this, undefined, { status, url: this.websiteUrl });
      } else if (status === 'offline' && this.disconnectActions) {
        this.invokeActionString(this.disconnectActions, this, undefined, { status, url: this.websiteUrl });
      }
    }
  }

  /**
   * Remove the widget from the DOM
   */
  removeChildDomNodes(): void {
    // Clear interval
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    // Call parent implementation
    Widget.prototype.removeChildDomNodes.call(this);
  }
}

// Export the widget with the name 'check-website'
// Usage: <$check-website url="..." label="..." interval="..." />
declare let exports: {
  'check-website': typeof CheckWebsiteWidget;
};
exports['check-website'] = CheckWebsiteWidget;
