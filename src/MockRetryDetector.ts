import {
  DefaultRetryDetector,
  RateLimitingHandlingOptions,
  RetryDetector,
  RetryInfo
} from 'handle-rate-limiting-js';

/**
 * This class implements RetryDetector such that request retries are forced even for
 * successful requests, but only until there are no more retries allowed. This is useful
 * for testing the request retry logic.
 */
export class MockRetryDetector implements RetryDetector {

  computeRetryInfo = (
    remainingRetries: number,
    lastRetryDelayMillis: number,
    options: RateLimitingHandlingOptions,
    response: Response): undefined | RetryInfo => {
    if (remainingRetries > 0) {
      console.log(`MockRetryDetector: pretending a retry is necessary (this will occur until there are no more retries available).`);
      // Force a retry to demonstrate how the code handles retrying...
      const forcedRetryInfo: RetryInfo = {
        remainingRetries: remainingRetries - 1,
        // For this demo, we don't care much about our backoff strategy...
        retryDelayMillis: lastRetryDelayMillis + 1000
      }
      return forcedRetryInfo;
    } else {
      console.log(`MockRetryDetector: delegating to proper retry detection logic.`);
      const retryDetector = new DefaultRetryDetector();
      return retryDetector.computeRetryInfo(remainingRetries, lastRetryDelayMillis, options, response);
    }
  }

}
