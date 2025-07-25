declare global {
  interface Window {
    plausible: (event: string, options?: PlausibleEventOptions) => void;
  }
}

interface PlausibleEventOptions {
  callback?: () => void;
  props?: Record<string, string | number | boolean | undefined>;
  revenue?: {
    currency: string;
    amount: number;
  };
}

interface PlausibleEvent {
  name: string;
  props?: Record<string, string | number | boolean>;
  revenue?: {
    currency: string;
    amount: number;
  };
}

class PlausibleAnalytics {
  private static isPlausibleLoaded(): boolean {
    return (
      typeof window !== 'undefined' && typeof window.plausible === 'function'
    );
  }

  static trackEvent(
    event: string,
    options?: PlausibleEventOptions,
  ): Promise<void> {
    return new Promise(resolve => {
      if (!this.isPlausibleLoaded()) {
        console.warn('Plausible is not loaded');
        resolve();
        return;
      }

      const eventOptions: PlausibleEventOptions = {
        ...options,
        callback: () => {
          options?.callback?.();
          resolve();
        },
      };

      window.plausible(event, eventOptions);

      setTimeout(resolve, 150);
    });
  }

  static trackPageView(url?: string): Promise<void> {
    return this.trackEvent('pageview', {
      props: url ? { url } : undefined,
    });
  }

  static trackOutboundClick(
    url: string,
    props?: Record<string, string | number | boolean>,
  ): Promise<void> {
    return this.trackEvent('Outbound Link: Click', {
      props: {
        url,
        ...props,
      },
    });
  }

  static trackFileDownload(fileName: string, fileType?: string): Promise<void> {
    return this.trackEvent('File Download', {
      props: {
        file_name: fileName,
        ...(fileType && { file_type: fileType }),
      },
    });
  }

  static trackFormSubmission(
    formName: string,
    props?: Record<string, any>,
  ): Promise<void> {
    return this.trackEvent('Form Submit', {
      props: {
        form_name: formName,
        pagePath: `d.foundation${window.location.pathname}`,
        ...props,
      },
    });
  }

  static trackSearch(query: string, resultsCount?: number): Promise<void> {
    return this.trackEvent('Search', {
      props: {
        query,
        ...(resultsCount !== undefined && { results_count: resultsCount }),
      },
    });
  }

  static trackCustomEvent(eventData: PlausibleEvent): Promise<void> {
    return this.trackEvent(eventData.name, {
      props: eventData.props,
      revenue: eventData.revenue,
    });
  }

  static trackShare(
    type: string,
    url: string,
    props?: Record<string, string | number | boolean>,
  ): Promise<void> {
    return this.trackEvent('Share', {
      props: {
        type,
        url,
        ...props,
      },
    });
  }

  static trackSubscribe(
    source: string,
    props?: Record<string, string | number | boolean>,
  ): Promise<void> {
    return this.trackEvent('Subscribe', {
      props: {
        source,
        ...props,
      },
    });
  }
}

export const plausible = PlausibleAnalytics;

export const trackEvent =
  PlausibleAnalytics.trackEvent.bind(PlausibleAnalytics);
export const trackPageView =
  PlausibleAnalytics.trackPageView.bind(PlausibleAnalytics);
export const trackOutboundClick =
  PlausibleAnalytics.trackOutboundClick.bind(PlausibleAnalytics);
export const trackFileDownload =
  PlausibleAnalytics.trackFileDownload.bind(PlausibleAnalytics);
export const trackFormSubmission =
  PlausibleAnalytics.trackFormSubmission.bind(PlausibleAnalytics);
export const trackSearch =
  PlausibleAnalytics.trackSearch.bind(PlausibleAnalytics);
export const trackCustomEvent =
  PlausibleAnalytics.trackCustomEvent.bind(PlausibleAnalytics);
export const trackShare =
  PlausibleAnalytics.trackShare.bind(PlausibleAnalytics);
export const trackSubscribe =
  PlausibleAnalytics.trackSubscribe.bind(PlausibleAnalytics);
