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

  refresh(changedTiddlers: IChangedTiddlers): boolean {
    const changedAttributes = this.computeAttributes();

    if (changedAttributes.url || changedAttributes.label || changedAttributes.interval) {
      this.refreshSelf();
      return true;
    }

    return false;
  }

  render(parent: Element, nextSibling: Element): void {
    this.parentDomNode = parent;
    this.computeAttributes();
    this.execute();

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
    const badgeNode = $tw.utils.domMaker('span', {
      class: 'tc-check-website-badge',
    });

    // Create badge elements
    this.labelSpan = $tw.utils.domMaker('span', {
      class: 'tc-check-website-label',
      text: this.websiteLabel,
    }) as HTMLSpanElement;

    this.statusSpan = $tw.utils.domMaker('span', {
      class: 'tc-check-website-status tc-check-website-checking',
      text: 'Checking...',
    }) as HTMLSpanElement;

    badgeNode.appendChild(this.labelSpan);
    badgeNode.appendChild(this.statusSpan);
    linkElement.appendChild(badgeNode);

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
  private parseInterval(intervalStr: string): number {
    if (!intervalStr) {
      return 3600000; // default 1 hour
    }

    let totalMs = 0;
    const hours = /(\d+)h/.exec(intervalStr);
    const minutes = /(\d+)m/.exec(intervalStr);
    const seconds = /(\d+)s/.exec(intervalStr);

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
      this.updateStatus('error', 'No URL');
      return;
    }

    try {
      // Use fetch to check website
      await fetch(this.websiteUrl, {
        method: 'HEAD',
        mode: 'no-cors', // Allow checking cross-origin sites
        cache: 'no-cache',
      });
      // In no-cors mode, we get an opaque response
      // If fetch succeeds without error, consider it online
      this.updateStatus('online', 'Online');
    } catch {
      this.updateStatus('offline', 'Offline');
    }
  }

  /**
   * Update the status display
   */
  private updateStatus(status: string, text: string): void {
    if (this.statusSpan) {
      this.statusSpan.textContent = text;
      this.statusSpan.className = `tc-check-website-status tc-check-website-${status}`;
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
