import { RateLimitingHandlingOptions, RetryInfo } from 'handle-rate-limiting-js'
import { RequestInit } from 'node-fetch';
import { ProductFetchOptions } from './ProductFetchOptions';

export interface AsyncRetryInfo extends RetryInfo {
  productFetchOptions: ProductFetchOptions
  rateLimitingHandlingOptions: RateLimitingHandlingOptions
  stringRoute: string
  init?: RequestInit
  appContext: string
}
