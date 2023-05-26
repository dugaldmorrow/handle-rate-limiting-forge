import api, {
  APIResponse,
  RequestProductMethod,
  assumeTrustedRoute
} from '@forge/api';
import { Queue } from '@forge/events';
import {
  DefaultRetryDetector,
  RetryDetector
} from 'handle-rate-limiting-js'
import Resolver from '@forge/resolver';
import { AsyncRetryInfo } from './AsyncRetryInfo';
import { ProductFetchOptions } from './ProductFetchOptions';

/**
 * This class manages making fetch requests such that retries are handled using 
 * the Forge async events API.
 */
export class AsyncFetchManager {

  retryQueue: Queue;
  retryDetector: RetryDetector = new DefaultRetryDetector();
  maybeHandleProductResponse: (response: APIResponse, appContext: string) => Promise<void>;
  queueHandler: any;

  constructor(
      queueName: string,
      retryListenerName: string,
    maybeHandleProductResponse: (response: APIResponse, appContext: string) => Promise<void>) {

    // Create the Queue that retry information will be added to.
    this.retryQueue = new Queue({ key: queueName });
    this.maybeHandleProductResponse = maybeHandleProductResponse;
    // Create a resolver and add our queue listener to it.
    const restRetryResolver = new Resolver();
    restRetryResolver.define(retryListenerName, this.restRetryQueueListener);
    this.queueHandler = restRetryResolver.getDefinitions();
  }

  setRetryDetector = (retryDetector: RetryDetector): void => {
    this.retryDetector = retryDetector;
  }

  restRetryQueueListener = async (queueItem) => {
    const eventPayload = queueItem.payload;
    console.log(`Received a retry event...`);
    const asyncRetryInfo = JSON.parse(eventPayload as unknown as string) as AsyncRetryInfo;
    const maybeResponse = await this.productFetchAsync(asyncRetryInfo, this.retryQueue, this.retryDetector);
    if (maybeResponse) {
      await this.maybeHandleProductResponse(maybeResponse, asyncRetryInfo.appContext);
    }
  };

  getQueueHandler = (): any => {
    return this.queueHandler;
  }

  productFetch = async (lastRetryInfo: AsyncRetryInfo): Promise<void> => {
    const maybeResponse = await this.productFetchAsync(lastRetryInfo, this.retryQueue, this.retryDetector);
    if (maybeResponse) {
      await this.maybeHandleProductResponse(maybeResponse, lastRetryInfo.appContext);
    }
  }

  private productFetchAsync = async (
    lastRetryInfo: AsyncRetryInfo,
    restRetryQueue: Queue,
    retryDetector?: RetryDetector): Promise<undefined | APIResponse> => {
    const requestProductMethod = this.buildProductFetch(lastRetryInfo.productFetchOptions);
    const url = assumeTrustedRoute(lastRetryInfo.stringRoute);
    const response = await requestProductMethod(url, lastRetryInfo.init);
    console.log(`Status = ${response.status}`);
    retryDetector = retryDetector ? retryDetector : new DefaultRetryDetector();
    const retryInfo = retryDetector.computeRetryInfo(
      lastRetryInfo.remainingRetries,
      lastRetryInfo.retryDelayMillis,
      lastRetryInfo.rateLimitingHandlingOptions,
      response as any);
    if (retryInfo) {
      console.log(`This request needs to be retried!`);
      const asyncRetryInfo: AsyncRetryInfo = {
        remainingRetries: retryInfo.remainingRetries,
        retryDelayMillis: retryInfo.retryDelayMillis,
        productFetchOptions: lastRetryInfo.productFetchOptions,
        rateLimitingHandlingOptions: lastRetryInfo.rateLimitingHandlingOptions,
        stringRoute: lastRetryInfo.stringRoute,
        init: lastRetryInfo.init,
        appContext: lastRetryInfo.appContext
      }
      const delayInSeconds = Math.round(retryInfo.retryDelayMillis / 1000);
      await restRetryQueue.push(JSON.stringify(asyncRetryInfo), {
        delayInSeconds: delayInSeconds
      });
      return undefined;
    } else {
      console.log(`This request should not be retried.`);
      return response;
    }
  }

  private buildProductFetch = (options: ProductFetchOptions): RequestProductMethod => {
    if (options.api === 'jira') {
      if (options.impersonation === 'app') {
        return api.asApp().requestJira;
      } else {
        return api.asUser().requestJira;
      }
    } else if (options.api === 'confluence') {
      if (options.impersonation === 'app') {
        return api.asApp().requestConfluence;
      } else {
        return api.asUser().requestConfluence;
      }
    } else if (options.api === 'bitbucket') {
      // This library has a dependency on version 2.6.0 of @forge/api which doesn't have the
      // requestBitbucket method. However, through peer dependencies, the library allows later
      // versions of @forge/api to be used which may have the requestBitbucket method. For this
      // reason, we use special logic to allow requestBitbucket to be used.
      // if (options.impersonation === 'app') {
      //   return api.asApp().requestBitbucket;
      // } else {
      //   return api.asUser().requestBitbucket;
      // }

      const methods = options.impersonation === 'app' ? api.asApp() as any : api.asUser() as any;
      if (methods['requestBitbucket']) {
        return methods['requestBitbucket'] as RequestProductMethod;
      }
    } else {
      throw new Error(`Unexpected API ${options.api}`);
    }
  }

}

